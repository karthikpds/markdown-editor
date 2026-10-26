// Custom find/replace overlay. In edit mode it operates directly on the editor
// textarea (find + replace); in view mode it searches the rendered preview
// (find only) so opening it never switches modes. Ctrl/Cmd+F is intercepted
// before the browser's native find bar can appear.

import { notifyProgrammaticChange } from './editor.js';

const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, td, th, pre, blockquote, div';
const supportsHighlights = typeof CSS !== 'undefined' && 'highlights' in CSS
  && typeof Highlight !== 'undefined';

export function initSearch({ overlayEl, textareaEl, previewEl, previewPaneEl, findInputEl,
  replaceInputEl, matchLabelEl, prevBtn, nextBtn, replaceOneBtn, replaceAllBtn, closeBtn,
  isViewMode, showToast }) {
  let matches = [];
  let activeIndex = -1;
  // View mode only: the preview's text nodes with their offsets into the
  // concatenated text that matches index into, and one Range per match.
  let segments = [];
  let ranges = [];

  // Concatenates the preview's text so matches can span inline elements
  // (e.g. "foo **bar**"); a newline between blocks stops them spanning those.
  function collectPreviewText() {
    segments = [];
    let text = '';
    let lastBlock = null;
    const walker = document.createTreeWalker(previewEl, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement.closest('style, script')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT),
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const block = node.parentElement.closest(BLOCK_SELECTOR);
      if (lastBlock && block !== lastBlock) text += '\n';
      lastBlock = block;
      segments.push({ node, start: text.length });
      text += node.data;
    }
    return text;
  }

  function segmentAt(pos) {
    let lo = 0;
    let hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segments[mid].start <= pos) lo = mid; else hi = mid - 1;
    }
    return segments[lo];
  }

  function toRange(start, end) {
    const first = segmentAt(start);
    const last = segmentAt(end - 1);
    const range = document.createRange();
    range.setStart(first.node, start - first.start);
    range.setEnd(last.node, end - last.start);
    return range;
  }

  function clearHighlights() {
    if (!supportsHighlights) return;
    CSS.highlights.delete('search-match');
    CSS.highlights.delete('search-active');
  }

  function paintHighlights() {
    if (!supportsHighlights) return;
    if (!isViewMode() || !isOpen() || ranges.length === 0) {
      clearHighlights();
      return;
    }
    const all = new Highlight();
    ranges.forEach((range) => all.add(range));
    CSS.highlights.set('search-match', all);
    if (activeIndex === -1) {
      CSS.highlights.delete('search-active');
      return;
    }
    const active = new Highlight(ranges[activeIndex]);
    active.priority = 1;
    CSS.highlights.set('search-active', active);
  }

  function computeMatches() {
    const query = findInputEl.value;
    const viewMode = isViewMode();
    matches = [];
    ranges = [];
    if (query) {
      const text = viewMode ? collectPreviewText() : textareaEl.value;
      let idx = 0;
      while (true) {
        const found = text.indexOf(query, idx);
        if (found === -1) break;
        matches.push(found);
        idx = found + query.length;
      }
    }
    if (viewMode) ranges = matches.map((m) => toRange(m, m + query.length));
    if (activeIndex >= matches.length) activeIndex = matches.length - 1;
    updateLabel();
    paintHighlights();
  }

  function updateLabel() {
    matchLabelEl.textContent = matches.length === 0
      ? '0/0'
      : `${activeIndex + 1}/${matches.length}`;
  }

  // Scrolls the preview pane only if the match isn't already visible, and
  // leaves focus in the find input so Enter keeps stepping through matches.
  function revealRange(range) {
    const rect = range.getBoundingClientRect();
    const paneRect = previewPaneEl.getBoundingClientRect();
    if (rect.top < paneRect.top || rect.bottom > paneRect.bottom) {
      previewPaneEl.scrollTop += rect.top - paneRect.top - (paneRect.height - rect.height) / 2;
    }
    if (!supportsHighlights) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  function goToMatch(index) {
    if (matches.length === 0) return;
    activeIndex = ((index % matches.length) + matches.length) % matches.length;
    if (isViewMode()) {
      revealRange(ranges[activeIndex]);
    } else {
      const start = matches[activeIndex];
      textareaEl.focus();
      textareaEl.setSelectionRange(start, start + findInputEl.value.length);
    }
    updateLabel();
    paintHighlights();
  }

  function findNext() {
    computeMatches();
    goToMatch(activeIndex + 1);
  }

  function findPrev() {
    computeMatches();
    goToMatch(activeIndex - 1 < 0 ? matches.length - 1 : activeIndex - 1);
  }

  function replaceOne() {
    if (matches.length === 0 || activeIndex === -1) {
      findNext();
      if (matches.length === 0) return;
    }
    const query = findInputEl.value;
    const replacement = replaceInputEl.value;
    const start = matches[activeIndex];
    const value = textareaEl.value;
    textareaEl.value = value.slice(0, start) + replacement + value.slice(start + query.length);
    notifyProgrammaticChange(textareaEl);
    const nextPos = start + replacement.length;
    computeMatches();
    const nextIdx = matches.findIndex((m) => m >= nextPos);
    goToMatch(nextIdx === -1 ? 0 : nextIdx);
  }

  function replaceAll() {
    const query = findInputEl.value;
    if (!query) return;
    const replacement = replaceInputEl.value;
    const value = textareaEl.value;
    const parts = value.split(query);
    const count = parts.length - 1;
    if (count === 0) {
      showToast('No matches to replace.');
      return;
    }
    textareaEl.value = parts.join(replacement);
    notifyProgrammaticChange(textareaEl);
    computeMatches();
    showToast(`Replaced ${count} occurrence${count === 1 ? '' : 's'}.`);
  }

  // The replace row only makes sense while editing.
  function applyMode() {
    const viewMode = isViewMode();
    overlayEl.classList.toggle('find-only', viewMode);
    overlayEl.setAttribute('aria-label', viewMode ? 'Find' : 'Find and replace');
  }

  function selectedText() {
    if (!isViewMode()) {
      return textareaEl.value.slice(textareaEl.selectionStart, textareaEl.selectionEnd);
    }
    const selection = window.getSelection();
    if (selection.isCollapsed || !previewEl.contains(selection.anchorNode)) return '';
    const text = selection.toString();
    return text.includes('\n') ? '' : text;
  }

  function open() {
    const selected = selectedText();
    if (selected) findInputEl.value = selected;
    applyMode();
    overlayEl.classList.remove('hidden');
    computeMatches();
    if (isViewMode() && matches.length > 0) goToMatch(Math.max(activeIndex, 0));
    findInputEl.focus();
    findInputEl.select();
  }

  function close() {
    overlayEl.classList.add('hidden');
    clearHighlights();
    if (!isViewMode()) textareaEl.focus();
  }

  function isOpen() {
    return !overlayEl.classList.contains('hidden');
  }

  // Re-syncs an open overlay after the mode flips or the preview re-renders.
  function refresh() {
    if (!isOpen()) return;
    applyMode();
    computeMatches();
  }

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      open();
    } else if (e.key === 'Escape' && isOpen()) {
      close();
    }
  });

  findInputEl.addEventListener('input', () => {
    computeMatches();
    // Editing jumps via the textarea, which would steal focus mid-typing;
    // the preview doesn't, so it can search as you type.
    if (isViewMode() && matches.length > 0) goToMatch(0);
  });
  findInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) findPrev(); else findNext();
    }
  });

  prevBtn.addEventListener('click', findPrev);
  nextBtn.addEventListener('click', findNext);
  replaceOneBtn.addEventListener('click', replaceOne);
  replaceAllBtn.addEventListener('click', replaceAll);
  closeBtn.addEventListener('click', close);

  return { open, close, isOpen, refresh };
}
