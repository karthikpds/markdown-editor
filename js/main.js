import {
  isFileSystemAccessSupported, pickAndOpenFile, readFile, pickDirectory,
  queryDirPermission, requestDirPermission, saveFile,
  saveDirectoryHandle, loadDirectoryHandle,
} from './fileSystem.js';
import { renderMarkdown, extractHeadings } from './markdown.js';
import { initEditor } from './editor.js';
import { buildToolbar } from './toolbar.js';
import { initSearch } from './search.js';
import { renderToc, scrollToHeading } from './toc.js';
import { renderFileTree, clearActiveFile } from './fileTree.js';
import { initTheme } from './theme.js';

const unsupportedBanner = document.getElementById('unsupported-banner');
const btnOpenFile = document.getElementById('btn-open-file');
const btnOpenFolder = document.getElementById('btn-open-folder');
const btnReconnect = document.getElementById('btn-reconnect');
const btnRefreshTree = document.getElementById('btn-refresh-tree');
const btnToggleSplit = document.getElementById('btn-toggle-split');
const btnToggleTheme = document.getElementById('btn-toggle-theme');
const btnSave = document.getElementById('btn-save');
const btnToggleMode = document.getElementById('btn-toggle-mode');
const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
const sidebarEl = document.getElementById('sidebar');
const fileTreeEl = document.getElementById('file-tree');
const tocContainerEl = document.getElementById('toc-container');
const contentAreaEl = document.getElementById('content-area');
const formatToolbarEl = document.getElementById('format-toolbar');
const editorTextarea = document.getElementById('editor');
const previewContentEl = document.getElementById('preview-content');
const toastContainer = document.getElementById('toast-container');

const state = {
  rootDirHandle: null,
  rootDirName: null,
  currentFileHandle: null,
  currentFileName: null,
  currentFilePath: null,
  isFromTree: false,
  isDirty: false,
  mode: 'view', // 'view' | 'edit'
  splitEnabled: false,
  confirmedOverwriteHandles: new Set(),
};

let editorApi = null;

