const defaultSettings = { enabled: true, patterns: ["*.spec.ts"] };
let settings = defaultSettings;
let processedFiles = new WeakMap();
const fileSelector = '.file, .js-file, [data-tagsearch-path], [role="region"][aria-labelledby]';

function migrateLegacyPattern(pattern) {
  // Older builds stored the default as a regular expression.
  return pattern === ".*\\.spec\\.ts$" ? "*.spec.ts" : pattern;
}

function cleanPath(path) {
  return path.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
}

function getFilePath(file) {
  const headingId = file.getAttribute("aria-labelledby");
  const labelledHeading = headingId && document.getElementById(headingId);
  if (labelledHeading?.textContent) return cleanPath(labelledHeading.textContent);
  const heading = file.querySelector('[data-diff-header-wrapper] a[href*="#diff-"], [aria-labelledby] a[href*="#diff-"]');
  if (heading?.textContent) return cleanPath(heading.textContent);
  const dataPath = file.getAttribute("data-tagsearch-path") || file.getAttribute("data-path");
  if (dataPath) return dataPath;

  const header = file.querySelector(".file-header[data-path]");
  if (header) return header.getAttribute("data-path");

  const pathLink = file.querySelector('.file-info a[href*="/blob/"]');
  if (pathLink) {
    const match = pathLink.getAttribute("href")?.match(/\/blob\/[^/]+\/(.+)$/);
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
    return pathLink.textContent.trim();
  }

  return file.querySelector(".file-header")?.textContent.trim() || "";
}

function isExpanded(file) {
  const toggle = getCollapseToggle(file);
  if (toggle) {
    const label = `${toggle.getAttribute("aria-label") || ""} ${toggle.getAttribute("title") || ""}`;
    if (/expand/i.test(label)) return false;
    if (/collapse/i.test(label)) return true;
    if (toggle.getAttribute("aria-expanded") !== null) {
      return toggle.getAttribute("aria-expanded") === "true";
    }
    return !file.classList.contains("is-collapsed");
  }

  const details = file.matches("details") ? file : file.querySelector("details");
  return details ? details.open : !file.classList.contains("is-collapsed");
}

function getCollapseToggle(file) {
  const selectors = [
    '[data-diff-header-wrapper] button:has(svg.octicon-chevron-down)',
    '[data-diff-header-wrapper] button[aria-label="Collapse file"]',
    'button[aria-label="Collapse file"]',
    '[data-diff-header-wrapper] button[aria-expanded="true"]',
    ".file-header .js-details-target",
    '.file-header button[aria-expanded]',
    '.file-header [role="button"][aria-expanded]',
    '.file-header button[aria-label*="Collapse" i]',
    '.file-header button[aria-label*="Hide diff" i]',
    '.file-header button[title*="Collapse" i]',
  ];
  return file.querySelector(selectors.join(", "));
}

function collapse(file) {
  const toggle = getCollapseToggle(file);
  if (toggle && isExpanded(file)) {
    toggle.click();
    return;
  }

  const details = file.matches("details") ? file : file.querySelector("details");
  if (details?.open) {
    details.open = false;
    return;
  }

  const summary = file.querySelector(".file-header");
  if (summary && isExpanded(file)) summary.click();
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function isPullRequestDiffPage() {
  return /\/pull\/\d+\/(?:files|changes)(?:\/|$)/.test(location.pathname);
}

function applyToFile(file) {
  if (!settings.enabled) return;
  const path = getFilePath(file);
  if (!path) return;
  if (processedFiles.get(file) === path) return;

  const shouldCollapse = settings.patterns.some((pattern) => {
    try {
      return globToRegExp(pattern).test(path);
    } catch {
      return false;
    }
  });
  if (shouldCollapse) {
    if (!getCollapseToggle(file)) return;
    processedFiles.set(file, path);
    collapse(file);
    return;
  }
  processedFiles.set(file, path);
}

function scan(root = document) {
  if (!isPullRequestDiffPage()) return;

  if (root instanceof Element && root.matches(fileSelector)) {
    applyToFile(root);
  }
  root.querySelectorAll?.(fileSelector).forEach((file) => {
    applyToFile(file);
  });
}

chrome.storage.sync.get(defaultSettings, (stored) => {
  settings = {
    ...stored,
    patterns: (stored.patterns || defaultSettings.patterns).map(migrateLegacyPattern),
  };
  if (settings.patterns.some((pattern, index) => pattern !== stored.patterns?.[index])) {
    chrome.storage.sync.set({ patterns: settings.patterns });
  }
  scan();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  if (changes.enabled) settings.enabled = changes.enabled.newValue;
  if (changes.patterns) settings.patterns = changes.patterns.newValue;
  if ((changes.enabled || changes.patterns) && isPullRequestDiffPage()) {
    processedFiles = new WeakMap();
    scan();
  }
});

let scanScheduled = false;
function scheduleScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    scan();
  });
}

const observer = new MutationObserver((records) => {
  if (records.some((record) => record.addedNodes.length || record.type === "characterData")) {
    scheduleScan();
  }
});
observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
window.addEventListener("turbo:load", scheduleScan);
window.addEventListener("pjax:end", scheduleScan);
window.addEventListener("popstate", scheduleScan);

let previousPathname = location.pathname;
window.setInterval(() => {
  if (location.pathname === previousPathname) return;
  previousPathname = location.pathname;
  processedFiles = new WeakMap();
  scheduleScan();
}, 500);
