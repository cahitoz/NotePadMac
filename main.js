const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

let mainWindow = null;
let activeRunningProcess = null;

// User plugins folder in application support
const userPluginsDir = path.join(app.getPath('userData'), 'plugins');
if (!fs.existsSync(userPluginsDir)) {
  fs.mkdirSync(userPluginsDir, { recursive: true });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 500,
    title: 'Notepad++ (macOS)',
    icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
    backgroundColor: '#1e1e1e',
    titleBarStyle: 'hiddenInset', // Mac sleek integrated traffic lights
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  setupAppMenu();

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (activeRunningProcess) {
      try { activeRunningProcess.kill(); } catch (e) {}
    }
  });
}

function setupAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: 'Notepad++',
      submenu: [
        { label: 'About Notepad++ (macOS)', click: () => sendToRenderer('menu:about') },
        { type: 'separator' },
        { label: 'Preferences...', accelerator: 'Cmd+,', click: () => sendToRenderer('menu:preferences') },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => sendToRenderer('menu:new-tab') },
        { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: () => handleOpenFile() },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendToRenderer('menu:save') },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendToRenderer('menu:save-as') },
        { label: 'Save All', accelerator: 'Alt+CmdOrCtrl+S', click: () => sendToRenderer('menu:save-all') },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => sendToRenderer('menu:close-tab') },
        { label: 'Close All Tabs', click: () => sendToRenderer('menu:close-all-tabs') },
        { type: 'separator' },
        { label: 'Reveal in Finder', click: () => sendToRenderer('menu:reveal-file') },
        ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit' }])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => sendToRenderer('editor:undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => sendToRenderer('editor:redo') },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', click: () => sendToRenderer('editor:cut') },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => sendToRenderer('editor:copy') },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', click: () => sendToRenderer('editor:paste') },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => sendToRenderer('editor:select-all') },
        { type: 'separator' },
        { label: 'Duplicate Current Line', accelerator: 'CmdOrCtrl+D', click: () => sendToRenderer('editor:duplicate-line') },
        { label: 'Delete Current Line', accelerator: 'CmdOrCtrl+Shift+K', click: () => sendToRenderer('editor:delete-line') },
        { label: 'Move Line Up', accelerator: 'Alt+Up', click: () => sendToRenderer('editor:move-line-up') },
        { label: 'Move Line Down', accelerator: 'Alt+Down', click: () => sendToRenderer('editor:move-line-down') },
        { type: 'separator' },
        {
          label: 'Convert Case',
          submenu: [
            { label: 'UPPERCASE', accelerator: 'Ctrl+Shift+U', click: () => sendToRenderer('textfx:case-upper') },
            { label: 'lowercase', accelerator: 'Ctrl+U', click: () => sendToRenderer('textfx:case-lower') },
            { label: 'Title Case', click: () => sendToRenderer('textfx:case-title') },
            { label: 'camelCase', click: () => sendToRenderer('textfx:case-camel') },
            { label: 'snake_case', click: () => sendToRenderer('textfx:case-snake') }
          ]
        },
        {
          label: 'Line Operations',
          submenu: [
            { label: 'Sort Lines Ascending', click: () => sendToRenderer('textfx:sort-asc') },
            { label: 'Sort Lines Descending', click: () => sendToRenderer('textfx:sort-desc') },
            { label: 'Remove Duplicate Lines', click: () => sendToRenderer('textfx:remove-duplicates') },
            { label: 'Trim Trailing Whitespace', click: () => sendToRenderer('textfx:trim-trailing') }
          ]
        }
      ]
    },
    {
      label: 'Search',
      submenu: [
        { label: 'Find...', accelerator: 'CmdOrCtrl+F', click: () => sendToRenderer('search:open-find') },
        { label: 'Replace...', accelerator: 'CmdOrCtrl+H', click: () => sendToRenderer('search:open-replace') },
        { label: 'Find Next', accelerator: 'F3', click: () => sendToRenderer('search:find-next') },
        { label: 'Find Previous', accelerator: 'Shift+F3', click: () => sendToRenderer('search:find-prev') },
        { type: 'separator' },
        { label: 'Go to Line...', accelerator: 'CmdOrCtrl+G', click: () => sendToRenderer('search:goto-line') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Word Wrap', accelerator: 'Alt+Z', click: () => sendToRenderer('view:toggle-word-wrap') },
        { label: 'Toggle Document Map (Minimap)', click: () => sendToRenderer('view:toggle-minimap') },
        { label: 'Toggle Line Numbers', click: () => sendToRenderer('view:toggle-line-numbers') },
        { label: 'Show All Characters (Whitespace)', click: () => sendToRenderer('view:toggle-whitespace') },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => sendToRenderer('view:zoom-in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => sendToRenderer('view:zoom-out') },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => sendToRenderer('view:zoom-reset') },
        { type: 'separator' },
        { label: 'Toggle Dark / Light Theme', click: () => sendToRenderer('view:toggle-theme') },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Encoding',
      submenu: [
        { label: 'UTF-8', type: 'radio', checked: true, click: () => sendToRenderer('encoding:set', 'utf-8') },
        { label: 'UTF-16 LE', type: 'radio', click: () => sendToRenderer('encoding:set', 'utf-16le') },
        { label: 'ANSI / Windows-1252', type: 'radio', click: () => sendToRenderer('encoding:set', 'windows-1252') }
      ]
    },
    {
      label: 'Language',
      submenu: [
        { label: 'Plain Text', click: () => sendToRenderer('lang:set', 'plaintext') },
        { type: 'separator' },
        { label: 'XML', click: () => sendToRenderer('lang:set', 'xml') },
        { label: 'JSON', click: () => sendToRenderer('lang:set', 'json') },
        { label: 'HTML', click: () => sendToRenderer('lang:set', 'html') },
        { label: 'CSS', click: () => sendToRenderer('lang:set', 'css') },
        { label: 'JavaScript', click: () => sendToRenderer('lang:set', 'javascript') },
        { label: 'TypeScript', click: () => sendToRenderer('lang:set', 'typescript') },
        { label: 'Python', click: () => sendToRenderer('lang:set', 'python') },
        { label: 'Shell / Bash', click: () => sendToRenderer('lang:set', 'shell') },
        { label: 'SQL', click: () => sendToRenderer('lang:set', 'sql') },
        { label: 'Markdown', click: () => sendToRenderer('lang:set', 'markdown') },
        { label: 'C / C++', click: () => sendToRenderer('lang:set', 'cpp') },
        { label: 'Java', click: () => sendToRenderer('lang:set', 'java') },
        { label: 'Rust', click: () => sendToRenderer('lang:set', 'rust') },
        { label: 'Go', click: () => sendToRenderer('lang:set', 'go') },
        { label: 'YAML', click: () => sendToRenderer('lang:set', 'yaml') },
        { label: 'INI', click: () => sendToRenderer('lang:set', 'ini') }
      ]
    },
    {
      label: 'Plugins',
      submenu: [
        { label: 'Plugins Admin...', accelerator: 'CmdOrCtrl+Shift+P', click: () => sendToRenderer('plugins:open-admin') },
        { label: 'Open Plugins Folder', click: () => shell.openPath(userPluginsDir) },
        { label: 'Reload Plugins', accelerator: 'CmdOrCtrl+Alt+R', click: () => sendToRenderer('plugins:reload') },
        { type: 'separator' },
        {
          label: 'Compare',
          submenu: [
            { label: 'Compare Active Tab with Other Tab...', accelerator: 'Alt+D', click: () => sendToRenderer('compare:start') },
            { label: 'Clear Active Comparison', click: () => sendToRenderer('compare:clear') },
            { label: 'Next Difference', accelerator: 'F8', click: () => sendToRenderer('compare:next') },
            { label: 'Previous Difference', accelerator: 'Shift+F8', click: () => sendToRenderer('compare:prev') }
          ]
        },
        {
          label: 'XML Tools',
          submenu: [
            { label: 'Pretty Print (Format Indent)', accelerator: 'Ctrl+Alt+Shift+B', click: () => sendToRenderer('xml:pretty-print') },
            { label: 'Linearize XML (Minify)', click: () => sendToRenderer('xml:linearize') },
            { label: 'Check XML Syntax (Validate)', click: () => sendToRenderer('xml:validate') },
            { label: 'XPath Evaluator...', click: () => sendToRenderer('xml:xpath-modal') }
          ]
        },
        {
          label: 'JSON Tools',
          submenu: [
            { label: 'Format JSON (Indent 2)', accelerator: 'Ctrl+Alt+Shift+J', click: () => sendToRenderer('json:format-2') },
            { label: 'Format JSON (Indent 4)', click: () => sendToRenderer('json:format-4') },
            { label: 'Minify JSON', click: () => sendToRenderer('json:minify') },
            { label: 'Validate JSON Syntax', click: () => sendToRenderer('json:validate') },
            { label: 'JSON Tree Viewer...', click: () => sendToRenderer('json:tree-modal') }
          ]
        },
        {
          label: 'TextFX Tools',
          submenu: [
            { label: 'Base64 Encode', click: () => sendToRenderer('textfx:base64-encode') },
            { label: 'Base64 Decode', click: () => sendToRenderer('textfx:base64-decode') },
            { label: 'URL Encode', click: () => sendToRenderer('textfx:url-encode') },
            { label: 'URL Decode', click: () => sendToRenderer('textfx:url-decode') },
            { label: 'Document Word & Char Statistics', click: () => sendToRenderer('textfx:stats') }
          ]
        },
        {
          label: 'NppExec (Runner)',
          submenu: [
            { label: 'Execute Current Script (Run)...', accelerator: 'F5', click: () => sendToRenderer('nppexec:run') },
            { label: 'Toggle Console Output Panel', accelerator: 'F6', click: () => sendToRenderer('nppexec:toggle-console') }
          ]
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Notepad++ Mac Help & Shortcuts', click: () => sendToRenderer('menu:shortcuts') },
        { label: 'Plugin Developer Guide', click: () => sendToRenderer('menu:plugin-guide') },
        { type: 'separator' },
        { label: 'About Notepad++ Mac', click: () => sendToRenderer('menu:about') }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function sendToRenderer(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

async function handleOpenFile() {
  if (!mainWindow) return;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Text / Code Files', extensions: ['txt', 'xml', 'json', 'js', 'ts', 'py', 'html', 'css', 'md', 'sh', 'sql', 'c', 'cpp', 'h', 'java', 'rs', 'go', 'yaml', 'yml', 'ini', 'cfg', 'log'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    for (const filePath of result.filePaths) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        sendToRenderer('file:opened', { filePath, content });
      } catch (err) {
        dialog.showErrorBox('Error opening file', `Could not open file: ${filePath}\n${err.message}`);
      }
    }
  }
}

// IPC Handlers
ipcMain.handle('dialog:openFile', handleOpenFile);

ipcMain.handle('dialog:saveFileDialog', async (event, { defaultPath, title }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: title || 'Save File',
    defaultPath: defaultPath || 'Untitled.txt',
    filters: [{ name: 'All Files', extensions: ['*'] }]
  });
  return result;
});

ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs:writeFile', async (event, { filePath, content }) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs:revealInFinder', async (event, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('plugins:getDirectory', () => {
  return userPluginsDir;
});

ipcMain.handle('plugins:openDirectory', () => {
  shell.openPath(userPluginsDir);
  return true;
});

ipcMain.handle('plugins:listUserPlugins', async () => {
  try {
    const entries = await fs.promises.readdir(userPluginsDir, { withFileTypes: true });
    const plugins = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(userPluginsDir, entry.name, 'plugin.json');
        const indexPath = path.join(userPluginsDir, entry.name, 'index.js');
        if (fs.existsSync(manifestPath) && fs.existsSync(indexPath)) {
          try {
            const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
            const code = await fs.promises.readFile(indexPath, 'utf8');
            plugins.push({
              id: manifest.id || entry.name,
              name: manifest.name || entry.name,
              version: manifest.version || '1.0.0',
              description: manifest.description || '',
              author: manifest.author || 'User',
              dirName: entry.name,
              code
            });
          } catch (e) {
            console.error('Error reading plugin', entry.name, e);
          }
        }
      }
    }
    return plugins;
  } catch (e) {
    return [];
  }
});

ipcMain.handle('plugins:installPlugin', async (event, { pluginId, manifest, code }) => {
  try {
    const targetDir = path.join(userPluginsDir, pluginId);
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }
    await fs.promises.writeFile(path.join(targetDir, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf8');
    await fs.promises.writeFile(path.join(targetDir, 'index.js'), code, 'utf8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('plugins:uninstallPlugin', async (event, pluginId) => {
  try {
    const targetDir = path.join(userPluginsDir, pluginId);
    if (fs.existsSync(targetDir)) {
      await fs.promises.rm(targetDir, { recursive: true, force: true });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Shell execution for NppExec / Code Runner
ipcMain.handle('runner:execute', (event, { command, args, cwd, inputScript }) => {
  if (activeRunningProcess) {
    try { activeRunningProcess.kill(); } catch (e) {}
    activeRunningProcess = null;
  }

  return new Promise((resolve) => {
    let scriptPath = null;
    let finalCmd = command;
    let finalArgs = [...args];

    // If script content is provided, save it temporarily
    if (inputScript) {
      const ext = command.includes('python') ? '.py' : command.includes('node') ? '.js' : '.sh';
      scriptPath = path.join(os.tmpdir(), `npp_exec_${Date.now()}${ext}`);
      fs.writeFileSync(scriptPath, inputScript, 'utf8');
      finalArgs.push(scriptPath);
    }

    const startTime = Date.now();
    sendToRenderer('runner:started', { command: `${finalCmd} ${finalArgs.join(' ')}` });

    try {
      const child = spawn(finalCmd, finalArgs, {
        cwd: cwd || os.homedir(),
        env: { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin` },
        shell: true
      });

      activeRunningProcess = child;

      child.stdout.on('data', (data) => {
        sendToRenderer('runner:stdout', data.toString());
      });

      child.stderr.on('data', (data) => {
        sendToRenderer('runner:stderr', data.toString());
      });

      child.on('error', (err) => {
        sendToRenderer('runner:stderr', `Process error: ${err.message}\n`);
        if (scriptPath && fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
        activeRunningProcess = null;
        resolve({ success: false, error: err.message });
      });

      child.on('close', (code) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        sendToRenderer('runner:completed', { code, duration });
        if (scriptPath && fs.existsSync(scriptPath)) {
          try { fs.unlinkSync(scriptPath); } catch (e) {}
        }
        activeRunningProcess = null;
        resolve({ success: true, code, duration });
      });
    } catch (e) {
      if (scriptPath && fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
      activeRunningProcess = null;
      resolve({ success: false, error: e.message });
    }
  });
});

ipcMain.handle('runner:stop', () => {
  if (activeRunningProcess) {
    try {
      activeRunningProcess.kill('SIGTERM');
      activeRunningProcess = null;
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
