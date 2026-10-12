/**
 * Notepad++ (macOS) Plugin Host & Marketplace Manager
 * Manages plugin lifecycle, API bridge, built-ins, and user installed plugins
 */

class PluginHost {
  constructor(editorManager, tabsManager, uiManager) {
    this.editorManager = editorManager;
    this.tabsManager = tabsManager;
    this.uiManager = uiManager;

    this.installedPlugins = new Map();
    this.pluginConfigs = new Map();
    this.marketplacePlugins = [];

    this._setupMarketplaceRegistry();
    this._bindAdminModal();
  }

  getApi() {
    return {
      editor: {
        getText: () => this.editorManager.getValue(),
        setText: (text) => this.editorManager.setValue(text),
        getSelection: () => this.editorManager.getSelection(),
        replaceSelection: (text) => this.editorManager.replaceSelection(text),
        getLanguage: () => this.editorManager.getLanguage(),
        setLanguage: (lang) => this.editorManager.setLanguage(lang),
        getActiveTab: () => this.tabsManager.getActiveTab(),
        getAllTabs: () => this.tabsManager.getAllTabs(),
        insertAtCursor: (text) => this.editorManager.replaceSelection(text)
      },
      compare: {
        start: (originalTabId, modifiedTabId) => {
          const tab1 = this.tabsManager.getTabById(originalTabId);
          const tab2 = this.tabsManager.getTabById(modifiedTabId);
          if (tab1 && tab2) {
            this.editorManager.startCompare(tab1.model, tab2.model, tab1.title, tab2.title);
          }
        },
        clear: () => this.editorManager.stopCompare(),
        next: () => this.editorManager.nextDiff(),
        prev: () => this.editorManager.prevDiff()
      },
      ui: {
        showToast: (msg, type) => this.uiManager.showToast(msg, type),
        showModal: (id) => this.uiManager.showModal(id),
        hideModal: (id) => this.uiManager.hideModal(id)
      },
      system: {
        xml: window.electronAPI.xml,
        crypto: window.electronAPI.crypto,
        executeCommand: (opts) => window.electronAPI.executeCommand(opts),
        stopCommand: () => window.electronAPI.stopCommand(),
        openPluginsFolder: () => window.electronAPI.openPluginsDirectory()
      }
    };
  }

  registerPlugin(manifest, pluginModule) {
    const id = manifest.id;
    try {
      const api = this.getApi();
      if (pluginModule && typeof pluginModule.activate === 'function') {
        pluginModule.activate(api);
      }
      this.installedPlugins.set(id, {
        manifest,
        instance: pluginModule,
        enabled: true,
        isBuiltin: manifest.isBuiltin || false
      });
    } catch (e) {
      console.error(`Failed to activate plugin ${id}:`, e);
      this.uiManager.showToast(`Plugin error in ${manifest.name}: ${e.message}`, 'error');
    }
  }

  async loadAllPlugins() {
    // 1. Register Built-in Power Plugins
    this._loadBuiltInPlugins();

    // 2. Load User Plugins from disk
    try {
      const userPlugins = await window.electronAPI.listUserPlugins();
      for (const p of userPlugins) {
        try {
          const func = new Function('api', p.code + '\nreturn (typeof plugin !== "undefined" ? plugin : (typeof exports !== "undefined" ? exports : {}));');
          const instance = func(this.getApi());
          this.registerPlugin({
            id: p.id,
            name: p.name,
            version: p.version,
            description: p.description,
            author: p.author,
            isBuiltin: false
          }, instance);
        } catch (err) {
          console.error(`Failed loading user plugin ${p.id}:`, err);
        }
      }
    } catch (e) {
      console.error('Error listing user plugins:', e);
    }
  }

