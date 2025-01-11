/** 
 * @file plugin.js
 * @description Main entrypoint for the Smart Visualizer Obsidian Plugin.
 * Adds a side panel to visualize Smart Clusters and Cluster Groups.
 */

import { Plugin } from "obsidian";
import { wait_for_smart_env_then_init } from "obsidian-smart-env";
import ajson_data_adapter from "../jsbrains/smart-collections/adapters/ajson_multi_file.js";
import { Clusters, Cluster } from "../jsbrains/smart-clusters/index.js";
import { ClusterGroups, ClusterGroup } from "../jsbrains/smart-cluster-groups/index.js";
import { ClustersVisualizerView } from "./clusters_visualizer.obsidian.js";
import { render as render_clusters_visualizer } from "./dist/clusters_visualizer.js";
import { CenterSelectModal } from "./center_select_modal.js";
/**
 * Main plugin class for Smart Visualizer.
 */
class SmartVisualizerPlugin extends Plugin {
  /**
   * @type {Object}
   */
  smart_env_config = {
    collections: {
      clusters: {
        class: Clusters,
        data_adapter: ajson_data_adapter,
      },
      cluster_groups: {
        class: ClusterGroups,
        data_adapter: ajson_data_adapter,
      }
    },
    item_types: {
      Cluster,
      ClusterGroup,
    },
    components: {
      cluster_groups: {
        clusters_visualizer: render_clusters_visualizer,
      }
    }
  };

  /**
   * Called by Obsidian when the plugin is first loaded.
   * Registers the Smart Visualizer view and commands.
   */
  async onload() {
    this.registerView("smart-visualizer-view", (leaf) => new ClustersVisualizerView(leaf, this));

    // Command to open the side panel
    this.addCommand({
      id: "open-smart-visualizer-view",
      name: "Open Smart Visualizer View",
      callback: () => {
        this.activate_view();
      },
    });

    // Command to open center select modal
    this.addCommand({
      id: 'open-center-select-modal',
      name: 'Select Cluster Centers',
      callback: () => {
        const modal = new CenterSelectModal(this.app, this);
        modal.open();
      },
    });




    // Attach environment config
    wait_for_smart_env_then_init(this, this.smart_env_config);
  }

  /**
   * Called by Obsidian when the plugin is unloaded.
   */
  onunload() {
    this.env.unload_main("smart_visualizer_plugin");
    console.log("unloaded smart_visualizer_plugin");
  }

  /**
   * Ensures the Smart Visualizer view is shown.
   */
  async activate_view() {
    let leaf = this.app.workspace.getLeavesOfType("smart-visualizer-view").first();
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: "smart-visualizer-view" });
    }
    this.app.workspace.revealLeaf(leaf);
  }
}

export default SmartVisualizerPlugin;
