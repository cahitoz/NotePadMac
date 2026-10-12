/**
 * Notepad++ (macOS) Editor Manager
 * Wraps Monaco Editor & Diff Editor instances with tab buffers and language lexers
 */

class EditorManager {
  constructor() {
    this.editor = null;
    this.diffEditor = null;
    this.isDiffActive = false;
    this.currentTheme = 'vs-dark';
    this.wordWrap = 'off';
    this.minimapEnabled = true;
    this.showWhitespace = 'none'; // 'none' | 'all'
    this.showLineNumbers = true;
    this.zoomLevel = 0;
    this.readyCallbacks = [];
    this.isReady = false;

    this.onCursorChange = null;
    this.onContentChange = null;
  }

  init() {
    return new Promise((resolve) => {
      // Configure Monaco AMD Loader
      require.config({
        paths: {
          vs: '../node_modules/monaco-editor/min/vs'
        }
      });

      // Fix web worker paths for Monaco inside Electron
      window.MonacoEnvironment = {
        getWorkerUrl: function (workerId, label) {
          return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
            self.MonacoEnvironment = {
              baseUrl: '../node_modules/monaco-editor/min/'
            };
            importScripts('../node_modules/monaco-editor/min/vs/base/worker/workerMain.js');
          `)}`;
        }
      };

      require(['vs/editor/editor.main'], () => {
        this._setupEditor();
        this._setupDiffEditor();
        this.isReady = true;
        this.readyCallbacks.forEach(cb => cb());
        this.readyCallbacks = [];
        resolve(this);
      });
    });
  }

