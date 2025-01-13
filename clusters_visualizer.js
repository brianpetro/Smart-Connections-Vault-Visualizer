/**
 * @file clusters_visualizer.js
 * @description Visualizes cluster members in a D3 force or radial layout.
 * Optimized to reduce repeated DOM queries, scale with large data sets,
 * and provide an optional debug mode.
 */

import * as d3 from 'd3';

/**
 * Builds the top-level HTML for the visualization container.
 * @param {Object} cluster_groups
 * @param {Object} [opts]
 * @returns {Promise<string>}
 */
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
        <svg class="clusters-visualizer-svg" width="100%" height="100%" style="pointer-events: all"></svg>
      </div>
    </div>
  `;
}

/**
 * Renders the D3 clusters visualization.
 * @param {Object} cluster_groups - The SmartClusters collection instance
 * @param {Object} [opts={}]
 * @param {boolean} [opts.debug=false] - If true, logs debug info to console.
 * @param {number} [opts.max_alpha_iterations=300] - Limits alpha iterations for simulation.
 * @returns {Promise<HTMLElement>} The rendered fragment
 */
export async function render(cluster_groups, opts = {}) {
  console.log('render() called with cluster_groups:', cluster_groups);
  const debug = !!opts.debug;
  if (debug) console.log('render() called with cluster_groups:', cluster_groups);

  const cluster_group = Object.values(cluster_groups.items)[0];
  if (!cluster_group) {
    return this.create_doc_fragment('<div>No cluster group found!</div>');
  }

  const snapshot = await cluster_group.get_snapshot(
    Object.values(cluster_groups.env.smart_sources.items)
  );
  const { clusters, members } = snapshot;

  if (debug) {
    console.log('clusters:', clusters);
    console.log('members:', members);
  }

  // 1. Build top-level HTML and fragment
  const html = await build_html.call(this, cluster_groups, opts);
  const frag = this.create_doc_fragment(html);

  const svg_el = frag.querySelector('.clusters-visualizer-svg');
  if (!svg_el) {
    if (debug) console.warn('No SVG element found in the fragment.');
    return frag;
  }

  // Set viewBox
  const width = 800;
  const height = 600;
  svg_el.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // 2. Construct nodes and links
  const nodes = [];
  const links = [];
  const node_map = {};

  clusters.forEach((cluster) => {
    const c_key = cluster.data.key;
    const c_node = {
      id: c_key,
      type: 'cluster',
      color: '#926ec9',
      radius: 20,
      cluster
    };
    node_map[c_key] = c_node;
    nodes.push(c_node);
  });

  members.forEach((member) => {
    const member_key = member.item?.data?.key || 'unknown-member';
    if (!node_map[member_key]) {
      node_map[member_key] = {
        id: member_key,
        type: 'member',
        color: '#7c8594',
        radius: 7,
        source: member.item
      };
      nodes.push(node_map[member_key]);
    }

    // link if above threshold
    Object.entries(member.clusters).forEach(([cl_id, cl_data]) => {
      const { score } = cl_data;
      if (score >= 0.6 && node_map[cl_id]) {
        links.push({
          source: cl_id,
          target: member_key,
          score,
          stroke: '#4c7787'
        });
      }
    });
  });

  // 3. Force simulation
  const all_scores = links.filter(link => typeof link.score === 'number').map(link => link.score);
  const min_score = d3.min(all_scores) ?? 0.6;
  const max_score = d3.max(all_scores) ?? 1.0;

  const distance_scale = d3.scaleLinear()
    .domain([min_score, max_score])
    .range([220, 80])
    .clamp(true);

  // Lower repulsion for large sets
  const charge_strength = nodes.length > 200 ? -60 : -100;
  const simulation = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().strength(charge_strength))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force(
      'link',
      d3.forceLink(links)
        .id(d => d.id)
        .distance(link => {
          if (typeof link.score === 'number') {
            return distance_scale(link.score);
          }
          return 200;
        })
    )
    .stop(); // We'll step manually below

  // Step the simulation up to a max alpha or until stable
  const max_iter = opts.max_alpha_iterations || 300;
  let i = 0;
  while (simulation.alpha() > 0.01 && i < max_iter) {
    simulation.tick();
    i++;
  }
  if (debug) console.log(`Simulation stopped after ${i} iterations with alpha=${simulation.alpha()}`);

  // 4. Build D3 structure
  const svg = d3.select(svg_el);
  svg.selectAll('*').remove();

  const container_g = svg.append('g').attr('class', 'sc-clusters-visualizer-container');

  const zoom_behavior = d3.zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', (event) => {
      container_g.attr('transform', event.transform);
    });
  svg.call(zoom_behavior);

  const link_selection = container_g.append('g')
    .attr('class', 'sc-cluster-links')
    .selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', d => d.stroke || '#cccccc')
    .attr('stroke-width', 1.2)
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  const node_selection = container_g.append('g')
    .attr('class', 'sc-cluster-nodes')
    .selectAll('circle')
    .data(nodes)
    .enter()
    .append('circle')
    .attr('r', d => d.radius)
    .attr('fill', d => d.color)
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .call(d3.drag()
      .on('start', on_drag_start)
      .on('drag', on_drag)
      .on('end', on_drag_end)
    );

  // Show/hide labels on hover
  const label_selection = container_g.append('g')
    .attr('class', 'sc-cluster-node-labels')
    .selectAll('text')
    .data(nodes)
    .enter()
    .append('text')
    .attr('x', d => d.x)
    .attr('y', d => d.y - (d.radius + 2))
    .attr('font-size', 10)
    .attr('fill', '#cccccc')
    .attr('text-anchor', 'middle')
    .style('opacity', 0)
    .text(d => {
      if (d.type === 'cluster') {
        return d.cluster?.data?.key || d.id;
      }
      if (d.type === 'member') {
        return d.source?.data?.key || d.id;
      }
      return d.id;
    });

  node_selection
    .on('click', (event, d) => {
      if (debug) console.log('Node clicked:', d.id);
      if (d.type === 'member') {
        d.source?.env?.plugin?.open_note?.(d.source.key, event);
      }
    })
    .on('mouseover', (event, d) => {
      d3.select(event.currentTarget).style('cursor', 'pointer');
      label_selection
        .filter(ld => ld.id === d.id)
        .transition()
        .style('opacity', 1);
    })
    .on('mouseout', (event, d) => {
      d3.select(event.currentTarget).style('cursor', 'default');
      label_selection
        .filter(ld => ld.id === d.id)
        .transition()
        .style('opacity', 0);
    });

  // 5. Drag handlers
  function on_drag_start(event, d) {
    if (debug) console.log('on_drag_start', d.id, event.x, event.y);
    d.fx = d.x;
    d.fy = d.y;
  }
  function on_drag(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function on_drag_end(event, d) {
    d.fx = null;
    d.fy = null;
  }

  return await post_process.call(this, cluster_groups, frag, opts);
}

/**
 * Post-process function: binds refresh, rebuild, help buttons.
 * @param {Object} cluster_groups
 * @param {HTMLElement} frag
 * @param {Object} [opts]
 * @returns {Promise<HTMLElement>}
 */
export async function post_process(cluster_groups, frag, opts = {}) {
  const refresh_btn = frag.querySelector('.sc-refresh');
  if (refresh_btn) {
    refresh_btn.addEventListener('click', () => {
      if (typeof opts.refresh_view === 'function') {
        opts.refresh_view();
      }
    });
  }
  const rebuild_btn = frag.querySelector('.sc-rebuild');
  if (rebuild_btn) {
    rebuild_btn.addEventListener('click', async () => {
      await cluster_groups.build_groups();
      if (typeof opts.refresh_view === 'function') {
        opts.refresh_view();
      }
    });
  }
  const help_btn = frag.querySelector('.sc-help');
  if (help_btn) {
    help_btn.addEventListener('click', () => {
      window.open('https://docs.smartconnections.app/clusters#visualizer', '_blank');
    });
  }
  return frag;
}

export default { build_html, render, post_process };
