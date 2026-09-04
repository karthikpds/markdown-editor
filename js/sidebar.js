// Sidebar drag-to-resize and collapse/expand, persisted to localStorage
// (plain numbers/booleans, so no need for the IndexedDB used for handles).

const WIDTH_KEY = 'mdEditorSidebarWidth';
const COLLAPSED_KEY = 'mdEditorSidebarCollapsed';
const MIN_WIDTH = 180;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 260;

function clamp(width) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

export function initSidebar({ appBodyEl, sidebarEl, resizerEl, collapseBtn }) {
  const savedWidth = parseInt(localStorage.getItem(WIDTH_KEY), 10);
  if (!Number.isNaN(savedWidth)) {
    sidebarEl.style.width = `${clamp(savedWidth)}px`;
  }

  function setCollapsed(isCollapsed) {
    appBodyEl.classList.toggle('sidebar-collapsed', isCollapsed);
    collapseBtn.setAttribute('aria-pressed', String(isCollapsed));
    collapseBtn.textContent = isCollapsed ? '»' : '«';
    collapseBtn.title = isCollapsed ? 'Show sidebar' : 'Hide sidebar';
    collapseBtn.setAttribute('aria-label', collapseBtn.title);
    localStorage.setItem(COLLAPSED_KEY, String(isCollapsed));
  }

  setCollapsed(localStorage.getItem(COLLAPSED_KEY) === 'true');

  collapseBtn.addEventListener('click', () => {
    setCollapsed(!appBodyEl.classList.contains('sidebar-collapsed'));
  });

  let dragging = false;
  let startX = 0;
  let startWidth = 0;

  resizerEl.addEventListener('pointerdown', (e) => {
    if (appBodyEl.classList.contains('sidebar-collapsed')) return;
    dragging = true;
    startX = e.clientX;
    startWidth = sidebarEl.getBoundingClientRect().width;
    resizerEl.setPointerCapture(e.pointerId);
    resizerEl.classList.add('dragging');
    document.body.style.userSelect = 'none';
  });

  resizerEl.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    sidebarEl.style.width = `${clamp(startWidth + (e.clientX - startX))}px`;
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    resizerEl.classList.remove('dragging');
    document.body.style.userSelect = '';
    localStorage.setItem(WIDTH_KEY, String(Math.round(sidebarEl.getBoundingClientRect().width)));
  }
  resizerEl.addEventListener('pointerup', endDrag);
  resizerEl.addEventListener('pointercancel', endDrag);

  resizerEl.addEventListener('dblclick', () => {
    sidebarEl.style.width = `${DEFAULT_WIDTH}px`;
    localStorage.setItem(WIDTH_KEY, String(DEFAULT_WIDTH));
  });
}