  _loadBuiltInPlugins() {
    const api = this.getApi();

    // 1. Compare Plugin
    this.registerPlugin({
      id: 'npp-compare',
      name: 'Compare Plugin',
      version: '2.0.1',
      description: 'Side-by-side visual diff tool with synchronized scrolling and difference navigation.',
      author: 'Notepad++ Team',
      isBuiltin: true
    }, {
      activate: (api) => {
        // Exposed handlers for menu & toolbar
        window.comparePlugin = {
          openComparePicker: () => {
            const tabs = api.editor.getAllTabs();
            const active = api.editor.getActiveTab();
            if (!active || tabs.length < 2) {
              api.ui.showToast('Please open at least two tabs to compare.', 'info');
              return;
            }
            const selectEl = document.getElementById('compare-target-select');
            selectEl.innerHTML = '';
            tabs.forEach(t => {
              if (t.id !== active.id) {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = `${t.title} (${t.filePath || 'unsaved'})`;
                selectEl.appendChild(opt);
              }
            });
            api.ui.showModal('compare-picker-modal');
          },
          executeCompare: () => {
            const active = api.editor.getActiveTab();
            const selectEl = document.getElementById('compare-target-select');
            const targetId = selectEl.value;
            api.compare.start(active.id, targetId);
            api.ui.hideModal('compare-picker-modal');
            api.ui.showToast('Comparing files side-by-side', 'info');
          },
          clearCompare: () => {
            api.compare.clear();
            api.ui.showToast('Comparison closed', 'info');
          }
        };
      }
    });

    // 2. XML Tools Plugin
    this.registerPlugin({
      id: 'xml-tools',
      name: 'XML Tools',
      version: '3.1.2',
      description: 'XML pretty print indent, linearize (minify), syntax validation, and XPath evaluator.',
      author: 'Notepad++ Community',
      isBuiltin: true
    }, {
      activate: (api) => {
        window.xmlToolsPlugin = {
          prettyPrint: (indentSpaces = 2) => {
            const text = api.editor.getText();
            if (!text.trim()) return;

            // First check validation
            const validation = api.system.xml.validate(text);
            if (!validation.valid) {
              api.ui.showToast(`XML Error (Line ${validation.err.line}): ${validation.err.msg}`, 'error');
              return;
            }

            try {
              // High performance XML Formatter
              const formatted = formatXml(text, indentSpaces);
              api.editor.setText(formatted);
              api.editor.setLanguage('xml');
              api.ui.showToast('XML formatted successfully', 'success');
            } catch (e) {
              api.ui.showToast(`Format failed: ${e.message}`, 'error');
            }
          },
          linearize: () => {
            const text = api.editor.getText();
            if (!text.trim()) return;
            try {
              const minified = text
                .replace(/>\s+</g, '><')
                .replace(/\s+/g, ' ')
                .replace(/>\s+/g, '>')
                .replace(/\s+</g, '<')
                .trim();
              api.editor.setText(minified);
              api.ui.showToast('XML linearized (minified)', 'success');
            } catch (e) {
              api.ui.showToast(`Linearize failed: ${e.message}`, 'error');
            }
          },
          validate: () => {
            const text = api.editor.getText();
            if (!text.trim()) return;
            const res = api.system.xml.validate(text);
            if (res.valid) {
              api.ui.showToast('XML is valid and well-formed!', 'success');
            } else {
              api.ui.showToast(`XML Validation Error at Line ${res.err.line}, Col ${res.err.col}: ${res.err.msg}`, 'error');
            }
          },
          openXPathModal: () => {
            api.ui.showModal('xpath-modal');
            document.getElementById('xpath-query-input').focus();
          },
          evaluateXPath: () => {
            const query = document.getElementById('xpath-query-input').value.trim();
            const text = api.editor.getText();
            const resultsEl = document.getElementById('xpath-results');

            if (!query) {
              resultsEl.textContent = 'Please enter an XPath query.';
              return;
            }

            try {
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(text, 'application/xml');
              const parseError = xmlDoc.getElementsByTagName('parsererror');
              if (parseError.length > 0) {
                resultsEl.textContent = 'XML Parsing error:\n' + parseError[0].textContent;
                return;
              }

              const results = [];
              const xpathResult = xmlDoc.evaluate(query, xmlDoc, null, XPathResult.ANY_TYPE, null);
              let node = xpathResult.iterateNext();
              while (node) {
                const nodeStr = node.nodeType === Node.ATTRIBUTE_NODE ? `${node.nodeName}="${node.nodeValue}"` : (node.outerHTML || node.textContent || '');
                results.push(nodeStr);
                node = xpathResult.iterateNext();
              }

              if (results.length === 0) {
                resultsEl.textContent = `No nodes matched XPath expression: "${query}"`;
              } else {
                resultsEl.textContent = `Found ${results.length} match(es):\n\n` + results.join('\n---\n');
              }
            } catch (e) {
              resultsEl.textContent = `XPath evaluation error: ${e.message}`;
            }
          }
        };
      }
    });

    // 3. JSON Tools Plugin
    this.registerPlugin({
      id: 'json-tools',
      name: 'JSON Tools',
      version: '2.5.0',
      description: 'JSON formatting, minification, syntax validation, and collapsible tree inspector.',
      author: 'Notepad++ Community',
      isBuiltin: true
    }, {
      activate: (api) => {
        window.jsonToolsPlugin = {
          format: (indent = 2) => {
            const text = api.editor.getText();
            if (!text.trim()) return;
            try {
              const parsed = JSON.parse(text);
              const formatted = JSON.stringify(parsed, null, indent);
              api.editor.setText(formatted);
              api.editor.setLanguage('json');
              api.ui.showToast(`JSON formatted (indent ${indent})`, 'success');
            } catch (e) {
              api.ui.showToast(`JSON Syntax Error: ${e.message}`, 'error');
            }
          },
          minify: () => {
            const text = api.editor.getText();
            if (!text.trim()) return;
            try {
              const parsed = JSON.parse(text);
              const minified = JSON.stringify(parsed);
              api.editor.setText(minified);
              api.ui.showToast('JSON minified', 'success');
            } catch (e) {
              api.ui.showToast(`JSON Error: ${e.message}`, 'error');
            }
          },
          validate: () => {
            const text = api.editor.getText();
            if (!text.trim()) return;
            try {
              JSON.parse(text);
              api.ui.showToast('JSON is valid!', 'success');
            } catch (e) {
              api.ui.showToast(`Invalid JSON: ${e.message}`, 'error');
            }
          },
          openTreeViewer: () => {
            const text = api.editor.getText();
            try {
              const parsed = JSON.parse(text);
              const container = document.getElementById('json-tree-container');
              container.innerHTML = '';
              container.appendChild(renderJsonTree(parsed));
              api.ui.showModal('json-tree-modal');
            } catch (e) {
              api.ui.showToast(`Cannot parse JSON for tree viewer: ${e.message}`, 'error');
            }
          }
        };
      }
    });

    // 4. TextFX Tools Plugin
    this.registerPlugin({
      id: 'text-fx',
      name: 'TextFX Characters & Lines',
      version: '1.2.0',
      description: 'Text transformations: sort lines, deduplicate, case changes, Base64/URL encoding, statistics.',
      author: 'TextFX Team',
      isBuiltin: true
    }, {
      activate: (api) => {
        window.textFxPlugin = {
          sortLines: (ascending = true) => {
            const sel = api.editor.getSelection();
            const text = sel || api.editor.getText();
            const lines = text.split('\n');
            lines.sort((a, b) => ascending ? a.localeCompare(b) : b.localeCompare(a));
            const result = lines.join('\n');
            if (sel) api.editor.replaceSelection(result);
            else api.editor.setText(result);
            api.ui.showToast(`Sorted lines (${ascending ? 'Ascending' : 'Descending'})`, 'success');
          },
          removeDuplicates: () => {
            const sel = api.editor.getSelection();
            const text = sel || api.editor.getText();
            const lines = text.split('\n');
            const unique = Array.from(new Set(lines));
            const removed = lines.length - unique.length;
            const result = unique.join('\n');
            if (sel) api.editor.replaceSelection(result);
            else api.editor.setText(result);
            api.ui.showToast(`Removed ${removed} duplicate line(s)`, 'success');
          },
          trimTrailing: () => {
            const text = api.editor.getText();
            const trimmed = text.split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
            api.editor.setText(trimmed);
            api.ui.showToast('Trimmed trailing whitespace', 'success');
          },
          convertCase: (mode) => {
            const sel = api.editor.getSelection();
            const text = sel || api.editor.getText();
            let result = text;
            if (mode === 'upper') result = text.toUpperCase();
            else if (mode === 'lower') result = text.toLowerCase();
            else if (mode === 'title') result = text.replace(/\b\w/g, l => l.toUpperCase());
            else if (mode === 'camel') result = toCamelCase(text);
            else if (mode === 'snake') result = toSnakeCase(text);

            if (sel) api.editor.replaceSelection(result);
            else api.editor.setText(result);
            api.ui.showToast(`Converted case: ${mode}`, 'success');
          },
          base64: (encode = true) => {
            const sel = api.editor.getSelection();
            const text = sel || api.editor.getText();
            try {
              const res = encode ? btoa(unescape(encodeURIComponent(text))) : decodeURIComponent(escape(atob(text)));
              if (sel) api.editor.replaceSelection(res);
              else api.editor.setText(res);
              api.ui.showToast(`Base64 ${encode ? 'Encoded' : 'Decoded'}`, 'success');
            } catch (e) {
              api.ui.showToast(`Base64 error: ${e.message}`, 'error');
            }
          },
          urlEncode: (encode = true) => {
            const sel = api.editor.getSelection();
            const text = sel || api.editor.getText();
            try {
              const res = encode ? encodeURIComponent(text) : decodeURIComponent(text);
              if (sel) api.editor.replaceSelection(res);
              else api.editor.setText(res);
              api.ui.showToast(`URL ${encode ? 'Encoded' : 'Decoded'}`, 'success');
            } catch (e) {
              api.ui.showToast(`URL error: ${e.message}`, 'error');
            }
          },
          showStats: () => {
            const text = api.editor.getText();
            const lines = text.length === 0 ? 0 : text.split('\n').length;
            const words = (text.match(/\S+/g) || []).length;
            const charsWithSpaces = text.length;
            const charsNoSpaces = text.replace(/\s/g, '').length;
            const bytes = new Blob([text]).size;

            const bodyEl = document.getElementById('stats-modal-body');
            bodyEl.innerHTML = `
              <div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; font-size: 13px;">
                <strong>Lines:</strong> <span>${lines.toLocaleString()}</span>
                <strong>Words:</strong> <span>${words.toLocaleString()}</span>
                <strong>Characters (all):</strong> <span>${charsWithSpaces.toLocaleString()}</span>
                <strong>Characters (no spaces):</strong> <span>${charsNoSpaces.toLocaleString()}</span>
                <strong>File Size:</strong> <span>${(bytes / 1024).toFixed(2)} KB (${bytes.toLocaleString()} bytes)</span>
              </div>
            `;
            api.ui.showModal('stats-modal');
          }
        };
      }
    });

    // 5. NppExec Plugin (Script Runner)
    this.registerPlugin({
      id: 'npp-exec',
      name: 'NppExec Script Runner',
      version: '0.8.5',
      description: 'Execute current file with Python, Node.js, or Shell and view output in integrated console.',
      author: 'Notepad++ Community',
      isBuiltin: true
    }, {
      activate: (api) => {
        window.nppExecPlugin = {
          toggleConsole: () => {
            const panel = document.getElementById('console-panel');
            panel.classList.toggle('active');
          },
          runCurrent: async () => {
            const tab = api.editor.getActiveTab();
            const text = api.editor.getText();
            if (!text.trim()) {
              api.ui.showToast('Nothing to execute (empty document)', 'info');
              return;
            }

            const lang = api.editor.getLanguage();
            let cmd = 'node';
            if (lang === 'python') cmd = 'python3';
            else if (lang === 'shell') cmd = 'bash';

            const panel = document.getElementById('console-panel');
            panel.classList.add('active');
            const outputEl = document.getElementById('console-output');
            outputEl.textContent = `>>> Running script with [${cmd}]...\n`;

            await api.system.executeCommand({
              command: cmd,
              args: [],
              inputScript: text
            });
          }
        };
      }
    });
  }

