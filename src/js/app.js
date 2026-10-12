/**
 * Notepad++ (macOS) Main Application Entrypoint
 */

class UIManager {
  constructor() {
    this.toastContainer = document.getElementById('toast-container');
  }

  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
      iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  showModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('active');
  }

  hideModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
  }
}

window.uiManager = new UIManager();

document.addEventListener('DOMContentLoaded', async () => {
  const editorManager = new EditorManager();
  window.editorManager = editorManager;

  await editorManager.init();

  const tabsManager = new TabsManager(editorManager);
  window.tabsManager = tabsManager;

  const findReplaceManager = new FindReplaceManager(editorManager);
  window.findReplace = findReplaceManager;

  const pluginHost = new PluginHost(editorManager, tabsManager, window.uiManager);
  window.pluginHost = pluginHost;

  await pluginHost.loadAllPlugins();

  // Status Bar Elements
  const sbPos = document.getElementById('sb-pos');
  const sbDocStats = document.getElementById('sb-doc-stats');
  const sbEol = document.getElementById('sb-eol');
  const sbEncoding = document.getElementById('sb-encoding');
  const sbIns = document.getElementById('sb-ins');
  const sbLanguage = document.getElementById('sb-language');

  // Update status bar on cursor movement
  editorManager.onCursorChange = ({ line, col, selLength }) => {
    sbPos.textContent = `Ln ${line}, Col ${col}, Sel ${selLength}`;
    const model = editorManager.getModel();
    if (model) {
      const lineCount = model.getLineCount();
      const length = model.getValueLength();
      sbDocStats.textContent = `Length: ${length}  Lines: ${lineCount}`;
    }
  };

  // Update status bar on tab switch
  tabsManager.onActiveTabChanged = (tab) => {
    sbEol.textContent = tab.eol === 'CRLF' ? 'Windows (CR LF)' : 'Unix (LF)';
    sbEncoding.textContent = tab.encoding || 'UTF-8';
    sbLanguage.textContent = (editorManager.getLanguage() || 'Plain Text').toUpperCase() + ' ▾';

    const model = tab.model;
    if (model) {
      const lineCount = model.getLineCount();
      const length = model.getValueLength();
      sbDocStats.textContent = `Length: ${length}  Lines: ${lineCount}`;
    }
  };

  // Bind Toolbar Buttons
  document.getElementById('tb-new').addEventListener('click', () => tabsManager.createTab());
  document.getElementById('tb-open').addEventListener('click', () => window.electronAPI.openFileDialog());
  document.getElementById('tb-save').addEventListener('click', () => tabsManager.saveActiveTab());
  document.getElementById('tb-save-all').addEventListener('click', () => tabsManager.saveAllTabs());
  document.getElementById('tb-close').addEventListener('click', () => {
    const active = tabsManager.getActiveTab();
    if (active) tabsManager.closeTab(active.id);
  });

  document.getElementById('tb-cut').addEventListener('click', () => document.execCommand('cut'));
  document.getElementById('tb-copy').addEventListener('click', () => document.execCommand('copy'));
  document.getElementById('tb-paste').addEventListener('click', () => document.execCommand('paste'));
  document.getElementById('tb-undo').addEventListener('click', () => editorManager.undo());
  document.getElementById('tb-redo').addEventListener('click', () => editorManager.redo());

  document.getElementById('tb-find').addEventListener('click', () => findReplaceManager.open('find'));
  document.getElementById('tb-replace').addEventListener('click', () => findReplaceManager.open('replace'));

  document.getElementById('tb-zoom-in').addEventListener('click', () => editorManager.zoomIn());
  document.getElementById('tb-zoom-out').addEventListener('click', () => editorManager.zoomOut());
  document.getElementById('tb-wordwrap').addEventListener('click', (e) => {
    const isWrapped = editorManager.toggleWordWrap();
    e.currentTarget.classList.toggle('active', isWrapped);
  });
  document.getElementById('tb-show-chars').addEventListener('click', (e) => {
    const isShowing = editorManager.toggleWhitespace();
    e.currentTarget.classList.toggle('active', isShowing);
  });
  document.getElementById('tb-minimap').addEventListener('click', (e) => {
    const isMini = editorManager.toggleMinimap();
    e.currentTarget.classList.toggle('active', isMini);
  });

  // Plugins Quick Buttons
  document.getElementById('tb-compare').addEventListener('click', () => window.comparePlugin.openComparePicker());
  document.getElementById('tb-xml-format').addEventListener('click', () => window.xmlToolsPlugin.prettyPrint(2));
  document.getElementById('tb-json-format').addEventListener('click', () => window.jsonToolsPlugin.format(2));
  document.getElementById('tb-runner').addEventListener('click', () => window.nppExecPlugin.runCurrent());
  document.getElementById('tb-plugins-admin').addEventListener('click', () => pluginHost.openAdminModal());

  // Theme Toggle Button
  const themeBtn = document.getElementById('btn-theme-toggle');
  themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const nextTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    editorManager.setTheme(nextTheme === 'dark');
  });

  // Compare Banner Buttons
  document.getElementById('btn-diff-next').addEventListener('click', () => editorManager.nextDiff());
  document.getElementById('btn-diff-prev').addEventListener('click', () => editorManager.prevDiff());
  document.getElementById('btn-diff-clear').addEventListener('click', () => editorManager.stopCompare());

  // Compare Picker Modal
  document.getElementById('btn-close-compare-picker').addEventListener('click', () => window.uiManager.hideModal('compare-picker-modal'));
  document.getElementById('btn-cancel-compare').addEventListener('click', () => window.uiManager.hideModal('compare-picker-modal'));
  document.getElementById('btn-execute-compare').addEventListener('click', () => window.comparePlugin.executeCompare());

  // XPath Evaluator Modal
  document.getElementById('btn-close-xpath').addEventListener('click', () => window.uiManager.hideModal('xpath-modal'));
  document.getElementById('btn-close-xpath-footer').addEventListener('click', () => window.uiManager.hideModal('xpath-modal'));
  document.getElementById('btn-run-xpath').addEventListener('click', () => window.xmlToolsPlugin.evaluateXPath());

  // JSON Tree Viewer Modal
  document.getElementById('btn-close-json-tree').addEventListener('click', () => window.uiManager.hideModal('json-tree-modal'));
  document.getElementById('btn-close-json-tree-footer').addEventListener('click', () => window.uiManager.hideModal('json-tree-modal'));
  document.getElementById('btn-copy-json-tree').addEventListener('click', () => {
    const text = editorManager.getValue();
    try {
      const clean = JSON.stringify(JSON.parse(text), null, 2);
      navigator.clipboard.writeText(clean);
      window.uiManager.showToast('Clean JSON copied to clipboard', 'success');
    } catch (e) {
      window.uiManager.showToast('Cannot format JSON for copy', 'error');
    }
  });

  // Statistics Modal
  document.getElementById('btn-close-stats').addEventListener('click', () => window.uiManager.hideModal('stats-modal'));
  document.getElementById('btn-close-stats-footer').addEventListener('click', () => window.uiManager.hideModal('stats-modal'));

  // About Modal
  document.getElementById('btn-close-about').addEventListener('click', () => window.uiManager.hideModal('about-modal'));
  document.getElementById('btn-close-about-footer').addEventListener('click', () => window.uiManager.hideModal('about-modal'));

  // Console Panel
  document.getElementById('btn-console-clear').addEventListener('click', () => {
    document.getElementById('console-output').textContent = '';
  });
  document.getElementById('btn-console-stop').addEventListener('click', () => {
    window.electronAPI.stopCommand();
  });
  document.getElementById('btn-console-close').addEventListener('click', () => {
    document.getElementById('console-panel').classList.remove('active');
  });

  // Click on Status Bar items
  sbEol.addEventListener('click', () => {
    const active = tabsManager.getActiveTab();
    if (!active) return;
    active.eol = active.eol === 'LF' ? 'CRLF' : 'LF';
    sbEol.textContent = active.eol === 'CRLF' ? 'Windows (CR LF)' : 'Unix (LF)';
    window.uiManager.showToast(`Line endings set to ${active.eol}`, 'info');
  });

  sbLanguage.addEventListener('click', () => {
    const lang = prompt('Enter syntax language (e.g. xml, json, javascript, python, html, sql):', editorManager.getLanguage());
    if (lang) {
      editorManager.setLanguage(lang.toLowerCase().trim());
      sbLanguage.textContent = lang.toUpperCase() + ' ▾';
    }
  });

  // Connect Main Process IPC Events
  window.electronAPI.on('menu:new-tab', () => tabsManager.createTab());
  window.electronAPI.on('menu:save', () => tabsManager.saveActiveTab());
  window.electronAPI.on('menu:save-as', () => {
    const active = tabsManager.getActiveTab();
    if (active) tabsManager.saveTabAs(active.id);
  });
  window.electronAPI.on('menu:save-all', () => tabsManager.saveAllTabs());
  window.electronAPI.on('menu:close-tab', () => {
    const active = tabsManager.getActiveTab();
    if (active) tabsManager.closeTab(active.id);
  });
  window.electronAPI.on('menu:close-all-tabs', () => tabsManager.closeAllTabs());
  window.electronAPI.on('menu:reveal-file', () => {
    const active = tabsManager.getActiveTab();
    if (active && active.filePath) window.electronAPI.revealInFinder(active.filePath);
    else window.uiManager.showToast('File has not been saved to disk yet.', 'info');
  });

  window.electronAPI.on('file:opened', ({ filePath, content }) => {
    tabsManager.openFile(filePath, content);
  });

  window.electronAPI.on('menu:about', () => window.uiManager.showModal('about-modal'));

  window.electronAPI.on('editor:undo', () => editorManager.undo());
  window.electronAPI.on('editor:redo', () => editorManager.redo());
  window.electronAPI.on('editor:select-all', () => editorManager.selectAll());
  window.electronAPI.on('editor:duplicate-line', () => editorManager.duplicateLine());
  window.electronAPI.on('editor:delete-line', () => editorManager.deleteLine());
  window.electronAPI.on('editor:move-line-up', () => editorManager.moveLineUp());
  window.electronAPI.on('editor:move-line-down', () => editorManager.moveLineDown());

  window.electronAPI.on('search:open-find', () => findReplaceManager.open('find'));
  window.electronAPI.on('search:open-replace', () => findReplaceManager.open('replace'));
  window.electronAPI.on('search:find-next', () => findReplaceManager.findNext());
  window.electronAPI.on('search:find-prev', () => findReplaceManager.findPrev());
  window.electronAPI.on('search:goto-line', () => {
    const line = prompt('Go to line number:');
    if (line && !isNaN(line)) {
      const lineNum = parseInt(line, 10);
      editorManager.editor.revealLineInCenter(lineNum);
      editorManager.editor.setPosition({ lineNumber: lineNum, column: 1 });
    }
  });

  window.electronAPI.on('view:toggle-word-wrap', () => {
    const isW = editorManager.toggleWordWrap();
    document.getElementById('tb-wordwrap').classList.toggle('active', isW);
  });
  window.electronAPI.on('view:toggle-minimap', () => {
    const isM = editorManager.toggleMinimap();
    document.getElementById('tb-minimap').classList.toggle('active', isM);
  });
  window.electronAPI.on('view:toggle-line-numbers', () => editorManager.toggleLineNumbers());
  window.electronAPI.on('view:toggle-whitespace', () => {
    const isS = editorManager.toggleWhitespace();
    document.getElementById('tb-show-chars').classList.toggle('active', isS);
  });
  window.electronAPI.on('view:zoom-in', () => editorManager.zoomIn());
  window.electronAPI.on('view:zoom-out', () => editorManager.zoomOut());
  window.electronAPI.on('view:zoom-reset', () => editorManager.zoomReset());
  window.electronAPI.on('view:toggle-theme', () => themeBtn.click());

  window.electronAPI.on('lang:set', (lang) => {
    editorManager.setLanguage(lang);
    sbLanguage.textContent = lang.toUpperCase() + ' ▾';
  });

  // Plugins Menu events
  window.electronAPI.on('plugins:open-admin', () => pluginHost.openAdminModal());
  window.electronAPI.on('plugins:reload', async () => {
    await pluginHost.loadAllPlugins();
    window.uiManager.showToast('Plugins reloaded', 'success');
  });

  window.electronAPI.on('compare:start', () => window.comparePlugin.openComparePicker());
  window.electronAPI.on('compare:clear', () => window.comparePlugin.clearCompare());
  window.electronAPI.on('compare:next', () => editorManager.nextDiff());
  window.electronAPI.on('compare:prev', () => editorManager.prevDiff());

  window.electronAPI.on('xml:pretty-print', () => window.xmlToolsPlugin.prettyPrint(2));
  window.electronAPI.on('xml:linearize', () => window.xmlToolsPlugin.linearize());
  window.electronAPI.on('xml:validate', () => window.xmlToolsPlugin.validate());
  window.electronAPI.on('xml:xpath-modal', () => window.xmlToolsPlugin.openXPathModal());

  window.electronAPI.on('json:format-2', () => window.jsonToolsPlugin.format(2));
  window.electronAPI.on('json:format-4', () => window.jsonToolsPlugin.format(4));
  window.electronAPI.on('json:minify', () => window.jsonToolsPlugin.minify());
  window.electronAPI.on('json:validate', () => window.jsonToolsPlugin.validate());
  window.electronAPI.on('json:tree-modal', () => window.jsonToolsPlugin.openTreeViewer());

  window.electronAPI.on('textfx:sort-asc', () => window.textFxPlugin.sortLines(true));
  window.electronAPI.on('textfx:sort-desc', () => window.textFxPlugin.sortLines(false));
  window.electronAPI.on('textfx:remove-duplicates', () => window.textFxPlugin.removeDuplicates());
  window.electronAPI.on('textfx:trim-trailing', () => window.textFxPlugin.trimTrailing());
  window.electronAPI.on('textfx:case-upper', () => window.textFxPlugin.convertCase('upper'));
  window.electronAPI.on('textfx:case-lower', () => window.textFxPlugin.convertCase('lower'));
  window.electronAPI.on('textfx:case-title', () => window.textFxPlugin.convertCase('title'));
  window.electronAPI.on('textfx:case-camel', () => window.textFxPlugin.convertCase('camel'));
  window.electronAPI.on('textfx:case-snake', () => window.textFxPlugin.convertCase('snake'));
  window.electronAPI.on('textfx:base64-encode', () => window.textFxPlugin.base64(true));
  window.electronAPI.on('textfx:base64-decode', () => window.textFxPlugin.base64(false));
  window.electronAPI.on('textfx:url-encode', () => window.textFxPlugin.urlEncode(true));
  window.electronAPI.on('textfx:url-decode', () => window.textFxPlugin.urlEncode(false));
  window.electronAPI.on('textfx:stats', () => window.textFxPlugin.showStats());

  window.electronAPI.on('nppexec:run', () => window.nppExecPlugin.runCurrent());
  window.electronAPI.on('nppexec:toggle-console', () => window.nppExecPlugin.toggleConsole());

  // Runner streaming events
  const consoleOutputEl = document.getElementById('console-output');
  window.electronAPI.on('runner:started', ({ command }) => {
    consoleOutputEl.textContent = `>>> Executing: ${command}\n----------------------------------------\n`;
  });
  window.electronAPI.on('runner:stdout', (data) => {
    consoleOutputEl.textContent += data;
    consoleOutputEl.scrollTop = consoleOutputEl.scrollHeight;
  });
  window.electronAPI.on('runner:stderr', (data) => {
    consoleOutputEl.textContent += data;
    consoleOutputEl.scrollTop = consoleOutputEl.scrollHeight;
  });
  window.electronAPI.on('runner:completed', ({ code, duration }) => {
    consoleOutputEl.textContent += `\n----------------------------------------\n>>> Process exited with code ${code} in ${duration}s\n`;
    consoleOutputEl.scrollTop = consoleOutputEl.scrollHeight;
  });

  // Initialize sample tabs showcasing features
  createWelcomeTabs(tabsManager);
});

