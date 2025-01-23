/**
 * @file clusters_visualizer.obsidian.js
 * @description Defines an Obsidian View for the Clusters Visualizer, akin to existing directories.obsidian.js or clusters.obsidian.js
 */

import { SmartEntitiesView } from "../sc-obsidian/src/views/smart_entities.obsidian.js";

/**
 * @class ClustersVisualizerView
 * @extends SmartEntitiesView
 * @description Obsidian-specific view to host the D3-based cluster visualizer.
 */
export class ClustersVisualizerView extends SmartEntitiesView {
  static get view_type() { return "clusters-visualizer-view"; }
  static get display_text() { return "Clusters Visualizer"; }
  static get icon_name() { return "git-fork"; } // or any suitable icon
  static get default_open_location() { return "root"; }

  /**
   * The `main_component_key` used by environment’s `render_component` to load the "clusters_visualizer.js".
   */
  main_component_key = "clusters_visualizer";

  /**
   * Renders the clusters in an interactive D3 visualization.
   * @param {HTMLElement} [container=this.container]
   * @returns {Promise<void>}
   */
  async render_view(container = this.container) {
    this.container.empty();
    this.container.createSpan().setText("Loading Clusters Visualizer...");
    // Rely on `this.env.smart_clusters`
    const frag = await this.env.render_component(this.main_component_key, this, {
      attribution: this.attribution,
    });
    this.container.empty();
    this.container.appendChild(frag);
    this.app.workspace.registerHoverLinkSource(this.constructor.view_type, { display: this.getDisplayText(), defaultMod: false });
  }

}