  _setupMarketplaceRegistry() {
    this.marketplacePlugins = [
      {
        id: 'hex-editor',
        name: 'Hex Editor',
        version: '1.0.0',
        author: 'NppMac Team',
        description: 'View document binary bytes in hexadecimal and ASCII side-by-side.',
        code: `
          plugin = {
            activate: function(api) {
              api.ui.showToast('Hex Editor loaded', 'info');
            }
          };
        `
      },
      {
        id: 'markdown-preview',
        name: 'Markdown Live Preview',
        version: '1.2.0',
        author: 'NppMac Community',
        description: 'Real-time rendering of Markdown documents to HTML preview.',
        code: `
          plugin = {
            activate: function(api) {
              api.ui.showToast('Markdown Preview loaded', 'info');
            }
          };
        `
      },
      {
        id: 'hash-generator',
        name: 'Hash & UUID Generator',
        version: '1.1.0',
        author: 'Security Tools',
        description: 'Quickly calculate MD5, SHA-256 hashes of selection and generate UUIDv4.',
        code: `
          plugin = {
            activate: function(api) {
              api.ui.showToast('Hash Generator loaded', 'info');
            }
          };
        `
      },
      {
        id: 'lorem-ipsum',
        name: 'Lorem Ipsum Generator',
        version: '1.0.2',
        author: 'WebTools',
        description: 'Insert dummy placeholder text into document with 1 click.',
        code: `
          plugin = {
            activate: function(api) {
              api.ui.showToast('Lorem Ipsum loaded', 'info');
            }
          };
        `
      },
      {
        id: 'regex-tester',
        name: 'Regex Tester',
        version: '2.0.0',
        author: 'DevTools',
        description: 'Interactive regex testing panel with group captures and replace preview.',
        code: `
          plugin = {
            activate: function(api) {
              api.ui.showToast('Regex Tester loaded', 'info');
            }
          };
        `
      }
    ];
  }

