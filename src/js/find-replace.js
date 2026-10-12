/**
 * Notepad++ (macOS) Find & Replace Dialog Controller
 */

class FindReplaceManager {
  constructor(editorManager) {
    this.editorManager = editorManager;
    this.modalEl = document.getElementById('find-replace-modal');
    this.findInput = document.getElementById('find-input');
    this.replaceInput = document.getElementById('replace-input');
    this.replaceRow = document.getElementById('replace-row');
    this.statusEl = document.getElementById('find-status');

    this.optCase = document.getElementById('find-opt-case');
    this.optWord = document.getElementById('find-opt-word');
    this.optWrap = document.getElementById('find-opt-wrap');
    this.optRegex = document.getElementById('find-opt-regex');

    this.currentMode = 'find';
    this.currentMatches = [];
    this.currentIndex = -1;

    this._bindEvents();
  }

  _bindEvents() {
    // Close button
    document.getElementById('btn-close-find').addEventListener('click', () => this.close());

    // Tab buttons (Find, Replace, Mark)
    const tabBtns = this.modalEl.querySelectorAll('.tab-nav-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setMode(btn.dataset.findtab);
      });
    });

    // Action buttons
    document.getElementById('btn-find-next').addEventListener('click', () => this.findNext());
    document.getElementById('btn-find-prev').addEventListener('click', () => this.findPrev());
    document.getElementById('btn-find-count').addEventListener('click', () => this.countMatches());
    document.getElementById('btn-replace-one').addEventListener('click', () => this.replaceOne());
    document.getElementById('btn-replace-all').addEventListener('click', () => this.replaceAll());

    // Enter key inside find input
    this.findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) this.findPrev();
        else this.findNext();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    this.replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.replaceOne();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  open(mode = 'find') {
    this.modalEl.classList.add('active');
    this.setMode(mode);

    // If editor has selection, populate find input
    const selText = this.editorManager.getSelection();
    if (selText && !selText.includes('\n')) {
      this.findInput.value = selText;
    }

    this.findInput.focus();
    this.findInput.select();
  }

  close() {
    this.modalEl.classList.remove('active');
    if (this.editorManager.editor) {
      this.editorManager.editor.focus();
    }
  }

  setMode(mode) {
    this.currentMode = mode;
    const tabBtns = this.modalEl.querySelectorAll('.tab-nav-btn');
    tabBtns.forEach(b => {
      if (b.dataset.findtab === mode) b.classList.add('active');
      else b.classList.remove('active');
    });

    const isReplace = mode === 'replace';
    this.replaceRow.style.display = isReplace ? 'flex' : 'none';
    document.getElementById('btn-replace-one').style.display = isReplace ? 'inline-block' : 'none';
    document.getElementById('btn-replace-all').style.display = isReplace ? 'inline-block' : 'none';

    this.statusEl.textContent = 'Ready';
  }

  _getFindMatches() {
    const query = this.findInput.value;
    if (!query) return [];

    const model = this.editorManager.getModel();
    if (!model) return [];

    const isCase = this.optCase.checked;
    const isWord = this.optWord.checked;
    const isRegex = this.optRegex.checked;

    try {
      return model.findMatches(query, true, isRegex, isCase, isWord ? ' ' : null, false);
    } catch (e) {
      this.statusEl.textContent = `Regex Error: ${e.message}`;
      return [];
    }
  }

  findNext() {
    const matches = this._getFindMatches();
    if (matches.length === 0) {
      this.statusEl.textContent = 'Can not find the string "' + this.findInput.value + '"';
      return;
    }

    const curPos = this.editorManager.editor.getPosition();
    let nextMatch = matches.find(m => {
      return m.range.startLineNumber > curPos.lineNumber ||
        (m.range.startLineNumber === curPos.lineNumber && m.range.startColumn > curPos.column);
    });

    if (!nextMatch && this.optWrap.checked) {
      nextMatch = matches[0]; // Wrap around
      this.statusEl.textContent = `Reached end, wrapping to beginning (1 of ${matches.length})`;
    } else if (!nextMatch) {
      this.statusEl.textContent = 'Reached end of document';
      return;
    } else {
      const idx = matches.indexOf(nextMatch) + 1;
      this.statusEl.textContent = `Match ${idx} of ${matches.length}`;
    }

    this.editorManager.editor.setSelection(nextMatch.range);
    this.editorManager.editor.revealRangeInCenter(nextMatch.range);
  }

  findPrev() {
    const matches = this._getFindMatches();
    if (matches.length === 0) {
      this.statusEl.textContent = 'Can not find the string "' + this.findInput.value + '"';
      return;
    }

    const curPos = this.editorManager.editor.getPosition();
    const prevMatches = matches.filter(m => {
      return m.range.endLineNumber < curPos.lineNumber ||
        (m.range.endLineNumber === curPos.lineNumber && m.range.endColumn < curPos.column);
    });

    let prevMatch = prevMatches.length > 0 ? prevMatches[prevMatches.length - 1] : null;

    if (!prevMatch && this.optWrap.checked) {
      prevMatch = matches[matches.length - 1]; // Wrap around
      this.statusEl.textContent = `Reached top, wrapping to end (${matches.length} of ${matches.length})`;
    } else if (!prevMatch) {
      this.statusEl.textContent = 'Reached top of document';
      return;
    } else {
      const idx = matches.indexOf(prevMatch) + 1;
      this.statusEl.textContent = `Match ${idx} of ${matches.length}`;
    }

    this.editorManager.editor.setSelection(prevMatch.range);
    this.editorManager.editor.revealRangeInCenter(prevMatch.range);
  }

  countMatches() {
    const matches = this._getFindMatches();
    this.statusEl.textContent = `Count: ${matches.length} match(es) in entire document`;
    window.uiManager.showToast(`Count: ${matches.length} match(es)`, 'info');
  }

  replaceOne() {
    const query = this.findInput.value;
    const replacement = this.replaceInput.value;
    const model = this.editorManager.getModel();
    if (!model || !query) return;

    const selection = this.editorManager.editor.getSelection();
    const selectedText = model.getValueInRange(selection);

    const isMatch = this.optCase.checked ? (selectedText === query) : (selectedText.toLowerCase() === query.toLowerCase());

    if (isMatch) {
      this.editorManager.replaceSelection(replacement);
      this.statusEl.textContent = 'Replaced 1 occurrence';
    }

    this.findNext();
  }

  replaceAll() {
    const query = this.findInput.value;
    const replacement = this.replaceInput.value;
    const model = this.editorManager.getModel();
    if (!model || !query) return;

    const matches = this._getFindMatches();
    if (matches.length === 0) {
      this.statusEl.textContent = 'No occurrences to replace';
      return;
    }

    const edits = matches.map(m => ({
      range: m.range,
      text: replacement,
      forceMoveMarkers: true
    }));

    this.editorManager.editor.executeEdits('find-replace', edits);
    this.statusEl.textContent = `Replaced ${matches.length} occurrences`;
    window.uiManager.showToast(`Replaced ${matches.length} occurrences`, 'success');
  }
}

window.FindReplaceManager = FindReplaceManager;
