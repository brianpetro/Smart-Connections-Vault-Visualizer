# Smart Connections **Vault Visualizer** `v1.0`

> **Visualize all of your clusters and their relationships across your entire vault!**

Welcome to the **Smart Connections Vault Visualizer**—an intuitive, D3-powered interface that displays and manages your **entire vault's** network of clusters. Inspired by the original [Smart Connections Visualizer Plugin](https://github.com/Mossy1022/Smart-Connections-Visualizer) which focused on single-note visualizations, this new visualizer expands the scope to **every cluster** you have. Whether you're creating new clusters, ungrouping nodes, or exploring how everything interconnects, this plugin brings your vault’s relational structure to life.

---

## Table of Contents

1. [Introduction](#introduction)  
2. [Features](#features)  
3. [Installation](#installation)  
4. [Usage](#usage)  
5. [Interacting with the Visualization](#interacting-with-the-visualization)  
6. [Customizing the Visualization](#customizing-the-visualization)  
7. [Vision](#vision)  
8. [About Me](#about-me)  
9. [Community and Support](#community-and-support)  
10. [License](#license)  

---

## Introduction

**Clusters** are conceptual or thematic groups of notes (or items) within your vault. The Smart Connections Clusters Visualizer provides a **force-directed** or **radial** layout to:

- Show clusters as “hubs” and the notes (members) around them.  
- Dynamically filter relationships based on a chosen threshold.  
- Quickly create, remove, or reorganize clusters from a single interface.  

If you have used [Smart Connections Visualizer](https://github.com/Mossy1022/Smart-Connections-Visualizer), this plugin extends the concept across **all** your data—no longer limited to one note’s local connections!

---

## Features

1. **Vault-Wide Clustering**  
   - Visualizes all your clusters in a single, comprehensive layout.  
   - Each cluster appears as a colored node with optional sub-centers and members attached.  

2. **Interactive Forces & Pinning**  
   - Physics-based layout to reveal natural groupings or flows in your data.  
   - **Pin** button to freeze everything in place (and unpin to re-run the layout).

3. **Threshold Slider**  
   - Instantly hide or reveal weaker links by adjusting the threshold for cluster/member relevance.  
   - Watch connections redraw in real-time as you move the slider!

4. **Multi-Select & Box Selection**  
   - **Shift+Click** on individual nodes to build a selection set.  
   - **Shift+Drag** to draw a rectangular selection area and select multiple nodes at once.

5. **Cluster Management Toolbar**  
   - **Create Cluster** from selected notes.  
   - **Add/Remove Members** from clusters.  
   - **Promote/Remove Centers** to shape each cluster’s internal structure.  
   - **Remove Entire Cluster** with a single click.

6. **Hover Highlights & Live Fading**  
   - Smoothly fade non-relevant nodes and links for clarity while hovering over a node.  
   - Quickly see which items or clusters are directly linked.

7. **Performance Optimizations**  
   - Single `<canvas>` rendering for large sets.  
   - Batch link updates to efficiently handle thousands of nodes.

---

## Installation

1. **Install Smart Connections**  
   Make sure you have the [Smart Connections](https://github.com/brianpetro/obsidian-smart-connections) plugin set up, so your environment already recognizes cluster data.

2. **Install Visualizer**  
   - Open Obsidian’s **Community Plugins** store.  
   - Search for **“Smart Connections Vault Visualizer”**.  
   - Click “Install” and then “Enable” to add it to your workspace.

3. **Restart Obsidian** (if prompted)  
   - Some systems may require a quick restart to activate new plugins.

---

## Usage

Once installed, open the **Smart Visualizer View**:

1. **Select Cluster Centers**  
   - Open the command pallet and select "Select Cluster Centers".  Pick the notes you want to be at the center of each cluster, then click "Select Cluster Centers" at the top of the list
2. **Explore Your Clusters**  
   - The plugin automatically queries your vault for cluster data (via Smart Connections) and renders it into an interactive map.  
3. **Hover, Pin, and Adjust**  
   - Hover over nodes to see names. Shift-click to select multiple notes or clusters. Adjust the threshold slider to show/hide certain links.
4. **Modify Clusters**
    1. Add notes to the center of the cluster -  Makes cluster connect to more notes like selection
    2. Remove node(s) from cluster's center - Make cluster connect to fewer notes like selection (via zooming into central node and selecting the nodes within the central node to remove)
    3. Remove the selected cluster (via selecting the central node)
    4. Create new clusters from notes (via selecting node(s))
    5. Remove nodes from cluster (via selecting nodes and the central node they are clustered with)
        
> **Tip**: If you don’t see any clusters, be sure to configure Smart Connections first. This plugin reads existing cluster definitions and membership info.

---

## Interacting with the Visualization

1. **Canvas Pan & Zoom**  
   - **Scroll** or pinch to zoom in/out.  
   - **Click & Drag** the background to pan the entire canvas.  

2. **Hover Over Nodes**  
   - Highlights the hovered node and its immediate connections.  
   - Non-relevant links fade so you can focus on one area at a time.

3. **Threshold Slider**  
   - Change the minimum score for a link to be displayed.  
   - Move the slider to reveal stronger or weaker cluster relationships.  

4. **Select Nodes**  
   - **Single Click** on a node to select it (clearing any previous selection).  
   - **Shift+Click** to add/remove individual nodes from your selection set.  
   - **Shift+Drag** a rectangle to select multiple nodes at once.

5. **Toolbar Actions**  
   - **Pin Layout**: Freeze or unfreeze the physics simulation.  
   - **Create Cluster**: Forms a new cluster from the currently selected *member* nodes.  
   - **Ungroup from Cluster**: Removes selected members from their cluster.  
   - **Add to Center** / **Remove from Center**: Moves selected member(s) in or out of a cluster’s “center,” influencing how strongly they connect to the rest of the graph.  
   - **Remove Cluster(s)**: Permanently deletes one or more selected cluster nodes from your system (careful!).  
   - **Refresh Viz**: Re-renders the entire layout if anything feels out of sync.

---

## Vision

Like the original Smart Connections Visualizer, this plugin stems from a desire to **truly see** our information. Text-based note structures often hide relationships or create friction. By **visualizing** every cluster from your entire vault:

- You capture the **big picture**—all clusters, all notes, in one dynamic state.  
- You can **quickly manipulate** group memberships, thresholds, and connections.  
- **Discover synergy** between clusters that might otherwise remain hidden in text.  

Think of it like having an **interactive map** of your second brain, so you can orbit around ideas, regroup them, and watch new relationships form in real-time.

---

## About Me

Hello there! I’m **Evan**, a senior software developer and AI enthusiast who has been exploring the intersection of **data visualization** and **AI** for over a decade. I created this Vault Visualizer to help power users leverage their entire Obsidian vault more intuitively.

- **AI & Next-Gen Tools**: I run an AI consulting company called *Evan’s Oasis*—helping businesses tap into modern AI workflows, drastically improving decision-making and productivity.  
- **Innovation & Accessibility**: I’m also working on a tongue-based motion capture device—check out [Glosdex.com](https://glosdex.com/) for a glimpse into cutting-edge wearable technology.  
- **Passion for Community**: Providing webinars on AI advancements and how to best incorporate them into daily life.

If you like the Vault Visualizer, feel free to connect, share feedback, or jump in and contribute!

---

## Community and Support

- **GitHub Issues / Discussions**: Post questions, ideas, or bug reports.  
- **Contribute**: PRs are very welcome! Whether it’s a new feature or a performance tweak, your help makes the plugin better.  
- **Spread the Word**: If the plugin enhances your workflow, let others know. Share your workflows, screenshots, or tips with the community.

---

## License

This plugin is open-source and distributed under the **MIT License**, allowing you to use, modify, and distribute it freely. See the [LICENSE](LICENSE) file for details.

---

Thank you for trying **Smart Connections Vault Visualizer**! Enjoy exploring how your notes and ideas interconnect at scale. If you discover new ways to use it or new features to add, don’t hesitate to share. **Happy clustering!**
