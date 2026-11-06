# DiffFold

DiffFold is a Chrome extension that automatically collapses files in GitHub pull request diffs when their paths match your glob patterns.

## Install locally

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this project directory.
4. Open a GitHub pull request and add DiffFold to the browser toolbar.

## Configure

Open the extension popup, enable auto-collapse, and enter one glob pattern per line. `*` matches any number of characters, including `/`, and patterns match the full path shown by GitHub. The default rule is:

```regex
*.spec.ts
```

For example, `*.test.ts` matches TypeScript test files, and `generated/*` matches files in a `generated` directory. Settings sync through Chrome storage.

DiffFold operates on the **Files changed** tab of GitHub pull requests (`/files` and `/changes`) and leaves unmatched files alone. After changing extension files, open `chrome://extensions` and click the reload icon on DiffFold, then refresh the pull request tab.
