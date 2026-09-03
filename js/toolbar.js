// Formatting toolbar: each action manipulates textarea value/selection directly.

import { notifyProgrammaticChange } from './editor.js';

function wrapSelection(ta, before, after) {
  const { value, selectionStart: s, selectionEnd: e } = ta;
  const selected = value.slice(s, e);
  ta.value = value.slice(0, s) + before + selected + after + value.slice(e);
  const cursorStart = s + before.length;
  const cursorEnd = cursorStart + selected.length;
  ta.setSelectionRange(cursorStart, cursorEnd);
}

function lineBounds(value, start, end) {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = value.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = value.length;
  return { lineStart, lineEnd };
}

function togglePrefixLine(ta, prefix) {
  const { value, selectionStart: s, selectionEnd: e } = ta;
  const { lineStart, lineEnd } = lineBounds(value, s, e);
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const allPrefixed = lines.every((line) => line.startsWith(prefix) || line.trim() === '');
  const newLines = lines.map((line) => {
    if (line.trim() === '') return line;
    return allPrefixed ? line.slice(prefix.length) : prefix + line;
  });
  const newBlock = newLines.join('\n');
  ta.value = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
  ta.setSelectionRange(lineStart, lineStart + newBlock.length);
}

function toggleOrderedList(ta) {
  const { value, selectionStart: s, selectionEnd: e } = ta;
  const { lineStart, lineEnd } = lineBounds(value, s, e);
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const nonBlank = lines.filter((l) => l.trim() !== '');
  const allNumbered = nonBlank.length > 0 && nonBlank.every((l) => /^\d+\.\s+/.test(l));
  let n = 1;
  const newLines = lines.map((line) => {
    if (line.trim() === '') return line;
    if (allNumbered) return line.replace(/^\d+\.\s+/, '');
    const numbered = `${n}. ${line}`;
    n += 1;
    return numbered;
  });
  const newBlock = newLines.join('\n');
  ta.value = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
  ta.setSelectionRange(lineStart, lineStart + newBlock.length);
}

function wrapBlock(ta, before, after) {
  const { value, selectionStart: s, selectionEnd: e } = ta;
  const needsLeadingNewline = s > 0 && value[s - 1] !== '\n';
  const needsTrailingNewline = e < value.length && value[e] !== '\n';
  const lead = needsLeadingNewline ? '\n' : '';
  const trail = needsTrailingNewline ? '\n' : '';
  const selected = value.slice(s, e);
  const insertText = `${lead}${before}${selected}${after}${trail}`;
  ta.value = value.slice(0, s) + insertText + value.slice(e);
  const innerStart = s + lead.length + before.length;
  ta.setSelectionRange(innerStart, innerStart + selected.length);
}

function insertLink(ta) {
  const { value, selectionStart: s, selectionEnd: e } = ta;
  const selected = value.slice(s, e) || 'link text';
  const insertText = `[${selected}](url)`;
  ta.value = value.slice(0, s) + insertText + value.slice(e);
  const start = s + `[${selected}](`.length;
  const end = start + 'url'.length;
  ta.setSelectionRange(start, end);
}

function setHeadingLevel(ta, level) {
  const { value, selectionStart: s } = ta;
  const { lineStart, lineEnd } = lineBounds(value, s, s);
  const line = value.slice(lineStart, lineEnd);
  const stripped = line.replace(/^#{1,6}\s+/, '');
  const newLine = level > 0 ? `${'#'.repeat(level)} ${stripped}` : stripped;
  ta.value = value.slice(0, lineStart) + newLine + value.slice(lineEnd);
  ta.setSelectionRange(lineStart + newLine.length, lineStart + newLine.length);
}

function insertHr(ta) {
  const { value, selectionStart: s } = ta;
  const needsLeadingNewline = s > 0 && value[s - 1] !== '\n';
  const insertText = `${needsLeadingNewline ? '\n' : ''}\n---\n`;
  ta.value = value.slice(0, s) + insertText + value.slice(s);
  const pos = s + insertText.length;
  ta.setSelectionRange(pos, pos);
}

const BUTTONS = [
  { id: 'bold', label: 'B', title: 'Bold', apply: (ta) => wrapSelection(ta, '**', '**') },
  { id: 'italic', label: 'I', title: 'Italic', apply: (ta) => wrapSelection(ta, '_', '_') },
  { id: 'strike', label: 'S', title: 'Strikethrough', apply: (ta) => wrapSelection(ta, '~~', '~~') },
  { id: 'h1', label: 'H1', title: 'Heading 1', apply: (ta) => setHeadingLevel(ta, 1) },
  { id: 'h2', label: 'H2', title: 'Heading 2', apply: (ta) => setHeadingLevel(ta, 2) },
  { id: 'h3', label: 'H3', title: 'Heading 3', apply: (ta) => setHeadingLevel(ta, 3) },
  { id: 'link', label: '🔗', title: 'Link', apply: insertLink },
  { id: 'inline-code', label: '`</>`', title: 'Inline code', apply: (ta) => wrapSelection(ta, '`', '`') },
  { id: 'code-block', label: '{ }', title: 'Code block', apply: (ta) => wrapBlock(ta, '```\n', '\n```') },
  { id: 'blockquote', label: '"', title: 'Blockquote', apply: (ta) => togglePrefixLine(ta, '> ') },
  { id: 'ul', label: '•', title: 'Bulleted list', apply: (ta) => togglePrefixLine(ta, '- ') },
  { id: 'ol', label: '1.', title: 'Numbered list', apply: toggleOrderedList },
  { id: 'hr', label: '—', title: 'Horizontal rule', apply: insertHr },
];

export function buildToolbar(containerEl, textareaEl) {
  containerEl.innerHTML = '';
  for (const btn of BUTTONS) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = btn.label;
    el.title = btn.title;
    el.setAttribute('aria-label', btn.title);
    // mousedown (not click) + preventDefault so the button never steals focus
    // from the textarea before we read its selection.
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      btn.apply(textareaEl);
      notifyProgrammaticChange(textareaEl);
    });
    containerEl.appendChild(el);
  }
}
