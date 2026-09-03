// Renders the outline pane from parsed headings and handles click-to-navigate.

export function renderToc(containerEl, headings, { onHeadingClick }) {
  containerEl.innerHTML = '';
  if (!headings || headings.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-hint';
    p.textContent = 'No headings found.';
    containerEl.appendChild(p);
    return;
  }
  const minLevel = Math.min(...headings.map((h) => h.level));
  for (const heading of headings) {
    const btn = document.createElement('button');
    btn.className = 'toc-item';
    btn.textContent = heading.text || '(untitled)';
    btn.style.paddingLeft = `${6 + (heading.level - minLevel) * 12}px`;
    btn.title = heading.text;
    btn.addEventListener('click', () => onHeadingClick(heading.slug));
    containerEl.appendChild(btn);
  }
}

export function scrollToHeading(previewContentEl, slug) {
  if (!slug) return;
  const target = previewContentEl.querySelector(`#${CSS.escape(slug)}`);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
