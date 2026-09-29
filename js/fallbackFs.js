// Compatibility-mode file backend for browsers without the File System
// Access API (Firefox, Safari, ...).
//
// Without that API there is no way to write back to the original file, so:
//  - "Open File" reads via a hidden <input type="file">; "Save" downloads a
//    copy of the edited text instead of overwriting the original.
//  - "Open Folder" uses <input type="file" webkitdirectory> (supported by
//    Firefox and Safari) to build an in-memory tree of the folder's markdown
//    files. Files open read-only from disk; saving downloads a copy.
//
// Virtual handles mirror the shape fileSystem.js works with (a `name`
// property plus a marker), so main.js and fileTree.js operate on either
// backend without further branching.

export const VIRTUAL_FILE = 'virtual-file';
export const VIRTUAL_DIR = 'virtual-dir';

export function isVirtualHandle(handle) {
  return (
    !!handle &&
    (handle.__virtual === VIRTUAL_FILE || handle.__virtual === VIRTUAL_DIR)
  );
}

export function isVirtualFileHandle(handle) {
  return !!handle && handle.__virtual === VIRTUAL_FILE;
}

export function isVirtualDirHandle(handle) {
  return !!handle && handle.__virtual === VIRTUAL_DIR;
}

function makeFileInput(directory) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.md,.markdown,.txt,text/markdown,text/plain';
  if (directory) input.setAttribute('webkitdirectory', '');
  input.style.display = 'none';
  return input;
}

// Opens the native picker and resolves with the chosen FileList, or null if
// the user cancelled. The 'cancel' event covers Chromium/Safari; the focus
// fallback covers browsers that fire neither 'change' nor 'cancel'.
function pickFiles(directory) {
  return new Promise((resolve) => {
    const input = makeFileInput(directory);
    let done = false;
    const finish = (files) => {
      if (done) return;
      done = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(files);
    };
    const onFocus = () => {
      // The picker dialog just closed: if 'change' didn't fire, the user
      // cancelled. The timeout lets a pending 'change' event win the race.
      setTimeout(() => {
        if (!input.files || input.files.length === 0) finish(null);
      }, 300);
    };
    input.addEventListener('change', () => finish(input.files));
    input.addEventListener('cancel', () => finish(null));
    window.addEventListener('focus', onFocus);
    document.body.appendChild(input);
    input.click();
  });
}

export function supportsDirectoryInput() {
  return 'webkitdirectory' in document.createElement('input');
}

// Builds a virtual directory tree from the FileList of a webkitdirectory
// input. Each File carries webkitRelativePath like "notes/projects/a.md".
// Dot-folders/files and node_modules/.git are skipped, mirroring
// listDirectoryShallow in fileSystem.js. Returns the virtual dir handle for
// the top folder, or null when nothing usable was picked.
export function buildVirtualTree(fileList) {
  const files = Array.from(fileList || []).filter((f) => {
    const rel = f.webkitRelativePath || f.name;
    const parts = rel.split('/');
    if (parts.some((p) => p.startsWith('.'))) return false;
    if (parts.includes('node_modules') || parts.includes('.git')) return false;
    return true;
  });
  if (files.length === 0) return null;

  const rootName =
    (files[0].webkitRelativePath || files[0].name).split('/')[0] || 'folder';
  const root = {
    __virtual: VIRTUAL_DIR,
    kind: 'directory',
    name: rootName,
    children: new Map(),
  };

  for (const file of files) {
    const rel = file.webkitRelativePath || file.name;
    const parts = rel.split('/');
    parts.shift(); // drop the root folder name
    if (parts.length === 0) continue;
    const fileName = parts.pop();
    if (!/\.(md|markdown)$/i.test(fileName)) continue;
    let node = root;
    for (const part of parts) {
      if (!node.children.has(part)) {
        node.children.set(part, {
          __virtual: VIRTUAL_DIR,
          kind: 'directory',
          name: part,
          children: new Map(),
        });
      }
      node = node.children.get(part);
    }
    node.children.set(fileName, {
      __virtual: VIRTUAL_FILE,
      kind: 'file',
      name: fileName,
      file,
    });
  }
  return root;
}

// Returns { handle, text } like fileSystem.pickAndOpenFile, or null on cancel.
export async function pickFallbackFile() {
  const files = await pickFiles(false);
  if (!files || files.length === 0) return null;
  const file = files[0];
  const handle = { __virtual: VIRTUAL_FILE, kind: 'file', name: file.name, file };
  const text = await file.text();
  return { handle, text };
}

// Returns a virtual directory handle, or null on cancel.
export async function pickFallbackDirectory() {
  const files = await pickFiles(true);
  if (!files || files.length === 0) return null;
  return buildVirtualTree(files);
}

// "Save" in compatibility mode: download a copy of the contents.
export function downloadFile(name, contents) {
  const blob = new Blob([contents], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
