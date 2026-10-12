/**
 * Notepad++ (macOS) Tabs Manager
 * Controls multi-tab buffer state, floppy disk dirty status, and file association
 */

class TabsManager {
  constructor(editorManager) {
    this.editorManager = editorManager;
    this.tabs = [];
    this.activeTabId = null;
    this.tabCounter = 1;
    this.tabsStripEl = document.getElementById('tabs-strip');
    this.onActiveTabChanged = null;

    this._bindEvents();
  }

  _bindEvents() {
    document.getElementById('btn-new-tab').addEventListener('click', () => {
      this.createTab();
    });
  }

  createTab(title, content = '', filePath = null, language = null) {
    const tabId = 'tab_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const tabTitle = title || `new ${this.tabCounter++}`;
    const detectedLang = language || this.detectLanguage(filePath || tabTitle, content);

    // Create Monaco model
    const uri = filePath ? `file://${filePath}` : `inmemory://tab/${tabId}/${tabTitle}`;
    const model = this.editorManager.createModel(content, detectedLang, uri);

    const tab = {
      id: tabId,
      title: tabTitle,
      filePath: filePath,
      model: model,
      isDirty: false,
      encoding: 'UTF-8',
      eol: content.includes('\r\n') ? 'CRLF' : 'LF',
      originalContent: content
    };

    // Listen for model content changes to track dirty state
    model.onDidChangeContent(() => {
      const currentVal = model.getValue();
      const isDirty = tab.filePath ? (currentVal !== tab.originalContent) : (currentVal.length > 0);
      this.setTabDirty(tab.id, isDirty);
    });

    this.tabs.push(tab);
    this._renderTabElement(tab);
    this.activateTab(tab.id);

    return tab;
  }

  _renderTabElement(tab) {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab-item';
    tabEl.id = `tab-el-${tab.id}`;
    tabEl.dataset.tabId = tab.id;

    tabEl.innerHTML = `
      <svg class="tab-save-icon" viewBox="0 0 24 24">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21" stroke="#fff" stroke-width="1.5" fill="none"/>
        <polyline points="7 3 7 8 15 8" stroke="#fff" stroke-width="1.5" fill="none"/>
      </svg>
      <span class="tab-title">${this.escapeHtml(tab.title)}</span>
      <span class="tab-close-btn" title="Close Tab (Cmd+W)">×</span>
    `;

    // Click to activate
    tabEl.addEventListener('click', (e) => {
      if (!e.target.classList.contains('tab-close-btn')) {
        this.activateTab(tab.id);
      }
    });

    // Close button
    tabEl.querySelector('.tab-close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTab(tab.id);
    });

    // Double click to close (classic Notepad++ behavior)
    tabEl.addEventListener('dblclick', (e) => {
      if (!e.target.classList.contains('tab-close-btn')) {
        this.closeTab(tab.id);
      }
    });

