/** 
 * @file plugin.js
 * @description Main entrypoint for the Smart Visualizer Obsidian Plugin.
 * Adds a side panel to visualize Smart Clusters and Cluster Groups.
 */

import { Plugin } from "obsidian";
import {SmartEnv} from "smart-environment";
import ajson_single_file_data_adapter from "../jsbrains/smart-collections/adapters/ajson_single_file.js";
// import ajson_multi_file_data_adapter from "../jsbrains/smart-collections/adapters/ajson_multi_file.js";
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
      id: "open-smart-vault-visualizer-view",
      name: "Open smart vault visualizer view",
      callback: () => {
        ClustersVisualizerView.open(this.app.workspace);
      },
    });

    // Command to open center select modal
    this.addCommand({
      id: 'open-center-select-modal',
      name: 'Select cluster centers',
      callback: () => {
        const modal = new CenterSelectModal(this.app, this);
        modal.open();
      },
    });

    // this.addCommand({
    //   id: 'open-connections-visualizer',
    //   name: 'Open Connections Visualizer',
    //   callback: () => {
    //     this.open_connections_visualizer();
    //   },
    // });

    // Attach environment config
    SmartEnv.wait_for({ loaded: true }).then(async () => {
      await SmartEnv.create(this, {
        global_prop: 'smart_env',
        collections: {},
        item_types: {},
        modules: {},
        ...this.smart_env_config,
      });
      // temp until sc op gets latest version of smart_env
      this.env._components = {}; // clear component cache
    });
    this.registerView(ClustersVisualizerView.view_type, (leaf) => new ClustersVisualizerView(leaf, this));
    this.addRibbonIcon('git-fork', 'Open smart connections visualizer', (evt) => {
      this.open_connections_visualizer();
    });
  }

  /**
   * Called by Obsidian when the plugin is unloaded.
   */
  onunload() {
    if(this.env) {
      this.env?.unload_main("smart_visualizer_plugin");
      this.env._components = {}; // clear component cache
    }
    console.log("unloaded smart_visualizer_plugin");
  }


  open_cluster_visualizer() {
    ClustersVisualizerView.open(this.app.workspace);
  }

  get_cluster_visualizer_view() {
    return ClustersVisualizerView.get_view(this.app.workspace);
  }

}

export default SmartVisualizerPlugin;
