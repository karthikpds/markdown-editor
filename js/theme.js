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

const THEME_CYCLE = ['light', 'dark', 'aura'];
const NEXT_ICON = { light: '🌙', dark: '🎨', aura: '☀️' };

function effectiveTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit) return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function nextTheme(theme) {
  const i = THEME_CYCLE.indexOf(theme);
  return THEME_CYCLE[(i + 1) % THEME_CYCLE.length];
}

function applyIconAndState(toggleBtnEl) {
  const theme = effectiveTheme();
  const next = nextTheme(theme);
  toggleBtnEl.textContent = NEXT_ICON[theme];
  toggleBtnEl.title = `Switch to ${next} theme`;
  toggleBtnEl.setAttribute('aria-label', `Switch to ${next} theme`);
}

export function initTheme(toggleBtnEl) {
  const stored = getStored();
  if (stored) document.documentElement.dataset.theme = stored;
  applyIconAndState(toggleBtnEl);

  toggleBtnEl.addEventListener('click', () => {
    const next = nextTheme(effectiveTheme());
    document.documentElement.dataset.theme = next;
    setStored(next);
    applyIconAndState(toggleBtnEl);
  });
}