    this.tabsStripEl.appendChild(tabEl);
  }

  activateTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    this.activeTabId = tabId;

    // Update active class on tab DOM elements
    const allTabEls = this.tabsStripEl.querySelectorAll('.tab-item');
    allTabEls.forEach(el => {
      if (el.dataset.tabId === tabId) {
        el.classList.add('active');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } else {
        el.classList.remove('active');
      }
    });

    // Switch model in editor
    this.editorManager.setModel(tab.model);

    // Update window header title
    const filenameEl = document.getElementById('app-window-filename');
    if (filenameEl) {
      filenameEl.textContent = tab.filePath || tab.title;
      filenameEl.title = tab.filePath || tab.title;
    }

    if (this.onActiveTabChanged) {
      this.onActiveTabChanged(tab);
    }
  }

  getActiveTab() {
    return this.tabs.find(t => t.id === this.activeTabId) || null;
  }

  getTabById(id) {
    return this.tabs.find(t => t.id === id);
  }

  getAllTabs() {
    return this.tabs;
  }

  setTabDirty(tabId, isDirty) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    tab.isDirty = isDirty;
    const tabEl = document.getElementById(`tab-el-${tabId}`);
    if (tabEl) {
      if (isDirty) {
        tabEl.classList.add('dirty');
      } else {
        tabEl.classList.remove('dirty');
      }
    }
  }

  async closeTab(tabId) {
    const tabIndex = this.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = this.tabs[tabIndex];

    // If dirty, ask user if they want to save or discard
    if (tab.isDirty) {
      const confirmDiscard = confirm(`Save changes to "${tab.title}" before closing?`);
      if (confirmDiscard) {
        const saved = await this.saveTab(tabId);
        if (!saved) return; // user cancelled save dialog
      }
    }

    // Remove tab element from DOM
    const tabEl = document.getElementById(`tab-el-${tabId}`);
    if (tabEl) tabEl.remove();

    // Dispose model
    if (tab.model) {
      tab.model.dispose();
    }

    this.tabs.splice(tabIndex, 1);

    // If active tab was closed, switch to adjacent tab
    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        const nextIndex = Math.min(tabIndex, this.tabs.length - 1);
        this.activateTab(this.tabs[nextIndex].id);
      } else {
        // If all tabs closed, create a fresh "new 1" tab
        this.createTab();
      }
    }
  }

  closeAllTabs() {
    const tabIds = this.tabs.map(t => t.id);
    for (const id of tabIds) {
      this.closeTab(id);
    }
  }

  closeOtherTabs(preserveTabId) {
    const toClose = this.tabs.filter(t => t.id !== preserveTabId).map(t => t.id);
    for (const id of toClose) {
      this.closeTab(id);
    }
  }

  async saveActiveTab() {
    const active = this.getActiveTab();
    if (!active) return false;
    return await this.saveTab(active.id);
  }

  async saveTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return false;

    if (!tab.filePath) {
      return await this.saveTabAs(tabId);
    }

    const content = tab.model.getValue();
    const result = await window.electronAPI.writeFile({
      filePath: tab.filePath,
      content: content
    });

    if (result.success) {
      tab.originalContent = content;
      this.setTabDirty(tab.id, false);
      window.uiManager.showToast(`Saved ${tab.title}`, 'success');
      return true;
    } else {
      window.uiManager.showToast(`Error saving: ${result.error}`, 'error');
      return false;
    }
  }

  async saveTabAs(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return false;

    const saveResult = await window.electronAPI.saveFileDialog({
      defaultPath: tab.filePath || tab.title,
      title: 'Save As'
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return false;
    }

    const newPath = saveResult.filePath;
    const content = tab.model.getValue();
    const result = await window.electronAPI.writeFile({
      filePath: newPath,
      content: content
    });

    if (result.success) {
      tab.filePath = newPath;
      tab.title = newPath.split('/').pop();
      tab.originalContent = content;
      this.setTabDirty(tab.id, false);

      // Update tab DOM title
      const tabEl = document.getElementById(`tab-el-${tab.id}`);
      if (tabEl) {
        tabEl.querySelector('.tab-title').textContent = tab.title;
      }

      // Update active language if changed
      const lang = this.detectLanguage(tab.title, content);
      this.editorManager.setLanguage(lang);

      // Update window header
      document.getElementById('app-window-filename').textContent = tab.filePath;

      window.uiManager.showToast(`Saved as ${tab.title}`, 'success');
      return true;
    } else {
      window.uiManager.showToast(`Error saving: ${result.error}`, 'error');
      return false;
    }
  }

  async saveAllTabs() {
    let savedCount = 0;
    for (const tab of this.tabs) {
      if (tab.isDirty && tab.filePath) {
        const content = tab.model.getValue();
        await window.electronAPI.writeFile({ filePath: tab.filePath, content });
        tab.originalContent = content;
        this.setTabDirty(tab.id, false);
        savedCount++;
      }
    }
    window.uiManager.showToast(`Saved all (${savedCount} files)`, 'success');
  }

  openFile(filePath, content) {
    // Check if already open
    const existing = this.tabs.find(t => t.filePath === filePath);
    if (existing) {
      this.activateTab(existing.id);
      return existing;
    }

    const title = filePath.split('/').pop();
    return this.createTab(title, content, filePath);
  }

  detectLanguage(filename, content = '') {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      'xml': 'xml', 'xaml': 'xml', 'svg': 'xml', 'plist': 'xml',
      'json': 'json', 'geojson': 'json', 'jsonc': 'json',
      'js': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript',
      'ts': 'typescript', 'tsx': 'typescript', 'jsx': 'javascript',
      'py': 'python', 'pyw': 'python',
      'html': 'html', 'htm': 'html',
      'css': 'css', 'scss': 'scss', 'less': 'less',
      'sh': 'shell', 'bash': 'shell', 'zsh': 'shell',
      'sql': 'sql',
      'md': 'markdown', 'markdown': 'markdown',
      'c': 'c', 'h': 'c', 'cpp': 'cpp', 'hpp': 'cpp', 'cc': 'cpp',
      'java': 'java',
      'rs': 'rust',
      'go': 'go',
      'yaml': 'yaml', 'yml': 'yaml',
      'ini': 'ini', 'conf': 'ini', 'cfg': 'ini', 'env': 'ini'
    };

    if (map[ext]) return map[ext];

    // Sniff content if plaintext extension
    if (content.startsWith('<?xml') || (content.startsWith('<') && content.includes('</'))) return 'xml';
    if ((content.startsWith('{') && content.endsWith('}')) || (content.startsWith('[') && content.endsWith(']'))) {
      try { JSON.parse(content); return 'json'; } catch (e) {}
    }

    return 'plaintext';
  }

  escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.TabsManager = TabsManager;
