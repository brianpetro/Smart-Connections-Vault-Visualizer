import { ScConnectionsView } from "../sc-obsidian/src/views/sc_connections.obsidian.js";

/**
 * @class ConnectionsVisualizerView
 * @extends ScConnectionsView
 * @description An Obsidian View for the D3-based connections visualizer.
 *    Similar to how AdvancedConnectionsView extends ScConnectionsView, but uses our new "connections_visualizer".
 */
export class ConnectionsVisualizerView extends ScConnectionsView {
  static get view_type() { return "connections-visualizer"; }
  static get display_text() { return "Connections Visualizer"; }
  static get icon_name() { return "git-fork"; }

  // This key is used to match environment’s “render_component('connections_visualizer', ...)”
  main_component_key = "connections_visualizer";

  /**
   * Render logic: similar to ScConnectionsView's, but we skip the normal connections HTML and call the new component.
   */
  async render_view(entity = null, container = this.container) {
    if (container.checkVisibility() === false) {
      return console.log("View inactive, skipping render");
    }

    // Resolve entity from current file if none provided
    if (!entity) {
      const current_file = this.app.workspace.getActiveFile();
      if (current_file) entity = current_file?.path;
    }

    let key = null;
    if (typeof entity === "string") {
      const collection = entity.includes("#")
        ? this.env.smart_blocks
        : this.env.smart_sources;
      key = entity;
      entity = collection.get(key);
    }

    if (!entity) {
      return this.plugin?.notices?.show("no entity", "No entity found for key: " + key);
    }

    // If PDF or special logic, handle as in your code snippet
    if (entity.collection_key === "smart_sources" && entity.path.endsWith(".pdf")) {
      // PDF special handling
      // ...
    }

    // Only re-render if different context
    if (!this.results_container || this.current_context !== entity.key) {
      this.current_context = entity.key;
      const frag = await entity.env.render_component(this.main_component_key, entity, {
        refresh_view: this.re_render.bind(this),
        add_result_listeners: this.add_result_listeners.bind(this),
      });
      container.empty();
      container.appendChild(frag);
    } else {
      // Possibly update partial data, or do nothing if the component handles refresh itself.
    }
  }
}