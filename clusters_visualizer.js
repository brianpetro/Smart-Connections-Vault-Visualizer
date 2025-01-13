/**
 * @file clusters_visualizer.js
 * @description Visualizes cluster members (SmartSources) in a D3 force layout or radial layout
 * based on scores from `cluster.get_nearest_members()`. Now also uses cos_sim between each cluster’s
 * group_vec properties to link only the two most similar neighbor clusters.
 *
 * Usage:
 * - Imported by Obsidian view (clusters_visualizer.obsidian.js) or any environment's render_component('clusters_visualizer', ...).
 * - Has build_html(), render(), and post_process() exports.
 * - Uses D3 to position cluster centers and their members in a simple force simulation or radial diagram.
 */

import { cos_sim } from 'smart-entities/utils/cos_sim.js';  // Make sure this export is valid
import * as d3 from 'd3';

export async function build_html(cluster_groups, opts = {}) {
  return `
    <div class="sc-clusters-visualizer-view" style="width: 100%; height: 100%;">
      <div class="sc-top-bar">
        <div class="sc-visualizer-actions">
          // create new cluster - 3 step - select + select centers
          <button class="sc-create-new-cluster" aria-label="Create a new cluster">
            ${this.get_icon_html?.('refresh-cw') || '⟳'}
          </button>
          <button class="sc-move-to-cluster" aria-label="Create a new cluster">
            ${this.get_icon_html?.('refresh-cw') || '⟳'}
          </button>
          <button class="sc-move-to-center" aria-label="Move node(s) to cluster center">
            ${this.get_icon_html?.('refresh-cw') || '⟳'}
          </button>
          <button class="sc-move-to-cluster" aria-label="Move node(s) to cluster">
            ${this.get_icon_html?.('refresh-cw') || '⟳'}
          </button>
          <button class="sc-remove-from" aria-label="Remove node(s) from clusters">
            ${this.get_icon_html?.('refresh-cw') || '⟳'}
          </button>
               <button class="sc-remove-from-center" aria-label="Remove from cluster center">
            ${this.get_icon_html?.('refresh-cw') || '⟳'}
          </button>
          <button class="sc-undo-action" aria-label="Undo last action">
            ${this.get_icon_html?.('refresh-cw') || '⟳'}
          </button>
          <button class="sc-rebuild" aria-label="Rebuild clusters">
            ${this.get_icon_html?.('layers') || 'Rebuild'}
          </button>
          <button class="sc-refresh" aria-label="Refresh clusters visualization">
            ${this.get_icon_html?.('refresh-cw') || '⟳'}
          </button>
          <button class="sc-rebuild" aria-label="Rebuild clusters">
            ${this.get_icon_html?.('layers') || 'Rebuild'}
          </button>
          <button class="sc-help" aria-label="Visualizer help">
            ${this.get_icon_html?.('help-circle') || '?'}
          </button>
        </div>
      </div>
      <div class="sc-visualizer-content" style="width: 100%; height: 100%;">
        <!-- D3 visualization container -->
        <svg class="clusters-visualizer-svg" width="100%" height="100%" style="pointer-events: all"></svg>
      </div>
    </div>
  `;
}

/**
 * Render function: sets up D3, queries each cluster for nearest members, then places them in a small force or radial layout.
 * Now includes top-2 cluster-cluster links based on cos_sim of group_vec.
 * @param {Object} clusters - The SmartClusters collection instance
 * @param {Object} [opts] - Additional options
 * @returns {Promise<HTMLElement>} The rendered fragment
 */
