const defaults = { enabled: true, patterns: ["*.spec.ts"] };

const enabledInput = document.querySelector("#enabled");
const patternsInput = document.querySelector("#patterns");
const error = document.querySelector("#error");
const status = document.querySelector("#status");

function migrateLegacyPattern(pattern) {
  return pattern === ".*\\.spec\\.ts$" ? "*.spec.ts" : pattern;
}

chrome.storage.sync.get(defaults, (settings) => {
  enabledInput.checked = settings.enabled;
  const patterns = (settings.patterns || defaults.patterns).map(migrateLegacyPattern);
  patternsInput.value = patterns.join("\n");
  if (patterns.some((pattern, index) => pattern !== settings.patterns?.[index])) {
    chrome.storage.sync.set({ patterns });
  }
});

document.querySelector("#save").addEventListener("click", () => {
  const patterns = patternsInput.value.split("\n").map((line) => line.trim()).filter(Boolean);
  error.hidden = true;
  chrome.storage.sync.set({ enabled: enabledInput.checked, patterns }, () => {
    status.textContent = "Rules saved";
    window.setTimeout(() => { status.textContent = "Saved automatically"; }, 1800);
  });
});
