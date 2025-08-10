/**
 * @file center_select_modal.js
 * @description FuzzySuggestModal for selecting multiple vault notes. Each selection remains "pilled" above the input.
 */

import {
  FuzzySuggestModal,
  TFile,
  setIcon,
  Keymap
} from 'obsidian';

/**
 * @typedef {Object} SelectedItem
 * @property {TFile} file
 */

/**
 * Modal that lets the user pick multiple notes from the vault. Selected notes
 * appear above the input area as "pill" elements, and the modal remains open
 * for additional selections until the user manually closes with Escape.
 */
export class CenterSelectModal extends FuzzySuggestModal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.env = plugin.env;

    /** @type {SelectedItem[]} */
    this.selected_items = [];


    // Insert usage instructions
    this.setInstructions([
      { command: 'Enter', purpose: 'Add to context' },
      {
        command: 'Ctrl+Enter',
        purpose: 'Open visualizer using current selection'
      },
      { command: 'Esc', purpose: 'Close' },
    ]);

    this.submit_btn_text = 'Select cluster centers';

    // Keydown to handle Ctrl+Enter
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && Keymap.isModEvent(e)) {
        e.preventDefault();
        this.submit();
      }
    });
  }
  onOpen() {
    super.onOpen();
    if(this.current_input) {
      this.inputEl.value = this.current_input;
    }
    this.render_pills();
    this.inputEl.addEventListener('blur', () => {
      this.inputEl.focus();
    });
  }
  getItems() {
    return Object.keys(this.plugin.env.smart_sources.items).filter((key) => {
      const item = this.plugin.env.smart_sources.items[key];
      return !this.selected_items.includes(key) && item && Array.isArray(item.vec);
    });
  }
  getItemText(key) {
    return key;
  }
  onChooseItem(key) {
    // get input value and set it to this.current_input
    this.current_input = this.inputEl.value;
    console.log('modal', this);
    this.selected_items.push(key);
    this.render_pills();
    this.open(); // stay open
  }

  /**
   * Render the pill elements for each selected item.
   */
  render_pills() {
    console.log('render_pills', this.selected_items);
    if(this.submit_btn) {
      this.submit_btn.remove();
    }
    this.submit_btn = this.containerEl.createEl('button', { text: this.submit_btn_text });
    this.submit_btn.addEventListener('click', () => {
      this.submit();
    });
    if(this.modalEl && this.submit_btn) {
      this.modalEl.prepend(this.submit_btn);
    }
    if(this.selected_container_el) {
      this.selected_container_el.remove();
    }
    this.selected_container_el = this.containerEl.createDiv('sc-selected-pill-container');
    if (this.modalEl && this.selected_container_el) {
      this.modalEl.prepend(this.selected_container_el);
    }
    for (const sel of this.selected_items) {
      const pill = this.selected_container_el.createDiv('sc-selected-pill');
      pill.createSpan({ text: sel.split('/').pop() });
      
      // Optional: add an 'x' icon to remove
      const remove_el = pill.createSpan({
        text: '  ✕',
        cls: 'sc-selected-pill-remove'
      });
      remove_el.addEventListener('click', () => {
        this.selected_items = this.selected_items.filter((x) => x !== sel);
        this.render_pills();
      });

      setIcon(pill.createSpan({ cls: 'sc-selected-pill-icon' }), 'document');
    }
  }
  async submit() {
    await this.env.cluster_groups.create_group(this.selected_items);
    this.close();
    this.plugin.open_cluster_visualizer();
    this.plugin.get_cluster_visualizer_view()?.render_view();
  }
}