  _bindAdminModal() {
    const adminModal = document.getElementById('plugins-admin-modal');
    document.getElementById('btn-close-plugins-admin').addEventListener('click', () => {
      adminModal.classList.remove('active');
    });
    document.getElementById('btn-close-plugins-admin-footer').addEventListener('click', () => {
      adminModal.classList.remove('active');
    });

    // Tab buttons
    const tabBtns = adminModal.querySelectorAll('.tab-nav-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderPluginsTable(btn.dataset.plugintab);
      });
    });

    // Search input
    document.getElementById('plugins-search-input').addEventListener('input', (e) => {
      const activeTab = adminModal.querySelector('.tab-nav-btn.active').dataset.plugintab;
      this.renderPluginsTable(activeTab, e.target.value);
    });

    // Open plugins folder
    document.getElementById('btn-open-plugins-dir').addEventListener('click', () => {
      window.electronAPI.openPluginsDirectory();
    });

    // Reload plugins
    document.getElementById('btn-reload-plugins').addEventListener('click', async () => {
      await this.loadAllPlugins();
      const activeTab = adminModal.querySelector('.tab-nav-btn.active').dataset.plugintab;
      this.renderPluginsTable(activeTab);
      this.uiManager.showToast('Plugins reloaded', 'success');
    });
  }

  openAdminModal() {
    document.getElementById('plugins-admin-modal').classList.add('active');
    this.renderPluginsTable('installed');
  }

  renderPluginsTable(tab = 'installed', query = '') {
    const wrapper = document.getElementById('plugins-table-wrapper');
    const q = query.toLowerCase();

    if (tab === 'installed') {
      const list = Array.from(this.installedPlugins.values()).filter(p => {
        return !q || p.manifest.name.toLowerCase().includes(q) || p.manifest.description.toLowerCase().includes(q);
      });

      let html = `
        <table class="plugins-table">
          <thead>
            <tr>
              <th style="width: 180px;">Plugin Name</th>
              <th style="width: 70px;">Version</th>
              <th style="width: 120px;">Author</th>
              <th>Description</th>
              <th style="width: 90px; text-align: center;">Action</th>
            </tr>
          </thead>
          <tbody>
      `;

      list.forEach(item => {
        const m = item.manifest;
        html += `
          <tr>
            <td>
              <strong>${m.name}</strong>
              ${item.isBuiltin ? '<span class="plugin-badge builtin" style="margin-left: 4px;">Built-in</span>' : '<span class="plugin-badge" style="margin-left: 4px;">User</span>'}
            </td>
            <td><code>${m.version}</code></td>
            <td>${m.author}</td>
            <td style="color: var(--text-muted); font-size: 11px;">${m.description}</td>
            <td style="text-align: center;">
              ${item.isBuiltin ? '<span style="color: var(--text-muted); font-size: 11px;">System</span>' : `<button class="btn" onclick="window.pluginHost.uninstallUserPlugin('${m.id}')" style="padding: 2px 8px; font-size: 11px; color: var(--dirty-red);">Uninstall</button>`}
            </td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
      wrapper.innerHTML = html;
    } else {
      // Marketplace
      const list = this.marketplacePlugins.filter(p => {
        return !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      });

      let html = `
        <table class="plugins-table">
          <thead>
            <tr>
              <th style="width: 180px;">Plugin Name</th>
              <th style="width: 70px;">Version</th>
              <th style="width: 120px;">Author</th>
              <th>Description</th>
              <th style="width: 90px; text-align: center;">Action</th>
            </tr>
          </thead>
          <tbody>
      `;

      list.forEach(m => {
        const isInstalled = this.installedPlugins.has(m.id);
        html += `
          <tr>
            <td><strong>${m.name}</strong></td>
            <td><code>${m.version}</code></td>
            <td>${m.author}</td>
            <td style="color: var(--text-muted); font-size: 11px;">${m.description}</td>
            <td style="text-align: center;">
              ${isInstalled ? '<span class="plugin-badge" style="background: var(--clean-blue);">Installed</span>' : `<button class="btn btn-primary" onclick="window.pluginHost.installMarketplacePlugin('${m.id}')" style="padding: 2px 8px; font-size: 11px;">Install</button>`}
            </td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
      wrapper.innerHTML = html;
    }
  }

  async installMarketplacePlugin(pluginId) {
    const item = this.marketplacePlugins.find(p => p.id === pluginId);
    if (!item) return;

    const manifest = {
      id: item.id,
      name: item.name,
      version: item.version,
      description: item.description,
      author: item.author
    };

    const res = await window.electronAPI.installPlugin({
      pluginId: item.id,
      manifest: manifest,
      code: item.code
    });

    if (res.success) {
      this.uiManager.showToast(`Installed plugin: ${item.name}`, 'success');
      await this.loadAllPlugins();
      this.renderPluginsTable('available');
    } else {
      this.uiManager.showToast(`Install failed: ${res.error}`, 'error');
    }
  }

  async uninstallUserPlugin(pluginId) {
    const res = await window.electronAPI.uninstallPlugin(pluginId);
    if (res.success) {
      this.installedPlugins.delete(pluginId);
      this.uiManager.showToast(`Uninstalled plugin: ${pluginId}`, 'success');
      this.renderPluginsTable('installed');
    } else {
      this.uiManager.showToast(`Uninstall failed: ${res.error}`, 'error');
    }
  }
}

// Helpers for XML & JSON tools
function formatXml(xml, indent = 2) {
  let formatted = '';
  let pad = 0;
  const PADDING = ' '.repeat(indent);

  // Split XML into tokens
  xml = xml.replace(/(>)(<)(\/*)/g, '$1\r\n$2$3');
  const lines = xml.split('\r\n');

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    if (line.match(/^<\/\w/)) {
      pad = Math.max(0, pad - 1);
    }

    formatted += PADDING.repeat(pad) + line + '\n';

    if (line.match(/^<\w[^>]*[^\/]>$/) && !line.startsWith('<?') && !line.startsWith('<!')) {
      pad++;
    }
  }

  return formatted.trim();
}

function renderJsonTree(data) {
  const root = document.createElement('div');
  root.style.paddingLeft = '6px';

  function createNode(key, val) {
    const nodeEl = document.createElement('div');
    nodeEl.style.margin = '2px 0';

    if (val !== null && typeof val === 'object') {
      const isArray = Array.isArray(val);
      const keys = Object.keys(val);
      const header = document.createElement('div');
      header.style.cursor = 'pointer';
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.gap = '4px';

      const toggle = document.createElement('span');
      toggle.textContent = '▼';
      toggle.style.fontSize = '9px';
      toggle.style.color = 'var(--text-muted)';

      const keyLabel = document.createElement('span');
      keyLabel.style.color = '#3498db';
      keyLabel.textContent = key !== null ? `"${key}": ` : '';

      const typeLabel = document.createElement('span');
      typeLabel.style.color = 'var(--text-muted)';
      typeLabel.textContent = isArray ? `Array(${keys.length})` : `Object{${keys.length}}`;

      header.appendChild(toggle);
      header.appendChild(keyLabel);
      header.appendChild(typeLabel);

      const childrenContainer = document.createElement('div');
      childrenContainer.style.paddingLeft = '16px';
      childrenContainer.style.borderLeft = '1px solid var(--border-color)';
      childrenContainer.style.marginLeft = '4px';

      keys.forEach(k => {
        childrenContainer.appendChild(createNode(isArray ? null : k, val[k]));
      });

      header.addEventListener('click', () => {
        const isHidden = childrenContainer.style.display === 'none';
        childrenContainer.style.display = isHidden ? 'block' : 'none';
        toggle.textContent = isHidden ? '▼' : '▶';
      });

      nodeEl.appendChild(header);
      nodeEl.appendChild(childrenContainer);
    } else {
      const line = document.createElement('div');
      line.style.display = 'flex';
      line.style.gap = '4px';

      if (key !== null) {
        const keyLabel = document.createElement('span');
        keyLabel.style.color = '#3498db';
        keyLabel.textContent = `"${key}":`;
        line.appendChild(keyLabel);
      }

      const valLabel = document.createElement('span');
      if (typeof val === 'string') {
        valLabel.style.color = '#2ecc71';
        valLabel.textContent = `"${val}"`;
      } else if (typeof val === 'number') {
        valLabel.style.color = '#e67e22';
        valLabel.textContent = val;
      } else if (typeof val === 'boolean') {
        valLabel.style.color = '#9b59b6';
        valLabel.textContent = val;
      } else {
        valLabel.style.color = '#95a5a6';
        valLabel.textContent = 'null';
      }

      line.appendChild(valLabel);
      nodeEl.appendChild(line);
    }

    return nodeEl;
  }

  root.appendChild(createNode(null, data));
  return root;
}

function toCamelCase(str) {
  return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => {
    if (+match === 0) return '';
    return index === 0 ? match.toLowerCase() : match.toUpperCase();
  }).replace(/[\s\-_]+/g, '');
}

function toSnakeCase(str) {
  return str.replace(/\W+/g, ' ')
    .split(/ |\B(?=[A-Z])/)
    .map(word => word.toLowerCase())
    .join('_');
}

window.PluginHost = PluginHost;
