// Wires the <textarea>: dirty-state tracking + a debounced change funnel that
// every content mutation (typing, toolbar, search/replace) ultimately passes
// through via a synthetic 'input' event.

const DEBOUNCE_MS = 200;

export function initEditor(textareaEl, { onChange, onDirtyChange }) {
  let originalContent = '';
  let debounceTimer = null;

  textareaEl.addEventListener('input', () => {
    const isDirty = textareaEl.value !== originalContent;
    onDirtyChange(isDirty);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => onChange(textareaEl.value), DEBOUNCE_MS);
  });

  return {
    loadContent(text) {
      textareaEl.value = text;
      originalContent = text;
      onDirtyChange(false);
      clearTimeout(debounceTimer);
      onChange(text);
    },
    markSaved() {
      originalContent = textareaEl.value;
      onDirtyChange(false);
    },
    getValue() {
      return textareaEl.value;
    },
  };
}

export function getSelection(textareaEl) {
  return {
    start: textareaEl.selectionStart,
    end: textareaEl.selectionEnd,
    text: textareaEl.value.slice(textareaEl.selectionStart, textareaEl.selectionEnd),
  };
}

export function setSelectionAndNotify(textareaEl, start, end) {
  textareaEl.focus();
  textareaEl.setSelectionRange(start, end);
}

// Every programmatic mutation of textarea.value should call this afterwards so
// editor.js's own 'input' listener re-fires and the change pipeline runs.
export function notifyProgrammaticChange(textareaEl) {
  textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
}
