// Sample Notepad++ macOS Custom Plugin
const plugin = {
  activate(api) {
    // You can interact with the editor via api.editor
    // For example: api.editor.getText(), api.editor.replaceSelection(), api.ui.showToast()
    api.ui.showToast('Case Inverter plugin active! Ready to invert text.', 'info');
  },

  invertSelection(api) {
    const sel = api.editor.getSelection();
    if (!sel) {
      api.ui.showToast('Please select some text to invert case.', 'info');
      return;
    }
    const inverted = sel.split('').map(c => {
      if (c === c.toUpperCase()) return c.toLowerCase();
      return c.toUpperCase();
    }).join('');
    api.editor.replaceSelection(inverted);
    api.ui.showToast('Inverted selection case!', 'success');
  }
};
