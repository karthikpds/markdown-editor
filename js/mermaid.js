// Lazily loads Mermaid (a ~3.5MB library) only when a document actually
// contains a mermaid code block, instead of on every page load.

const MERMAID_SRC = 'https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.min.js';
const MERMAID_INTEGRITY = 'sha256-WB7X10vZBI0OOpE2OSfXLvIpQtdyJUayf3zCnjU5Drg=';

let loadPromise = null;

function loadMermaid() {
  if (window.mermaid) return Promise.resolve(window.mermaid);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = MERMAID_SRC;
    script.integrity = MERMAID_INTEGRITY;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(window.mermaid);
    script.onerror = () => reject(new Error('Failed to load Mermaid from CDN'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

function effectiveAppTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit) return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Renders every <pre class="mermaid"> under containerEl in place, matching
// the app's current light/dark theme.
export async function renderMermaidDiagrams(containerEl) {
  const nodes = containerEl.querySelectorAll('pre.mermaid');
  if (nodes.length === 0) return;
  try {
    const mermaid = await loadMermaid();
    mermaid.initialize({ startOnLoad: false, theme: effectiveAppTheme() === 'dark' ? 'dark' : 'default' });
    await mermaid.run({ nodes: Array.from(nodes), suppressErrors: true });
  } catch (err) {
    console.error('Mermaid render failed:', err);
  }
}
