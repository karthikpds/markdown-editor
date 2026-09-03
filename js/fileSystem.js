// File System Access API wrapper + IndexedDB persistence of the last-opened folder.

const DB_NAME = 'markdown-editor-db';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const DIR_KEY = 'lastDirectory';

export function isFileSystemAccessSupported() {
  return typeof window.showOpenFilePicker === 'function'
    && typeof window.showDirectoryPicker === 'function';
}

// Opens the native file picker. Returns { handle, file, text } or null if the
// user cancelled (AbortError), which is the common case and not an error.
export async function pickAndOpenFile() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: 'Markdown files',
        accept: { 'text/markdown': ['.md', '.markdown'] },
      }],
      excludeAcceptAllOption: false,
      multiple: false,
    });
    const file = await handle.getFile();
    const text = await file.text();
    return { handle, file, text };
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

// Reads a file's current contents from an already-open handle (used when a
// tree click opens a file we haven't read yet).
export async function readFile(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  return { file, text };
}

export async function pickDirectory() {
  try {
    // Request readwrite up front so later saves of files inside this folder
    // don't need a second permission prompt.
    return await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

export async function queryDirPermission(dirHandle) {
  return dirHandle.queryPermission({ mode: 'readwrite' });
}

// Must be invoked directly inside a user-gesture handler (e.g. a button click)
// or the browser will silently resolve to 'prompt' without showing anything.
export async function requestDirPermission(dirHandle) {
  return dirHandle.requestPermission({ mode: 'readwrite' });
}

async function verifyWritePermission(fileHandle) {
  const opts = { mode: 'readwrite' };
  if ((await fileHandle.queryPermission(opts)) === 'granted') return true;
  return (await fileHandle.requestPermission(opts)) === 'granted';
}

// Writes `contents` to `fileHandle`, overwriting it. Permission is checked as
// the very first step (before any other await) to stay inside the calling
// user gesture's transient-activation window.
export async function saveFile(fileHandle, contents) {
  const granted = await verifyWritePermission(fileHandle);
  if (!granted) {
    throw new Error('Write permission was not granted for this file.');
  }
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(contents);
  } finally {
    await writable.close();
  }
}

const SKIP_NAMES = new Set(['node_modules', '.git']);

// Reads exactly one level of a directory (no recursion, to stay fast on huge
// folders). Folders are always included for navigation; files are filtered to
// markdown extensions. Sorted folders-first, then alphabetically.
export async function listDirectoryShallow(dirHandle) {
  const folders = [];
  const files = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (name.startsWith('.') || SKIP_NAMES.has(name)) continue;
    if (handle.kind === 'directory') {
      folders.push({ type: 'folder', name, handle });
    } else if (/\.(md|markdown)$/i.test(name)) {
      files.push({ type: 'file', name, handle });
    }
  }
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  folders.sort(byName);
  files.sort(byName);
  return [...folders, ...files];
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirectoryHandle(dirHandle) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(dirHandle, DIR_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not persist folder handle:', err);
  }
}

export async function loadDirectoryHandle() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(DIR_KEY);
      req.onsuccess = () => resolve(req.result || undefined);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not load persisted folder handle:', err);
    return undefined;
  }
}

export async function clearDirectoryHandle() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(DIR_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not clear persisted folder handle:', err);
  }
}
