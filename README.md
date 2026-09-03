# Markdown Editor

A lightweight, client-side markdown viewer/editor that runs entirely in the browser — no server, no build step, no install. Open a local `.md` file or folder, view it rendered, edit it, and save straight back to disk.

**Live app:** open `index.html` via GitHub Pages, or serve this folder locally.

## Requirements

This app uses the browser's [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) to open, browse, and save local files directly. That API is only available in **Chrome, Edge, or another Chromium-based browser** — it is not supported in Firefox or Safari. Opening the page in an unsupported browser shows a message asking you to switch.

## Features

- Open a local markdown file or an entire folder (shown as a collapsible file tree in the left sidebar).
- Files open in view-only (rendered) mode; click **Edit** (top right) to switch to editing.
- **Save** writes straight back to the original file. The first save of a file asks you to confirm the overwrite; later saves in the same session don't re-prompt.
- Dark mode, following your OS preference by default, overridable via the toggle (remembered across visits).
- The last folder you opened is remembered (via IndexedDB); reopen the app and click **Reconnect to Folder** to regain access (the browser requires a fresh permission grant each session).
- **Split View** — live side-by-side markdown source and rendered preview while editing.
- Collapsible **Outline** pane generated from the document's headings; click a heading to jump to it.
- **Ctrl/Cmd+F** opens an in-app find & replace overlay scoped to the open file (not the browser's native find).
- A formatting toolbar (bold, italic, strikethrough, headings, link, code, code block, blockquote, lists, horizontal rule) while editing.
- Keyboard shortcuts: **Ctrl/Cmd+S** to save, **Ctrl/Cmd+E** to toggle edit/view mode.

## Running locally

No build step is required — it's static HTML/CSS/JS. Serve the folder with any static file server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in Chrome or Edge. (Opening `index.html` directly via a `file://` URL also works for most features, though some browsers restrict the File System Access API on `file://` — a local server is recommended.)

## Tech

Two CDN dependencies, no framework and no bundler:
- [marked](https://marked.js.org/) — markdown parsing
- [DOMPurify](https://github.com/cure53/DOMPurify) — sanitizes rendered HTML before it's inserted into the page, since markdown files can embed raw HTML

## Security note

Rendered markdown is always passed through DOMPurify before being inserted into the DOM, since a `.md` file can contain arbitrary HTML (including `<script>` tags) that `marked` would otherwise pass through unmodified.