export async function render(cluster_groups, opts = {}) {
  console.log('render', cluster_groups);
  console.log('hello this is is newnew');
  // const plugin_class = cluster_groups.env.smart_visualizer_plugin;
  const cluster_group = Object.values(cluster_groups.items)[0];
  if(!cluster_group) return this.create_doc_fragment('<div>No cluster group found!</div>');
  const snapshot = await cluster_group.get_snapshot(Object.values(cluster_groups.env.smart_sources.items));
  const {clusters, members} = snapshot;
  console.log('clusters', clusters);
  console.log('members', members);

  // 1. Build top-level HTML
  const html = await build_html.call(this, cluster_groups, opts);
  const frag = this.create_doc_fragment(html);

  // 2. Reference the SVG, set up d3
  const svgEl = frag.querySelector('.clusters-visualizer-svg');
  const width = 800;
  const height = 600;
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // 3. Construct data arrays for cluster center nodes + member nodes
  // const clusterArray = Object.values(clusters.items);
  const nodes = [];
  const links = [];
  const nodeMap = {};
  // const clusterArray = clusters;
  // Each cluster is a node
   // -- Create a node for each cluster
   clusters.forEach((cluster, i) => {
    const cKey = cluster.data.key; // e.g. "1736664608646-0"
    const cNode = {
      id: cKey,
      type: 'cluster',
      color: '#926ec9',
      radius: 20,
      cluster // store the original object if needed
    };
    nodeMap[cKey] = cNode;
    nodes.push(cNode);
  });

  // -- Create a node for each member and link it to any cluster with score >= 0.6
  members.forEach((member) => {
    // The member's own label:
    const memberLabel = member.item?.data?.key || 'unknown-member';
    
    // Create the node for this member (if not already created)
    if (!nodeMap[memberLabel]) {
      nodeMap[memberLabel] = {
        id: memberLabel,
        type: 'member',
        color: '#7c8594',
        radius: 7,
        source: member.item  // store the SmartSource reference
      };
      nodes.push(nodeMap[memberLabel]);
    }

    // For each cluster in member.clusters, link if above threshold
    Object.entries(member.clusters).forEach(([clusterId, clusterData]) => {
      const { score } = clusterData;
      if (score >= 0.6) {
        // Make sure the cluster node actually exists
        if (nodeMap[clusterId]) {
          console.log('link score: ', score);
          links.push({
            source: clusterId,
            target: memberLabel,
            score,
            stroke: '#4c7787'
          });
        }
      }
    });
  });


  // 1. Find min/max score
  const allScores = links
  .filter(link => typeof link.score === 'number')
  .map(link => link.score);
  const minScore = d3.min(allScores) ?? 0.6;
  const maxScore = d3.max(allScores) ?? 1.0;

  // 2. Create a scale for link distances
  const distanceScale = d3.scaleLinear()
  .domain([minScore, maxScore])
  .range([220, 80]) // higher score => smaller distance
  .clamp(true);

  // 4. Force simulation
  const simulation = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().strength(-100))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('link', d3.forceLink(links)
    .id(d => d.id)
    .distance(link => {
      if (typeof link.distance === 'number') return link.distance;
      if (typeof link.score === 'number') return distanceScale(link.score);
      return 200;
    })
  )
    .on('tick', ticked);

  // 5. Build the D3 node & link selections
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  // Create a container <g> so we can apply zoom/pan transforms
  const container_g = svg.append('g')
    .attr('class', 'sc-clusters-visualizer-container');

  // Attach a D3 zoom behavior
  const zoom_behavior = d3.zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', (event) => {
      container_g.attr('transform', event.transform);
    });
  svg.call(zoom_behavior);

  const linkSelection = container_g.append('g')
    .attr('class', 'sc-cluster-links')
    .selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', d => d.stroke || '#cccccc')
    .attr('stroke-width', 1.2);

  const nodeSelection = container_g.append('g')
    .attr('class', 'sc-cluster-nodes')
    .selectAll('circle')
    .data(nodes)
    .enter()
    .append('circle')
    .attr('r', d => d.radius)
    .attr('fill', d => d.color)
    .attr('stroke', 'transparent')
    .attr('stroke-width', 0.2)
    .call(d3.drag()
      .on('start', onDragStart)
      .on('drag', onDrag)
      .on('end', onDragEnd)
    )
    .on('click', (event, d) => {
      if (d.type === 'cluster') {
        // console.log(`Clicked cluster: ${d.id}`);
      } else if (d.type === 'source') {
        // console.log('node clicked: ', d.id)
        // Attempt to open note if the environment or plugin supports it
        d.source?.env?.plugin?.open_note?.(d.source.key, event);
      }
    })
    .on('mouseover', (event, d) => {
      d3.select(event.currentTarget).style('cursor', 'pointer'); // Set cursor to pointer

      // Only show the label for the hovered node
      labelSelection
        .filter(ld => ld.id === d.id)
        .transition()
        .style('opacity', 1);
    })
    .on('mouseout', (event, d) => {
      d3.select(event.currentTarget).style('cursor', 'default'); // Reset cursor

      // Hide the label again when not hovered
      labelSelection
        .filter(ld => ld.id === d.id)
        .transition()
        .style('opacity', 0);
    });

  // 6. Labels
  const labelSelection = container_g.append('g')
    .attr('class', 'sc-cluster-node-labels')
    .selectAll('text')
    .data(nodes)
    .enter()
    .append('text')
    .attr('font-size', 10)
    .attr('fill', '#cccccc')
    .attr('text-anchor', 'middle')
    .style('opacity', 0)
    .text(d => {
       // Clusters: show their cluster.data.key
       if (d.type === 'cluster') {
        return d.cluster?.data?.key || d.id;
      }
      // Members: show member.item.data.key
      if (d.type === 'member') {
        return d.source?.data?.key || d.id;
      }
      // Fallback
      return d.id;
    });

  // 7. Force-simulation tick handler
  function ticked() {
    linkSelection
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    nodeSelection
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    // Keep labels near nodes
    labelSelection
      .attr('x', d => d.x)
      .attr('y', d => d.y - (d.radius + 2));
  }

  // 8. Drag handlers
  function onDragStart(event, d) {
   // Turn off the zoom handling on the SVG while we drag
  //  svg.on('.zoom', null);

  console.log('Dragging node:', d.id, event.x, event.y);

    if (!event.active) simulation.alphaTarget(0.3).restart();
    
    d.fx = d.x;
    d.fy = d.y;
  }
  function onDrag(event, d) {
    // This line will prevent the zoom behavior from taking over

    d.fx = event.x;
    d.fy = event.y;
  }
  function onDragEnd(event, d) {


    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  return await post_process.call(this, cluster_groups, frag, opts);
}

export async function post_process(cluster_groups, frag, opts = {}) {
  const refreshBtn = frag.querySelector('.sc-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (typeof opts.refresh_view === 'function') {
        opts.refresh_view();
      }
    });
  }
  const rebuildBtn = frag.querySelector('.sc-rebuild');
  if (rebuildBtn) {
    rebuildBtn.addEventListener('click', async () => {
      await cluster_groups.build_groups();
      if (typeof opts.refresh_view === 'function') {
        opts.refresh_view();
      }
    });
  }
  const helpBtn = frag.querySelector('.sc-help');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      window.open('https://docs.smartconnections.app/clusters#visualizer', '_blank');
    });
  }
  return frag;
}

export default { build_html, render, post_process };