function showToast(message, isError = false) {
  const el = document.createElement('div');
  el.className = `toast${isError ? ' error' : ''}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function updateHeaderButtons() {
  const hasFile = !!state.currentFileHandle;
  btnSave.disabled = !hasFile;
  btnToggleMode.disabled = !hasFile;
  btnToggleMode.textContent = state.mode === 'edit' ? 'View' : 'Edit';
  btnToggleSplit.disabled = !(hasFile && state.mode === 'edit');
  btnToggleSplit.setAttribute('aria-pressed', String(state.splitEnabled));
  document.title = hasFile
    ? `${state.isDirty ? '● ' : ''}${state.currentFileName} — Markdown Editor`
    : 'Markdown Editor';
}

function updateModeClasses() {
  contentAreaEl.classList.remove('mode-view', 'mode-edit-solo', 'mode-edit-split');
  if (state.mode === 'view') {
    contentAreaEl.classList.add('mode-view');
    formatToolbarEl.classList.add('hidden');
  } else {
    contentAreaEl.classList.add(state.splitEnabled ? 'mode-edit-split' : 'mode-edit-solo');
    formatToolbarEl.classList.remove('hidden');
  }
  updateHeaderButtons();
}

function refreshPreviewAndToc(text) {
  previewContentEl.innerHTML = renderMarkdown(text);
  const headings = extractHeadings(text);
  renderToc(tocContainerEl, headings, {
    onHeadingClick: (slug) => {
      if (state.mode === 'edit' && !state.splitEnabled) {
        state.splitEnabled = true;
        updateModeClasses();
      }
      requestAnimationFrame(() => scrollToHeading(previewContentEl, slug));
    },
  });
}

function onDirtyChange(isDirty) {
  state.isDirty = isDirty;
  updateHeaderButtons();
}

async function confirmDiscardIfDirty() {
  if (!state.isDirty) return true;
  return window.confirm(`Discard unsaved changes to "${state.currentFileName}"?`);
}

function setCurrentFile(handle, text, { path, isFromTree }) {
  state.currentFileHandle = handle;
  state.currentFileName = handle.name;
  state.currentFilePath = path;
  state.isFromTree = isFromTree;
  state.mode = 'view';
  state.splitEnabled = false;
  editorApi.loadContent(text);
  updateModeClasses();
}

async function handleOpenFile() {
  if (!(await confirmDiscardIfDirty())) return;
  try {
    const result = await pickAndOpenFile();
    if (!result) return;
    clearActiveFile();
    setCurrentFile(result.handle, result.text, { path: null, isFromTree: false });
  } catch (err) {
    showToast(`Could not open file: ${err.message}`, true);
  }
}

async function renderTree() {
  try {
    await renderFileTree(fileTreeEl, state.rootDirHandle, {
      onBeforeNavigate: confirmDiscardIfDirty,
      onFileClick: async (handle, { path, isFromTree }) => {
        try {
          const { text } = await readFile(handle);
          setCurrentFile(handle, text, { path, isFromTree });
        } catch (err) {
          showToast(`Could not read file: ${err.message}`, true);
        }
      },
    });
  } catch (err) {
    showToast(`Could not read folder: ${err.message}`, true);
  }
}

async function handleOpenFolder() {
  try {
    const dirHandle = await pickDirectory();
    if (!dirHandle) return;
    state.rootDirHandle = dirHandle;
    state.rootDirName = dirHandle.name;
    btnReconnect.classList.add('hidden');
    btnRefreshTree.classList.remove('hidden');
    await renderTree();
    await saveDirectoryHandle(dirHandle);
  } catch (err) {
    showToast(`Could not open folder: ${err.message}`, true);
  }
}

async function handleReconnect() {
  if (!state.rootDirHandle) return;
  try {
    const perm = await requestDirPermission(state.rootDirHandle);
    if (perm === 'granted') {
      btnReconnect.classList.add('hidden');
      btnRefreshTree.classList.remove('hidden');
      await renderTree();
    } else {
      showToast('Permission to access the folder was not granted.', true);
    }
  } catch (err) {
    showToast(`Could not reconnect to folder: ${err.message}`, true);
  }
}

async function tryRestorePersistedFolder() {
  const dirHandle = await loadDirectoryHandle();
  if (!dirHandle) return;
  state.rootDirHandle = dirHandle;
  state.rootDirName = dirHandle.name;
  try {
    const perm = await queryDirPermission(dirHandle);
    if (perm === 'granted') {
      btnRefreshTree.classList.remove('hidden');
      await renderTree();
    } else {
      btnReconnect.textContent = `Reconnect to "${dirHandle.name}"`;
      btnReconnect.classList.remove('hidden');
    }
  } catch (err) {
    console.warn('Could not check folder permission:', err);
  }
}

function handleToggleMode() {
  if (!state.currentFileHandle) return;
  state.mode = state.mode === 'edit' ? 'view' : 'edit';
  updateModeClasses();
  if (state.mode === 'edit') editorTextarea.focus();
}

function handleToggleSplit() {
  if (state.mode !== 'edit') return;
  state.splitEnabled = !state.splitEnabled;
  updateModeClasses();
}

async function handleSaveClick() {
  if (!state.currentFileHandle) return;
  const handle = state.currentFileHandle;
  if (!state.confirmedOverwriteHandles.has(handle)) {
    const confirmed = window.confirm(
      `Save changes to "${state.currentFileName}"? This will overwrite the original file.`,
    );
    if (!confirmed) return;
    state.confirmedOverwriteHandles.add(handle);
  }
  try {
    await saveFile(handle, editorApi.getValue());
    editorApi.markSaved();
    showToast(`Saved "${state.currentFileName}".`);
  } catch (err) {
    showToast(`Could not save file: ${err.message}`, true);
  }
}

function wireButtons() {
  btnOpenFile.addEventListener('click', handleOpenFile);
  btnOpenFolder.addEventListener('click', handleOpenFolder);
  btnReconnect.addEventListener('click', handleReconnect);
  btnRefreshTree.addEventListener('click', renderTree);
  btnToggleMode.addEventListener('click', handleToggleMode);
  btnToggleSplit.addEventListener('click', handleToggleSplit);
  btnSave.addEventListener('click', handleSaveClick);
  btnSidebarToggle.addEventListener('click', () => sidebarEl.classList.toggle('open'));

  document.querySelectorAll('.section-header').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('.sidebar-section').classList.toggle('collapsed');
    });
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === 's') {
      e.preventDefault();
      handleSaveClick();
    } else if (key === 'e') {
      e.preventDefault();
      handleToggleMode();
    }
  });
}

function setupBeforeUnload() {
  window.addEventListener('beforeunload', (e) => {
    if (state.isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

function ensureEditableMode() {
  if (!state.currentFileHandle) return;
  if (state.mode === 'view') {
    state.mode = 'edit';
    updateModeClasses();
  }
}

async function init() {
  if (!isFileSystemAccessSupported()) {
    unsupportedBanner.classList.remove('hidden');
    return;
  }

  initTheme(btnToggleTheme);
  editorApi = initEditor(editorTextarea, { onChange: refreshPreviewAndToc, onDirtyChange });
  buildToolbar(formatToolbarEl, editorTextarea);
  initSearch({
    overlayEl: document.getElementById('search-overlay'),
    textareaEl: editorTextarea,
    findInputEl: document.getElementById('search-find'),
    replaceInputEl: document.getElementById('search-replace'),
    matchLabelEl: document.getElementById('search-match-label'),
    prevBtn: document.getElementById('search-prev'),
    nextBtn: document.getElementById('search-next'),
    replaceOneBtn: document.getElementById('search-replace-one'),
    replaceAllBtn: document.getElementById('search-replace-all'),
    closeBtn: document.getElementById('search-close'),
    ensureEditableMode,
    showToast,
  });

  wireButtons();
  setupKeyboardShortcuts();
  setupBeforeUnload();
  updateModeClasses();

  await tryRestorePersistedFolder();
}

init();