function createWelcomeTabs(tabsManager) {
  const welcomeContent = `Notepad++ (macOS Edition)
===========================
Welcome to your high-performance Notepad++ clone built specifically for macOS!

KEY FEATURES & SHORTCUTS:
-------------------------
• File Management:
  - Cmd + N : New Tab
  - Cmd + O : Open File
  - Cmd + S : Save File
  - Cmd + W : Close Tab
  - Floppy disk icon changes to RED when file has unsaved edits!

• Built-in Powerhouse Plugins:
  1. Compare Plugin:
     - Click the Compare button on the toolbar or press Alt + D
     - Shows side-by-side visual diff with line additions/deletions
     - Navigate differences with F8 (Next) and Shift + F8 (Previous)

  2. XML Tools:
     - Pretty Print / Indent: Ctrl + Alt + Shift + B
     - Linearize (Minify XML)
     - Syntax Check & Validation
     - XPath Evaluator interactive inspector!

  3. JSON Tools:
     - Format JSON: Ctrl + Alt + Shift + J
     - Minify JSON
     - Validate JSON syntax
     - Interactive JSON Tree Viewer with collapsible nodes!

  4. TextFX Tools:
     - Sort Lines (Ascending / Descending)
     - Remove Duplicate Lines
     - Case conversion: UPPERCASE, lowercase, Title Case, camelCase, snake_case
     - Base64 & URL Encode / Decode
     - Document Summary & Statistics

  5. NppExec (Code Runner):
     - Press F5 to execute Python, Node.js, or Shell scripts directly
     - Live console output with execution duration and exit status

• Plugins Admin:
  - Press Cmd + Shift + P to open Plugins Admin
  - Install community plugins with 1 click (Hex Editor, Markdown Preview, etc.)
  - Open Plugins Folder to drop in your own custom JavaScript plugins!

Check the other open tabs to try out XML Tools and JSON Tools immediately!
`;

  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<bookstore>
<book id="bk101">
<author>Gambardella, Matthew</author>
<title>XML Developer's Guide</title>
<genre>Computer</genre>
<price>44.95</price>
<publish_date>2000-10-01</publish_date>
<description>An in-depth look at creating applications with XML.</description>
</book>
<book id="bk102">
<author>Ralls, Kim</author>
<title>Midnight Rain</title>
<genre>Fantasy</genre>
<price>5.95</price>
<publish_date>2000-12-16</publish_date>
<description>A former architect battles corporate zombies.</description>
</book>
</bookstore>`;

  const sampleJson = `{"project":"Notepad++ macOS","version":"1.0.0","engine":"Monaco & V8","features":["Multi-tab buffers","Floppy disk dirty indicators","Plugins Admin","Side-by-side Compare","XML Tools & XPath","JSON Formatter & Tree","TextFX sorting & deduplication","NppExec script runner"],"plugins":{"builtin":["compare","xml-tools","json-tools","text-fx","npp-exec"],"marketplace":["hex-editor","markdown-preview","hash-generator","lorem-ipsum","regex-tester"]}}`;

  // Create initial tabs
  tabsManager.createTab('Welcome.txt', welcomeContent, null, 'plaintext');
  tabsManager.createTab('Sample.xml', sampleXml, null, 'xml');
  tabsManager.createTab('Sample.json', sampleJson, null, 'json');

  // Activate the welcome tab
  const allTabs = tabsManager.getAllTabs();
  if (allTabs.length > 0) {
    tabsManager.activateTab(allTabs[0].id);
    tabsManager.setTabDirty(allTabs[0].id, false);
    tabsManager.setTabDirty(allTabs[1].id, false);
    tabsManager.setTabDirty(allTabs[2].id, false);
  }
}
