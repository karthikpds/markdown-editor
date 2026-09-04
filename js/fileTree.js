// Collapsible folder tree rendered from a FileSystemDirectoryHandle. Subfolders
// are read lazily (only on first expand) and cached, since a directory handle
// offers no change-watching API — a manual refresh clears the cache. Copying a
// file or creating one in a folder inserts a single new row in place instead
// of re-listing, so sibling folders keep their expand/load state.

import { listDirectoryShallow } from './fileSystem.js';

let activeFileButton = null;

function markActive(btn) {
  if (activeFileButton) activeFileButton.classList.remove('active');
  btn.classList.add('active');
  activeFileButton = btn;
}

// Inserts (or, for a same-name overwrite, replaces) a file row in sorted
// order, after all folder rows. Also clears the "(empty)" placeholder.
function insertFileNode(containerEl, newRow) {
  const emptyHint = containerEl.querySelector(':scope > p.empty-hint');
  if (emptyHint) emptyHint.remove();

  const existing = Array.from(containerEl.children).find(
    (child) => child.classList.contains('tree-file-row') && child.dataset.name === newRow.dataset.name,
  );
  if (existing) {
    existing.replaceWith(newRow);
    return;
  }

  const insertBefore = Array.from(containerEl.children).find((child) => {
    if (child.classList.contains('tree-node')) return false;
    return child.dataset.name.localeCompare(newRow.dataset.name, undefined, { sensitivity: 'base' }) > 0;
  });
  containerEl.insertBefore(newRow, insertBefore || null);
}

function makeFolderNode(entry, depth, opts) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node';

  const headerRow = document.createElement('div');
  headerRow.className = 'tree-folder-row';

  const btn = document.createElement('button');
  btn.className = 'tree-folder';
  btn.style.paddingLeft = `${6 + depth * 14}px`;
  btn.innerHTML = `<span class="chevron">▸</span><span class="tree-icon">📁</span> ${entry.name}`;

  const addBtn = document.createElement('button');
  addBtn.className = 'icon-btn tree-add-file';
  addBtn.textContent = '+';
  addBtn.title = `New file in "${entry.name}"`;
  addBtn.setAttribute('aria-label', `New file in ${entry.name}`);

  headerRow.appendChild(btn);
  headerRow.appendChild(addBtn);

  const childrenEl = document.createElement('div');
  childrenEl.className = 'tree-children hidden';

  let loaded = false;
  let expanded = false;

  async function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    const entries = await listDirectoryShallow(entry.handle);
    const withPaths = entries.map((e) => ({ ...e, path: `${entry.path}/${e.name}` }));
    renderEntries(childrenEl, withPaths, depth + 1, opts, entry.handle);
  }

  function setExpanded(value) {
    expanded = value;
    btn.querySelector('.chevron').textContent = expanded ? '▾' : '▸';
    childrenEl.classList.toggle('hidden', !expanded);
  }

  btn.addEventListener('click', async () => {
    setExpanded(!expanded);
    if (expanded) await ensureLoaded();
  });

  addBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const wasLoaded = loaded;
    const result = await opts.onCreateFile(entry.handle, entry.path);
    if (!result) return;
    if (!expanded) setExpanded(true);
    if (wasLoaded) {
      const newRow = makeFileNode(
        { type: 'file', name: result.name, handle: result.handle, path: result.path },
        depth + 1, opts, childrenEl, entry.handle,
      );
      insertFileNode(childrenEl, newRow);
      markActive(newRow.querySelector('.tree-file'));
    } else {
      await ensureLoaded();
      const newBtn = childrenEl.querySelector(`.tree-file[data-path="${CSS.escape(result.path)}"]`);
      if (newBtn) markActive(newBtn);
    }
  });

  wrapper.appendChild(headerRow);
  wrapper.appendChild(childrenEl);
  return wrapper;
}

function makeFileNode(entry, depth, opts, containerEl, parentDirHandle) {
  const row = document.createElement('div');
  row.className = 'tree-file-row';
  row.dataset.name = entry.name;

  const btn = document.createElement('button');
  btn.className = 'tree-file';
  btn.style.paddingLeft = `${6 + depth * 14}px`;
  btn.innerHTML = `<span class="tree-icon">📄</span> ${entry.name}`;
  btn.dataset.path = entry.path;

  btn.addEventListener('click', async () => {
    const ok = await opts.onBeforeNavigate();
    if (!ok) return;
    markActive(btn);
    opts.onFileClick(entry.handle, { path: entry.path, isFromTree: true });
  });

  const copyBtn = document.createElement('button');
  copyBtn.className = 'icon-btn tree-copy-file';
  copyBtn.textContent = '⧉';
  copyBtn.title = `Copy "${entry.name}"`;
  copyBtn.setAttribute('aria-label', `Copy ${entry.name}`);
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const result = await opts.onCopyFile(entry.handle, parentDirHandle, entry.path);
    if (!result) return;
    const newRow = makeFileNode(
      { type: 'file', name: result.name, handle: result.handle, path: result.path },
      depth, opts, containerEl, parentDirHandle,
    );
    insertFileNode(containerEl, newRow);
    markActive(newRow.querySelector('.tree-file'));
  });

  row.appendChild(btn);
  row.appendChild(copyBtn);
  return row;
}

function renderEntries(containerEl, entries, depth, opts, parentDirHandle) {
  containerEl.innerHTML = '';
  if (entries.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-hint';
    p.textContent = '(empty)';
    containerEl.appendChild(p);
    return;
  }
  for (const entry of entries) {
    if (entry.type === 'folder') {
      containerEl.appendChild(makeFolderNode(entry, depth, opts));
    } else {
      containerEl.appendChild(makeFileNode(entry, depth, opts, containerEl, parentDirHandle));
    }
  }
}

export async function renderFileTree(containerEl, rootDirHandle, opts) {
  activeFileButton = null;
  containerEl.innerHTML = '';
  const entries = await listDirectoryShallow(rootDirHandle);
  const withPaths = entries.map((e) => ({ ...e, path: e.name }));
  renderEntries(containerEl, withPaths, 0, opts, rootDirHandle);
}

export function clearActiveFile() {
  if (activeFileButton) {
    activeFileButton.classList.remove('active');
    activeFileButton = null;
  }
}
