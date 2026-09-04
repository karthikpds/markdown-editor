// Recent-folders list UI. Records are persisted in fileSystem.js's IndexedDB
// store; this module only renders them and wires click/remove handlers.

export function renderRecentFolders(containerEl, records, { activeId, onOpen, onRemove }) {
  containerEl.innerHTML = '';
  if (records.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-hint';
    p.textContent = 'No recent folders.';
    containerEl.appendChild(p);
    return;
  }

  for (const record of records) {
    const row = document.createElement('div');
    row.className = 'recent-folder-row';

    const btn = document.createElement('button');
    btn.className = `recent-folder${record.id === activeId ? ' active' : ''}`;
    btn.innerHTML = `<span class="tree-icon">📁</span> ${record.name}`;
    btn.title = `${record.name} — last opened ${new Date(record.lastOpened).toLocaleString()}`;
    btn.addEventListener('click', () => onOpen(record));

    const removeBtn = document.createElement('button');
    removeBtn.className = 'icon-btn recent-folder-remove';
    removeBtn.textContent = '✕';
    removeBtn.title = `Remove "${record.name}" from recent folders`;
    removeBtn.setAttribute('aria-label', `Remove ${record.name} from recent folders`);
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove(record);
    });

    row.appendChild(btn);
    row.appendChild(removeBtn);
    containerEl.appendChild(row);
  }
}
