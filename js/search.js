// Custom find/replace overlay operating directly on the editor textarea.
// Ctrl/Cmd+F is intercepted before the browser's native find bar can appear.

import { notifyProgrammaticChange } from './editor.js';

export function initSearch({ overlayEl, textareaEl, findInputEl, replaceInputEl, matchLabelEl,
  prevBtn, nextBtn, replaceOneBtn, replaceAllBtn, closeBtn, ensureEditableMode, showToast }) {
  let matches = [];
  let activeIndex = -1;

  function computeMatches() {
    const query = findInputEl.value;
    matches = [];
    if (query) {
      const text = textareaEl.value;
      let idx = 0;
      while (true) {
        const found = text.indexOf(query, idx);
        if (found === -1) break;
        matches.push(found);
        idx = found + query.length;
      }
    }
    if (activeIndex >= matches.length) activeIndex = matches.length - 1;
    updateLabel();
  }

  function updateLabel() {
    matchLabelEl.textContent = matches.length === 0
      ? '0/0'
      : `${activeIndex + 1}/${matches.length}`;
  }

  function goToMatch(index) {
    if (matches.length === 0) return;
    activeIndex = ((index % matches.length) + matches.length) % matches.length;
    const start = matches[activeIndex];
    const query = findInputEl.value;
    textareaEl.focus();
    textareaEl.setSelectionRange(start, start + query.length);
    updateLabel();
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

  function open() {
    ensureEditableMode();
    const selected = textareaEl.value.slice(textareaEl.selectionStart, textareaEl.selectionEnd);
    if (selected) findInputEl.value = selected;
    overlayEl.classList.remove('hidden');
    computeMatches();
    findInputEl.focus();
    findInputEl.select();
  }

  function close() {
    overlayEl.classList.add('hidden');
    textareaEl.focus();
  }

  function isOpen() {
    return !overlayEl.classList.contains('hidden');
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

  findInputEl.addEventListener('input', computeMatches);
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

  return { open, close, isOpen };
}
