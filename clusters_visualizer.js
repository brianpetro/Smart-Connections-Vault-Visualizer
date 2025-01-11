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
  // const plugin_class = cluster_groups.env.smart_visualizer_plugin;
  const snapshot = await cluster_groups.get_snapshot(Object.values(cluster_groups.env.smart_sources.items));
  const {clusters, members} = snapshot;

  // 1. Build top-level HTML
  const html = await build_html.call(this, cluster_groups, opts);
  const frag = this.create_doc_fragment(html);

  // 2. Reference the SVG, set up d3
  const svgEl = frag.querySelector('.clusters-visualizer-svg');
  const width = 800;
  const height = 600;
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // 3. Construct data arrays for cluster center nodes + member nodes
  const clusterArray = Object.values(clusters.items);
  const nodes = [];
  const links = [];
  const nodeMap = {};

  // Each cluster is a node
  clusterArray.forEach((cluster, i) => {
    const cNode = {
      id: cluster.key,       // e.g. "cluster_1"
      type: 'cluster',
      cluster: cluster,
      x: width / 2 + (i * 30 - 50),
      y: height / 2,
      color: '#926ec9',
      radius: 20
    };
    nodeMap[cluster.key] = cNode;
    nodes.push(cNode);
  });

  // Create cluster-to-cluster links based on top-2 cos_sim of group_vec
  const cluster_links = [];

  // For each cluster cA, compute sim to others, sort descending, take top 2
  for (let i = 0; i < clusterArray.length; i++) {
    const cA = clusterArray[i];
    if (!cA.group_vec) continue;

    // Gather sims with all other clusters
    const neighbors = [];
    for (let j = 0; j < clusterArray.length; j++) {
      if (i === j) continue;
      const cB = clusterArray[j];
      if (!cB.group_vec) continue;

      const sim = cos_sim(cA.group_vec, cB.group_vec); // typically in [0..1]
      neighbors.push({ cB, sim });
    }

    // Sort neighbors by descending sim
    neighbors.sort((a, b) => b.sim - a.sim);

    // Take top 2
    const topNeighbors = neighbors.slice(0, 2);

    // Construct links
    topNeighbors.forEach(({ cB, sim }) => {
      // distance = baseDist * (1 - sim) + offset
      const distance = 100 * (1 - sim) + 30;

      cluster_links.push({
        source: cA.key,
        target: cB.key,
        sim,
        stroke: '#a581d4',
        distance
      });
    });
  }

  // normalize score to [0..1]
  const nearest_members_per_cluster = {};
  for (let c of clusterArray) {
    const results = await c.get_nearest_members();
    const min_cluster_score = Math.min(...results.map(r => r.score)) + 0.01;
    const max_cluster_score = Math.max(...results.map(r => r.score)) - 0.01;
    nearest_members_per_cluster[c.key] = { results, min_cluster_score, max_cluster_score };
  }
  const min_score = Math.min(...Object.values(nearest_members_per_cluster).map(r => r.min_cluster_score));
  const max_score = Math.max(...Object.values(nearest_members_per_cluster).map(r => r.max_cluster_score));

  // For each cluster, retrieve its members
  for (let c of clusterArray) {
    const results = nearest_members_per_cluster[c.key].results;
    results.forEach((result) => {
      result.score = (result.score - min_score) / (max_score - min_score);
      const srcKey = result.item.key;
      if (!nodeMap[srcKey]) {
        nodeMap[srcKey] = {
          id: srcKey,          // e.g. "my_source.md"
          type: 'source',
          source: result.item, // reference to the SmartSource
          color: '#7c8594',
          radius: 7
        };
        nodes.push(nodeMap[srcKey]);
      }
      links.push({
        source: c.key,
        target: srcKey,
        score: result.score,
        stroke: '#4c7787'
      });
    });
  }

  // Combine the two link sets (cluster-to-cluster, and cluster-to-member)
  const all_links = [...links, ...cluster_links];

  // 4. Force simulation
  const simulation = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().strength(-100))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('link', d3.forceLink(all_links).id(d => d.id)
      .distance(link => {
        // For cluster-cluster links, we have a 'distance' property
        if (typeof link.distance === 'number') return link.distance;
        // Else assume cluster-member link
        // Original approach: distance = 220 - (link.score * 150)
        if (typeof link.score === 'number') {
          return 220 - (link.score * 150);
        }
        // fallback
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
    .data(all_links)
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
        console.log(`Clicked cluster: ${d.id}`);
      } else if (d.type === 'source') {
        // Attempt to open note if the environment or plugin supports it
        d.source?.env?.plugin?.open_note?.(d.source.key, event);
      }
    })
    .on('mouseover', (event, d) => {
      // Only show the label for the hovered node
      labelSelection
        .filter(ld => ld.id === d.id)
        .transition()
        .style('opacity', 1);
    })
    .on('mouseout', (event, d) => {
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
      if (d.type === 'cluster') return d.id;
      if (d.type === 'source') return d.source?.key || d.id;
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
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function onDrag(event, d) {
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
