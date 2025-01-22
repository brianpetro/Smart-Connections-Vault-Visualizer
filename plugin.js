/** 
 * @file plugin.js
 * @description Main entrypoint for the Smart Visualizer Obsidian Plugin.
 * Adds a side panel to visualize Smart Clusters and Cluster Groups.
 */

import { Plugin } from "obsidian";
import { wait_for_smart_env_then_init } from "obsidian-smart-env";
import ajson_single_file_data_adapter from "../jsbrains/smart-collections/adapters/ajson_single_file.js";
import { Clusters, Cluster } from "../jsbrains/smart-clusters/index.js";
import { ClusterGroups, ClusterGroup } from "../jsbrains/smart-cluster-groups/index.js";
import { ClustersVisualizerView } from "./clusters_visualizer.obsidian.js";
import { render as render_clusters_visualizer } from "./dist/clusters_visualizer.js";
import { CenterSelectModal } from "./center_select_modal.js";
import { ConnectionsVisualizerView } from "./connections_visualizer.obsidian.js";
import { render as render_connections_visualizer } from "./dist/connections_visualizer.js";
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
        data_adapter: ajson_single_file_data_adapter,
      },
      cluster_groups: {
        class: ClusterGroups,
        data_adapter: ajson_single_file_data_adapter,
      }
    },
    item_types: {
      Cluster,
      ClusterGroup,
    },
    components: {
      connections_visualizer: render_connections_visualizer,
      clusters_visualizer: render_clusters_visualizer,
    }
  };

  /**
   * Called by Obsidian when the plugin is first loaded.
   * Registers the Smart Visualizer view and commands.
   */
  async onload() {

    // Command to open the side panel
    this.addCommand({
      id: "open-smart-visualizer-view",
      name: "Open Smart Visualizer View",
      callback: () => {
        ClustersVisualizerView.open(this.app.workspace);
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

    this.addCommand({
      id: 'open-connections-visualizer',
      name: 'Open Connections Visualizer',
      callback: () => {
        this.open_connections_visualizer();
      },
    });

    // Attach environment config
    wait_for_smart_env_then_init(this, this.smart_env_config).then(() => {
      // temp until sc op gets latest version of smart_env
      this.env._components = {}; // clear component cache
    });
    this.registerView(ClustersVisualizerView.view_type, (leaf) => new ClustersVisualizerView(leaf, this));
    this.registerView(ConnectionsVisualizerView.view_type, (leaf) => new ConnectionsVisualizerView(leaf, this));
    this.addRibbonIcon('git-fork', 'Open smart connections visualizer', (evt) => {
      this.open_connections_visualizer();
    });
  }

  /**
   * Called by Obsidian when the plugin is unloaded.
   */
  onunload() {
    this.env.unload_main("smart_visualizer_plugin");
    this.env._components = {}; // clear component cache
    console.log("unloaded smart_visualizer_plugin");
  }

  open_cluster_visualizer() {
    ClustersVisualizerView.open(this.app.workspace);
  }

  get_cluster_visualizer_view() {
    return ClustersVisualizerView.get_view(this.app.workspace);
  }

  open_connections_visualizer() {
    ConnectionsVisualizerView.open(this.app.workspace);
  }

  get_connections_visualizer_view() {
    return ConnectionsVisualizerView.get_view(this.app.workspace);
  }

}

export default SmartVisualizerPlugin;
