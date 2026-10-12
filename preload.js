const { contextBridge, ipcRenderer } = require('electron');
const crypto = require('crypto');
const { XMLParser, XMLBuilder, XMLValidator } = require('fast-xml-parser');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: (opts) => ipcRenderer.invoke('dialog:saveFileDialog', opts),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (opts) => ipcRenderer.invoke('fs:writeFile', opts),
  revealInFinder: (filePath) => ipcRenderer.invoke('fs:revealInFinder', filePath),

  // Plugins management
  getPluginsDirectory: () => ipcRenderer.invoke('plugins:getDirectory'),
  openPluginsDirectory: () => ipcRenderer.invoke('plugins:openDirectory'),
  listUserPlugins: () => ipcRenderer.invoke('plugins:listUserPlugins'),
  installPlugin: (opts) => ipcRenderer.invoke('plugins:installPlugin', opts),
  uninstallPlugin: (pluginId) => ipcRenderer.invoke('plugins:uninstallPlugin', pluginId),

  // Script Runner (NppExec)
  executeCommand: (opts) => ipcRenderer.invoke('runner:execute', opts),
  stopCommand: () => ipcRenderer.invoke('runner:stop'),

  // Utilities for XML Tools and TextFX plugins
  xml: {
    validate: (xmlString) => {
      try {
        const result = XMLValidator.validate(xmlString, {
          allowBooleanAttributes: true
        });
        if (result === true) {
          return { valid: true };
        } else {
          return {
            valid: false,
            err: {
              code: result.err.code,
              msg: result.err.msg,
              line: result.err.line,
              col: result.err.col
            }
          };
        }
      } catch (e) {
        return { valid: false, err: { msg: e.message, line: 1, col: 1 } };
      }
    },
    parse: (xmlString) => {
      const parser = new XMLParser({ ignoreAttributes: false });
      return parser.parse(xmlString);
    }
  },

  // Crypto hashing utility for plugins
  crypto: {
    hash: (algorithm, text) => {
      try {
        return crypto.createHash(algorithm).update(text, 'utf8').digest('hex');
      } catch (e) {
        return null;
      }
    }
  },

  // Event Listeners from Main process
  on: (channel, callback) => {
    const validChannels = [
      'menu:new-tab', 'menu:save', 'menu:save-as', 'menu:save-all',
      'menu:close-tab', 'menu:close-all-tabs', 'menu:reveal-file',
      'menu:about', 'menu:preferences', 'menu:shortcuts', 'menu:plugin-guide',
      'editor:undo', 'editor:redo', 'editor:cut', 'editor:copy', 'editor:paste',
      'editor:select-all', 'editor:duplicate-line', 'editor:delete-line',
      'editor:move-line-up', 'editor:move-line-down',
      'search:open-find', 'search:open-replace', 'search:find-next', 'search:find-prev', 'search:goto-line',
      'view:toggle-word-wrap', 'view:toggle-minimap', 'view:toggle-line-numbers',
      'view:toggle-whitespace', 'view:zoom-in', 'view:zoom-out', 'view:zoom-reset', 'view:toggle-theme',
      'encoding:set', 'lang:set',
      'plugins:open-admin', 'plugins:reload',
      'compare:start', 'compare:clear', 'compare:next', 'compare:prev',
      'xml:pretty-print', 'xml:linearize', 'xml:validate', 'xml:xpath-modal',
      'json:format-2', 'json:format-4', 'json:minify', 'json:validate', 'json:tree-modal',
      'textfx:sort-asc', 'textfx:sort-desc', 'textfx:remove-duplicates', 'textfx:trim-trailing',
      'textfx:case-upper', 'textfx:case-lower', 'textfx:case-title', 'textfx:case-camel', 'textfx:case-snake',
      'textfx:base64-encode', 'textfx:base64-decode', 'textfx:url-encode', 'textfx:url-decode', 'textfx:stats',
      'nppexec:run', 'nppexec:toggle-console',
      'file:opened',
      'runner:started', 'runner:stdout', 'runner:stderr', 'runner:completed'
    ];

    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  }
});
