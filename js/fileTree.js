// Collapsible folder tree rendered from a FileSystemDirectoryHandle. Subfolders
// are read lazily (only on first expand) and cached, since a directory handle
// offers no change-watching API — a manual refresh clears the cache.

import { listDirectoryShallow } from './fileSystem.js';

let activeFileButton = null;

function makeFolderNode(entry, depth, opts) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node';

  const btn = document.createElement('button');
  btn.className = 'tree-folder';
  btn.style.paddingLeft = `${6 + depth * 14}px`;
  btn.innerHTML = `<span class="chevron">▸</span><span class="tree-icon">📁</span> ${entry.name}`;

  const childrenEl = document.createElement('div');
  childrenEl.className = 'tree-children hidden';

  let loaded = false;
  let expanded = false;

  btn.addEventListener('click', async () => {
    expanded = !expanded;
    btn.querySelector('.chevron').textContent = expanded ? '▾' : '▸';
    childrenEl.classList.toggle('hidden', !expanded);
    if (expanded && !loaded) {
      loaded = true;
      const entries = await listDirectoryShallow(entry.handle);
      const withPaths = entries.map((e) => ({ ...e, path: `${entry.path}/${e.name}` }));
      renderEntries(childrenEl, withPaths, depth + 1, opts);
    }
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(childrenEl);
  return wrapper;
}

function makeFileNode(entry, depth, opts) {
  const btn = document.createElement('button');
  btn.className = 'tree-file';
  btn.style.paddingLeft = `${6 + depth * 14}px`;
  btn.innerHTML = `<span class="tree-icon">📄</span> ${entry.name}`;
  btn.dataset.path = entry.path;

  btn.addEventListener('click', async () => {
    const ok = await opts.onBeforeNavigate();
    if (!ok) return;
    if (activeFileButton) activeFileButton.classList.remove('active');
    btn.classList.add('active');
    activeFileButton = btn;
    opts.onFileClick(entry.handle, { path: entry.path, isFromTree: true });
  });

  return btn;
}

function renderEntries(containerEl, entries, depth, opts) {
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
      containerEl.appendChild(makeFileNode(entry, depth, opts));
    }
  }
}

export async function renderFileTree(containerEl, rootDirHandle, { onFileClick, onBeforeNavigate }) {
  activeFileButton = null;
  containerEl.innerHTML = '';
  const entries = await listDirectoryShallow(rootDirHandle);
  const withPaths = entries.map((e) => ({ ...e, path: e.name }));
  renderEntries(containerEl, withPaths, 0, { onFileClick, onBeforeNavigate });
}

export function clearActiveFile() {
  if (activeFileButton) {
    activeFileButton.classList.remove('active');
    activeFileButton = null;
  }
}
