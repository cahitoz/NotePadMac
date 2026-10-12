# Notepad++ (macOS Edition) 🦎

A high-performance **Notepad++ clone built natively for macOS**, preserving the beloved Notepad++ workflow, aesthetics, and powerhouse **plugin ecosystem**.

![macOS](https://img.shields.io/badge/platform-macOS-lightgrey)
![Engine](https://img.shields.io/badge/engine-Monaco%20%26%20V8-blue)
![Architecture](https://img.shields.io/badge/arch-Apple%20Silicon%20%26%20Intel-green)
[![Build & Package Notepad++ macOS](https://github.com/cahitoz/NotePadMac/actions/workflows/build-and-release.yml/badge.svg)](https://github.com/cahitoz/NotePadMac/actions/workflows/build-and-release.yml)
![License](https://img.shields.io/badge/license-MIT-purple)

---

## 📥 Easy Installation on macOS

1. **Download the Installer**:
   - Go to [**GitHub Releases**](https://github.com/cahitoz/NotePadMac/releases) (or the latest **[Actions Artifacts](https://github.com/cahitoz/NotePadMac/actions)**).
   - Download the **`Notepad++-1.0.0.dmg`** file.

2. **Install**:
   - Open the downloaded `.dmg`.
   - Drag **Notepad++** into your **Applications** folder.

3. **First-Time Launch (Gatekeeper)**:
   - Because this is an open-source build, right-click (or Control-click) `Notepad++.app` in Applications and choose **Open**, then click **Open** when prompted.
   - *(Or run this one-time command in Terminal)*:
     ```bash
     xattr -cr /Applications/Notepad++.app
     ```

---

## 🌟 Key Highlights

- **Classic Notepad++ Look & Feel**:
  - Iconic toolbar with quick-access commands (New, Open, Save, Save All, Find, Replace, Zoom, Word Wrap, Show Whitespace, Minimap).
  - Multi-tab document bar with **floppy disk status indicators** (🔵 Blue = Clean / Saved, 🔴 Red = Modified / Unsaved).
  - Double-click tabs to close.
  - Native macOS menu bar integration (`Cmd+N`, `Cmd+O`, `Cmd+S`, `Cmd+W`, `Cmd+F`, `Cmd+H`, etc.).
  - Segmented Notepad++ Status Bar: Cursor position (`Ln/Col/Sel`), length & line count, line endings (`Unix LF` / `Windows CRLF` toggle), encoding (`UTF-8`), mode (`INS`), and syntax lexer picker.
  - Dark Mode & Light Theme toggle with one click.

---

## 🧩 The Plugin Ecosystem

Notepad++ macOS includes **built-in implementations of the top Notepad++ plugins**, as well as an extensible **Plugin Architecture** and interactive **Plugins Admin**:

### 1. 🔍 Compare Plugin (Built-in)
*Modeled after the famous Notepad++ Compare plugin.*
- **Side-by-side Visual Diff**: Compares the active tab against any other open tab.
- **Color-coded differences**: Highlights line additions (green), removals (red), and inline modifications.
- **Synchronized Scrolling**: Keeps both files aligned while navigating.
- **Navigation Controls**:
  - `F8`: Next difference
  - `Shift + F8`: Previous difference
  - `✕ Close Compare`: Restores standard single-editor view.
- **Shortcut**: `Alt + D` or `Plugins > Compare`.

### 2. 📄 XML Tools (Built-in)
*The essential XML companion from Notepad++.*
- **Pretty Print (Format Indent)**: Cleans and indents XML hierarchy (`Ctrl + Alt + Shift + B`).
- **Linearize XML**: Minifies XML into a single compact line.
- **XML Syntax Validator**: Real-time syntax and well-formedness checker with line and column error reporting.
- **XPath Evaluator**: Interactive query panel to test XPath expressions (`//book/title`, `//item[@id='1']`) against documents.

### 3. ⚡ JSON Tools (Built-in)
- **Format JSON**: Pretty prints JSON with 2-space (`Ctrl + Alt + Shift + J`) or 4-space indentation.
- **Minify JSON**: Compresses JSON by removing whitespace.
- **Validate Syntax**: Pins down exact syntax errors and invalid tokens.
- **Interactive JSON Tree Viewer**: Collapsible tree inspector with key/value types, array counts, and 1-click clean JSON clipboard copy.

### 4. 🔤 TextFX Characters & Lines (Built-in)
- **Sort Lines**: Ascending and Descending line sorting.
- **Deduplicate**: One-click removal of duplicate lines with counter.
- **Convert Case**: UPPERCASE (`Ctrl+Shift+U`), lowercase (`Ctrl+U`), Title Case, camelCase, snake_case.
- **Trim Trailing Whitespace**: Cleans ends of lines.
- **Encoding**: Base64 Encode/Decode, URL Encode/Decode.
- **Word & Character Statistics**: Detailed document summary modal (lines, words, characters with/without spaces, byte size).

### 5. 🚀 NppExec (Code & Script Runner)
- **Run Current Script**: Press `F5` to execute Python (`python3`), Node.js (`node`), or Shell (`bash`) scripts.
- **Integrated Console Panel**: Dockable bottom terminal panel with streaming `stdout`/`stderr`, execution timer, and process exit code.
- **Process controls**: Re-run, Clear, or Kill running processes (`F6` to toggle panel).

---

## 📦 Plugins Admin & Marketplace

Press `Cmd + Shift + P` or open **Plugins > Plugins Admin...**:
- **Installed Tab**: Lists all active plugins (both built-in and user-installed) with version, author, and 1-click uninstall.
- **Available Tab**: Browse and install community plugins with a single click:
  - **Hex Editor**: Binary byte inspection with ASCII representation.
  - **Markdown Live Preview**: Real-time side-by-side Markdown HTML renderer.
  - **Hash & UUID Generator**: MD5, SHA-256 hash calculator and UUIDv4 generator.
  - **Lorem Ipsum Generator**: Rapid dummy text inserter for web developers.
  - **Regex Tester**: Interactive pattern testing with group capture inspection.
- **Open Plugins Folder**: Opens `~/Library/Application Support/NotepadMac/plugins` in macOS Finder so you can drop your own custom plugin scripts directly into the editor!

---

## 🛠️ Writing Custom Plugins

Every plugin lives in its own folder inside the plugins directory:

```
~/Library/Application Support/NotepadMac/plugins/my-plugin/
├── plugin.json
└── index.js
```

### `plugin.json`
```json
{
  "id": "my-plugin",
  "name": "My Custom Plugin",
  "version": "1.0.0",
  "description": "Does awesome text transformations",
  "author": "Your Name"
}
```

### `index.js`
```javascript
const plugin = {
  activate(api) {
    // Access editor
    const text = api.editor.getText();
    const selection = api.editor.getSelection();

    // Replace text or insert at cursor
    // api.editor.setText("new text");
    // api.editor.replaceSelection("inserted");

    // Notifications
    api.ui.showToast("My custom plugin loaded!", "success");
  }
};
```

---

## 🚀 Getting Started

### Prerequisites
- macOS (Apple Silicon M1/M2/M3/M4 or Intel)
- Node.js 18+

### Installation & Launch

1. Clone or navigate to the directory:
   ```bash
   cd /Users/cahitoz/Development/NotePadMac
   ```

2. Install dependencies (already installed):
   ```bash
   npm install
   ```

3. Launch Notepad++:
   ```bash
   npm start
   ```

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Action |
| :--- | :--- |
| `Cmd + N` | New Tab |
| `Cmd + O` | Open File |
| `Cmd + S` | Save File |
| `Cmd + Shift + S` | Save As |
| `Cmd + Alt + S` | Save All Tabs |
| `Cmd + W` | Close Tab |
| `Cmd + F` | Find Dialog |
| `Cmd + H` | Replace Dialog |
| `F3` / `Shift + F3` | Find Next / Previous |
| `Cmd + D` | Duplicate Current Line |
| `Cmd + Shift + K` | Delete Current Line |
| `Alt + Up` / `Alt + Down` | Move Line Up / Down |
| `Alt + Z` | Toggle Word Wrap |
| `Alt + D` | Open Compare Plugin Dialog |
| `F8` / `Shift + F8` | Next / Previous Difference in Compare Mode |
| `Ctrl + Alt + Shift + B` | Pretty Print XML (Indent) |
| `Ctrl + Alt + Shift + J` | Format JSON (Indent 2) |
| `F5` | Run Script in NppExec Console |
| `F6` | Toggle NppExec Console Panel |
| `Cmd + Shift + P` | Open Plugins Admin |
| `Cmd + =` / `Cmd + -` | Zoom In / Zoom Out |