  onReady(callback) {
    if (this.isReady) {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }

  _setupEditor() {
    const container = document.getElementById('editor-container');
    this.editor = monaco.editor.create(container, {
      value: '',
      language: 'plaintext',
      theme: this.currentTheme,
      automaticLayout: true,
      fontSize: 13,
      fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
      lineNumbers: 'on',
      wordWrap: 'off',
      minimap: { enabled: true, maxColumn: 120 },
      renderWhitespace: 'none',
      tabSize: 4,
      insertSpaces: true,
      scrollBeyondLastLine: false,
      cursorBlinking: 'smooth',
      smoothScrolling: true,
      bracketPairColorization: { enabled: true },
      renderLineHighlight: 'all',
      guides: { indentation: true, bracketPairs: true }
    });

    // Cursor position and selection change listener
    this.editor.onDidChangeCursorPosition((e) => {
      if (this.onCursorChange) {
        const pos = this.editor.getPosition();
        const sel = this.editor.getSelection();
        let selLen = 0;
        if (sel && !sel.isEmpty()) {
          const model = this.editor.getModel();
          selLen = model ? model.getValueInRange(sel).length : 0;
        }
        this.onCursorChange({ line: pos.lineNumber, col: pos.column, selLength: selLen });
      }
    });

    // Content change listener
    this.editor.onDidChangeModelContent((e) => {
      if (this.onContentChange) {
        const model = this.editor.getModel();
        this.onContentChange(model);
      }
    });
  }

  _setupDiffEditor() {
    const diffContainer = document.getElementById('diff-container');
    this.diffEditor = monaco.editor.createDiffEditor(diffContainer, {
      automaticLayout: true,
      theme: this.currentTheme,
      readOnly: false,
      fontSize: 13,
      fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
      renderSideBySide: true,
      scrollBeyondLastLine: false,
      renderOverviewRuler: true
    });
  }

  createModel(content, language, uriStr) {
    const uri = uriStr ? monaco.Uri.parse(uriStr) : undefined;
    const existing = uri ? monaco.editor.getModel(uri) : null;
    if (existing) {
      existing.setValue(content);
      return existing;
    }
    return monaco.editor.createModel(content, language || 'plaintext', uri);
  }

  setModel(model) {
    if (this.editor && model) {
      this.editor.setModel(model);
      this.editor.focus();
    }
  }

  getModel() {
    return this.editor ? this.editor.getModel() : null;
  }

  getValue() {
    return this.editor ? this.editor.getValue() : '';
  }

  setValue(val) {
    if (this.editor) {
      this.editor.setValue(val);
    }
  }

  getSelection() {
    if (!this.editor) return '';
    const sel = this.editor.getSelection();
    return this.editor.getModel().getValueInRange(sel);
  }

  replaceSelection(text) {
    if (!this.editor) return;
    const selection = this.editor.getSelection();
    const op = { range: selection, text: text, forceMoveMarkers: true };
    this.editor.executeEdits('notepadmac', [op]);
  }

  getLanguage() {
    const model = this.getModel();
    return model ? model.getLanguageId() : 'plaintext';
  }

  setLanguage(langId) {
    const model = this.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, langId);
    }
  }

  // View and Display Toggles
  toggleWordWrap() {
    this.wordWrap = this.wordWrap === 'off' ? 'on' : 'off';
    this.editor.updateOptions({ wordWrap: this.wordWrap });
    return this.wordWrap === 'on';
  }

  toggleMinimap() {
    this.minimapEnabled = !this.minimapEnabled;
    this.editor.updateOptions({ minimap: { enabled: this.minimapEnabled } });
    return this.minimapEnabled;
  }

  toggleWhitespace() {
    this.showWhitespace = this.showWhitespace === 'none' ? 'all' : 'none';
    this.editor.updateOptions({ renderWhitespace: this.showWhitespace });
    return this.showWhitespace === 'all';
  }

  toggleLineNumbers() {
    this.showLineNumbers = !this.showLineNumbers;
    this.editor.updateOptions({ lineNumbers: this.showLineNumbers ? 'on' : 'off' });
    return this.showLineNumbers;
  }

  setTheme(isDark) {
    this.currentTheme = isDark ? 'vs-dark' : 'vs';
    monaco.editor.setTheme(this.currentTheme);
    if (this.diffEditor) {
      this.diffEditor.updateOptions({ theme: this.currentTheme });
    }
  }

  zoomIn() {
    this.zoomLevel += 1;
    this.editor.updateOptions({ fontSize: 13 + this.zoomLevel });
  }

  zoomOut() {
    if (this.zoomLevel > -5) {
      this.zoomLevel -= 1;
      this.editor.updateOptions({ fontSize: 13 + this.zoomLevel });
    }
  }

  zoomReset() {
    this.zoomLevel = 0;
    this.editor.updateOptions({ fontSize: 13 });
  }

  // Editing Actions
  undo() {
    this.editor.trigger('keyboard', 'undo');
  }

  redo() {
    this.editor.trigger('keyboard', 'redo');
  }

  selectAll() {
    this.editor.focus();
    this.editor.setSelection(this.editor.getModel().getFullModelRange());
  }

  duplicateLine() {
    this.editor.trigger('keyboard', 'editor.action.copyLinesDownAction');
  }

  deleteLine() {
    this.editor.trigger('keyboard', 'editor.action.deleteLines');
  }

  moveLineUp() {
    this.editor.trigger('keyboard', 'editor.action.moveCarretLeftAction');
    this.editor.trigger('keyboard', 'editor.action.moveLinesUpAction');
  }

  moveLineDown() {
    this.editor.trigger('keyboard', 'editor.action.moveLinesDownAction');
  }

  // Compare Plugin Diff View
  startCompare(originalModel, modifiedModel, originalTitle, modifiedTitle) {
    this.isDiffActive = true;
    const editorEl = document.getElementById('editor-container');
    const diffEl = document.getElementById('diff-container');
    const bannerEl = document.getElementById('compare-banner');
    const leftTitleEl = document.getElementById('compare-left-title');
    const rightTitleEl = document.getElementById('compare-right-title');

    editorEl.style.display = 'none';
    diffEl.style.display = 'block';
    bannerEl.classList.add('active');

    leftTitleEl.textContent = originalTitle || 'Original';
    rightTitleEl.textContent = modifiedTitle || 'Modified';

    this.diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel
    });

    this.diffEditor.layout();
  }

  stopCompare() {
    this.isDiffActive = false;
    const editorEl = document.getElementById('editor-container');
    const diffEl = document.getElementById('diff-container');
    const bannerEl = document.getElementById('compare-banner');

    diffEl.style.display = 'none';
    bannerEl.classList.remove('active');
    editorEl.style.display = 'block';

    if (this.editor) {
      this.editor.layout();
      this.editor.focus();
    }
  }

  nextDiff() {
    if (this.diffEditor && this.diffEditor.getLineChanges()) {
      const lineChanges = this.diffEditor.getLineChanges();
      if (lineChanges && lineChanges.length > 0) {
        const curLine = this.editor.getPosition()?.lineNumber || 1;
        const next = lineChanges.find(c => c.modifiedStartLineNumber > curLine) || lineChanges[0];
        this.diffEditor.getModifiedEditor().revealLineInCenter(next.modifiedStartLineNumber);
        this.diffEditor.getModifiedEditor().setPosition({ lineNumber: next.modifiedStartLineNumber, column: 1 });
      }
    }
  }

  prevDiff() {
    if (this.diffEditor && this.diffEditor.getLineChanges()) {
      const lineChanges = this.diffEditor.getLineChanges();
      if (lineChanges && lineChanges.length > 0) {
        const curLine = this.editor.getPosition()?.lineNumber || 1;
        const prev = [...lineChanges].reverse().find(c => c.modifiedStartLineNumber < curLine) || lineChanges[lineChanges.length - 1];
        this.diffEditor.getModifiedEditor().revealLineInCenter(prev.modifiedStartLineNumber);
        this.diffEditor.getModifiedEditor().setPosition({ lineNumber: prev.modifiedStartLineNumber, column: 1 });
      }
    }
  }
}

window.EditorManager = EditorManager;
