const STORAGE_KEY = 'markdown-editor.theme';

function getStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStored(value) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable; theme choice just won't persist across reloads.
  }
}

function effectiveTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit) return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyIconAndState(toggleBtnEl) {
  const theme = effectiveTheme();
  toggleBtnEl.textContent = theme === 'dark' ? '☀️' : '🌙';
}

export function initTheme(toggleBtnEl) {
  const stored = getStored();
  if (stored) document.documentElement.dataset.theme = stored;
  applyIconAndState(toggleBtnEl);

  toggleBtnEl.addEventListener('click', () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setStored(next);
    applyIconAndState(toggleBtnEl);
  });
}
