# Markdown Editor

A lightweight, client-side markdown viewer/editor that runs entirely in the browser — no server, no build step, no install. Open a local `.md` file or folder, view it rendered, edit it, and save straight back to disk.

**Live app:** open `index.html` via GitHub Pages, or serve this folder locally.

## Requirements

Full save-back-to-disk uses the browser's [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API), which is only available in **Chrome, Edge, or another Chromium-based browser**.

Other browsers (Firefox, Safari) run in **compatibility mode**: you can still open files and folders to view and edit them, but **Save downloads a copy** of the file instead of overwriting the original, and the last-opened folder isn't remembered between visits. For the full experience, open the page in a Chromium browser.

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

No framework, no bundler, no build step — and no required CDN dependencies. [marked](https://marked.js.org/) (markdown parsing) and [DOMPurify](https://github.com/cure53/DOMPurify) (sanitizing rendered HTML, since markdown files can embed raw HTML) are vendored under `vendor/`, so the app works fully offline. Mermaid (diagram rendering, ~3.5MB) is the only network dependency and loads lazily from a CDN only when a document actually contains a mermaid code block.

## Security note

Rendered markdown is always passed through DOMPurify before being inserted into the DOM, since a `.md` file can contain arbitrary HTML (including `<script>` tags) that `marked` would otherwise pass through unmodified.

File and folder names (in the file tree and Recent Folders list) are also untrusted, since they come straight from disk and can contain characters like `<` and `&`. They are inserted as text nodes, never parsed as HTML.
