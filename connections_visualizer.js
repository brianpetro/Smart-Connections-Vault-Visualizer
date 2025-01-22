/**
 * @file connections_visualizer.js
 * @description Visualizes Smart Connections in a D3 force-directed layout, now with advanced settings akin to main.ts in Smart-Connections-Visualizer.
 */

import * as d3 from 'd3';

/**
 * Builds the top-level HTML for the visualization container + advanced menu.
 * @param {Object} item - The entity to visualize (e.g. a SmartSource or entire vault)
 * @param {Object} [opts]
 * @returns {Promise<string>}
 */
export async function build_html(item, opts = {}) {
  // We insert a top bar with settings button + refresh icon, plus a hidden advanced menu
  // (similar to your main.ts logic). 
  return `
    <div class="sc-connections-visualizer">
      <div class="sc-connections-visualizer-topbar">
        <div class="sc-connections-visualizer-actions">
          <button class="sc-settings-btn" title="Open settings">
            ${this.get_icon_html?.('settings') || '⚙'}
          </button>
          <button class="sc-refresh-btn" title="Refresh">
            ${this.get_icon_html?.('refresh-cw') || '⟳'}
          </button>
        </div>
      </div>
      
      <div class="sc-visualizer-menu-header sc-collapsed" style="display:none;">
        <!-- Collapsible area for advanced settings -->
        <div class="sc-visualizer-dropdown-menu sc-visualizer-dropdown-menu-content">
          <!-- Filter Settings, Display Settings, Force Settings, etc. will go here -->
          <div class="sc-visualizer-accordion-item">
            <div class="sc-visualizer-accordion-header" data-section="filters">
              <span>Filters</span>
              <span class="sc-arrow">▶</span>
            </div>
            <div class="sc-visualizer-accordion-content" style="display: none;">
              <div class="sc-slider-container">
                <label id="sc-relevance-threshold-label" for="sc-relevance-threshold-input">Min Relevance: 50%</label>
                <input type="range" min="0" max="0.99" step="0.01"
                       id="sc-relevance-threshold-input" class="sc-slider"
                       value="0.5" />
              </div>
              <div class="sc-radio-container">
                <label>Connection Type:</label>
                <label><input type="radio" name="sc-conn-type" value="block" checked /> Block</label>
                <label><input type="radio" name="sc-conn-type" value="note" /> Note</label>
                <label><input type="radio" name="sc-conn-type" value="both" /> Both</label>
              </div>
            </div>
          </div>

          <div class="sc-visualizer-accordion-item">
            <div class="sc-visualizer-accordion-header" data-section="display">
              <span>Display</span>
              <span class="sc-arrow">▶</span>
            </div>
            <div class="sc-visualizer-accordion-content" style="display: none;">
              <div class="sc-slider-container">
                <label id="sc-node-size-label" for="sc-node-size-input">Node Size: 4</label>
                <input type="range" min="1" max="15" step="0.1" id="sc-node-size-input"
                       value="4" class="sc-slider" />
              </div>
              <div class="sc-slider-container">
                <label id="sc-minLinkThicknessLabel" for="sc-minLinkThickness">Min Link Thickness: 0.3</label>
                <input type="range" min="0.1" max="10" step="0.1"
                       id="sc-minLinkThickness" class="sc-slider" value="0.3" />
              </div>
              <div class="sc-slider-container">
                <label id="sc-maxLinkThicknessLabel" for="sc-maxLinkThickness">Max Link Thickness: 0.6</label>
                <input type="range" min="0.1" max="10" step="0.1"
                       id="sc-maxLinkThickness" class="sc-slider" value="0.6" />
              </div>
              <div class="sc-slider-container">
                <label id="sc-fadeThresholdLabel" for="sc-fadeThreshold">Text fade threshold: 1.1</label>
                <input type="range" min="0.1" max="3" step="0.1"
                       id="sc-fadeThreshold" value="1.1" />
              </div>
              <div class="sc-slider-container">
                <label id="sc-linkLabelSizeLabel" for="sc-linkLabelSize">Link label size: 7</label>
                <input type="range" min="1" max="15" step="0.5"
                       id="sc-linkLabelSize" value="7" />
              </div>
              <div class="sc-slider-container">
                <label id="sc-nodeLabelSizeLabel" for="sc-nodeLabelSize">Node label size: 6</label>
                <input type="range" min="1" max="15" step="0.5"
                       id="sc-nodeLabelSize" value="6" />
              </div>
            </div>
          </div>

          <div class="sc-visualizer-accordion-item">
            <div class="sc-visualizer-accordion-header" data-section="forces">
              <span>Forces</span>
              <span class="sc-arrow">▶</span>
            </div>
            <div class="sc-visualizer-accordion-content" style="display: none;">
              <div class="sc-slider-container">
                <label id="sc-repelForceLabel" for="sc-repelForce">Repel Force: 400</label>
                <input type="range" min="0" max="1500" step="10" value="400" id="sc-repelForce" />
              </div>
              <div class="sc-slider-container">
                <label id="sc-linkForceLabel" for="sc-linkForce">Link Force: 0.4</label>
                <input type="range" min="0" max="1" step="0.01" value="0.4" id="sc-linkForce" />
              </div>
              <div class="sc-slider-container">
                <label id="sc-linkDistanceLabel" for="sc-linkDistance">Link Distance: 70</label>
                <input type="range" min="10" max="200" step="5" value="70" id="sc-linkDistance" />
              </div>
              <div class="sc-slider-container">
                <label id="sc-centerForceLabel" for="sc-centerForce">Center Force: 0.1</label>
                <input type="range" min="0" max="1" step="0.01" value="0.1" id="sc-centerForce" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- The main SVG container -->
      <div class="sc-visualizer-svg-container">
        <svg class="sc-connections-visualizer-svg" width="100%" height="600"
             style="pointer-events: all"></svg>
      </div>
    </div>
  `;
}

/**
 * Main D3 rendering logic for the connections force-directed graph, 
 * plus advanced UI from Smart-Connections-Visualizer.
 * 
 * @param {Object} item - Typically a SmartSource or the entire smart_sources collection
 * @param {Object} [opts = {}] - Additional options
 * @returns {Promise<HTMLElement>} DOM fragment containing the visualization
 */
export async function render(item, opts = {}) {
  // Basic local "settings" (mirroring main.ts). 
  // In your code, you can store/retrieve from plugin.env or this.env?
  const settings = {
    relevanceScoreThreshold: 0.5,
    connectionType: 'block',  // block | note | both
    nodeSize: 4,
    fadeThreshold: 1.1,
    repelForce: 400,
    linkForce: 0.4,
    linkDistance: 70,
    centerForce: 0.1,
    minLinkThickness: 0.3,
    maxLinkThickness: 0.6,
    linkLabelSize: 7,
    nodeLabelSize: 6,
    noteFillColor: '#7c8594',
    blockFillColor: '#926ec9',
  };

  // 1) Build base HTML
  const html = await build_html.call(this, item, opts);
  const frag = this.create_doc_fragment(html);

  // 2) Access the <svg> element & set up size
  const svgElement = frag.querySelector('.sc-connections-visualizer-svg');
  const width = 800; 
  const height = 600;
  svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const svg = d3.select(svgElement);
  svg.selectAll('*').remove(); // clear prior contents

  // A top-level container for zoom/pan
  const container_g = svg.append('g')
    .attr('class', 'sc-connections-visualizer-container');

  // Setup zoom
  const zoom_behavior = d3.zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', (event) => {
      container_g.attr('transform', event.transform);
      // Keep labels at a consistent size
      labelSelection.attr('transform', d => {
        const x = d.x;
        const y = d.y - (d.radius + 3);
        return `translate(${x},${y}) scale(${1 / event.transform.k})`;
      });
    });

  svg.call(zoom_behavior);

  // 3) Build your data. The snippet below matches main.ts logic:
  //    We interpret "item" as a single file => find connections 
  //    or entire vault => list some central entity etc.
  //    For demonstration, this does the "central node" approach from main.ts
  const results = await item.find_connections({ limit: 20 });
  // Normalize the scores to [0..1]
  const min_score = Math.min(...results.map(r => r.score)) || 0.01;
  const max_score = Math.max(...results.map(r => r.score)) || 1.0;
  results.forEach(r => {
    const range = (max_score - min_score) || 1;
    r.score = (r.score - min_score) / range;
  });

  // Build a "central node"
  const centralNode = {
    id: item.key || 'central',
    group: 'central',
    name: item.name || item.path || 'Current File',
    fx: width / 2,
    fy: height / 2,
    radius: settings.nodeSize + 2,
    color: '#7c8594',  // central color
  };

  const nodes = [centralNode];
  const links = [];

  // Filter based on "connectionType"
  const filterByType = (c) => {
    if(settings.connectionType === 'both') return true;
    const isBlock = (c.item.collection_key === 'smart_blocks');
    if(settings.connectionType === 'block') return isBlock;
    if(settings.connectionType === 'note') return !isBlock;
    return true;
  };
  const filtered = results.filter(r => r.score >= settings.relevanceScoreThreshold)
                          .filter(filterByType);

  // For each connection, create a node if not existing; link it from central
  filtered.forEach(conn => {
    const nodeId = conn.item.key;
    let existing = nodes.find(n => n.id === nodeId);
    if(!existing) {
      existing = {
        id: nodeId,
        group: (conn.item.collection_key === 'smart_blocks') ? 'block' : 'note',
        name: conn.item.name || nodeId,
        radius: settings.nodeSize,
        color: (conn.item.collection_key === 'smart_blocks') 
                ? settings.blockFillColor 
                : settings.noteFillColor
      };
      nodes.push(existing);
    }
    links.push({
      source: centralNode.id,
      target: existing.id,
      score: conn.score
    });
  });

  // 4) Create a force simulation
  const simulation = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().strength(-settings.repelForce))
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(() => settings.linkDistance)
      .strength(settings.linkForce)
    )
    .force('center', d3.forceCenter(width / 2, height / 2).strength(settings.centerForce))
    .on('tick', ticked);

  // 5) Draw the edges
  const linkSelection = container_g.append('g')
    .attr('class', 'smart-connections-visualizer-links')
    .selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', '#4c7787')
    .attr('stroke-width', d => linkWidthScale(d.score, settings));

  // 6) Draw the nodes
  const nodeSelection = container_g.append('g')
    .attr('class', 'smart-connections-visualizer-nodes')
    .selectAll('circle')
    .data(nodes)
    .enter()
    .append('circle')
    .attr('r', d => d.radius)
    .attr('fill', d => d.color)
    .call(d3.drag()
      .on('start', onDragStart)
      .on('drag', onDrag)
      .on('end', onDragEnd)
    )
    .on('click', (event, d) => {
      console.log('Clicked node:', d.id);
      if(d.group !== 'central') {
        // Possibly open the note in Obsidian
        d?.env?.plugin?.open_note?.(d.id, event);
      }
    })
    .on('mouseover', (event, d) => {
      // highlight logic if desired
      showNodeLabel(d, true);
    })
    .on('mouseout', (event, d) => {
      showNodeLabel(d, false);
    });

  // 7) Node labels (hidden by default, fade in on hover)
  const labelSelection = container_g.append('g')
    .attr('class', 'smart-connections-visualizer-labels')
    .selectAll('text')
    .data(nodes)
    .enter()
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', '#ccc')
    .attr('font-size', settings.nodeLabelSize)
    .attr('opacity', 0)
    .text(d => d.name);

  // 8) Link labels (optional)
  // To parallel main.ts, you might want link labels. We'll add them but keep them hidden unless hovered:
  const linkLabelSelection = container_g.append('g')
    .attr('class', 'smart-connections-visualizer-link-labels')
    .selectAll('text')
    .data(links)
    .enter()
    .append('text')
    .attr('fill', '#bbb')
    .attr('font-size', settings.linkLabelSize)
    .attr('opacity', 0)
    .text(d => (d.score * 100).toFixed(1) + '%');

  function ticked() {
    linkSelection
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    nodeSelection
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    // keep label transformations in sync
    labelSelection.attr('x', d => d.x)
                  .attr('y', d => d.y - (d.radius + 3));
    
    linkLabelSelection
      .attr('x', d => (d.source.x + d.target.x)/2)
      .attr('y', d => (d.source.y + d.target.y)/2);
  }

  // node drag
  function onDragStart(event, d) {
    if(!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function onDrag(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function onDragEnd(event, d) {
    if(!event.active) simulation.alphaTarget(0);
    if(d.group !== 'central') {
      d.fx = null;
      d.fy = null;
    }
  }

  // show/hide node label
  function showNodeLabel(d, show) {
    labelSelection.filter(ld => ld.id === d.id)
      .transition()
      .duration(200)
      .attr('opacity', show ? 1 : 0);
  }

  // Another function for show/hide link label if hovered, e.g. 
  // (omitted for brevity, see the "main.ts" approach if needed)

  // Return final doc fragment after optional post_process
  return await post_process.call(this, item, frag, opts);
}

/**
 * Adjust stroke width by link score, constrained by min/max link thickness
 */
function linkWidthScale(score, s) {
  // linear interpolation from score
  return d3.scaleLinear()
           .domain([0, 1])
           .range([s.minLinkThickness, s.maxLinkThickness])(score);
}

/**
 * Post-process function: wires up advanced UI interactions for sliders & menu
 * plus the "Refresh" button, etc.
 * 
 * @param {Object} item - The input item
 * @param {HTMLElement} frag - The root DOM
 * @param {Object} opts
 * @returns {Promise<HTMLElement>}
 */
export async function post_process(item, frag, opts = {}) {
  // 1) The advanced menu toggle
  const settingsBtn = frag.querySelector('.sc-settings-btn');
  const refreshBtn = frag.querySelector('.sc-refresh-btn');
  const menuHeader = frag.querySelector('.sc-visualizer-menu-header');
  
  settingsBtn?.addEventListener('click', () => {
    menuHeader.style.display = (menuHeader.style.display === 'none') ? 'block' : 'none';
  });

  // 2) The accordion toggles for "Filters", "Display", "Forces"
  const accordionHeaders = frag.querySelectorAll('.sc-visualizer-accordion-header');
  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      if(!content) return;
      // Toggle
      const currentlyVisible = (content.style.display !== 'none');
      content.style.display = currentlyVisible ? 'none' : 'block';
      // rotate arrow
      const arrow = header.querySelector('.sc-arrow');
      if(arrow) arrow.textContent = currentlyVisible ? '▶' : '▼';
    });
  });

  // 3) Refresh button
  refreshBtn?.addEventListener('click', () => {
    if(typeof opts.refresh_view === 'function') {
      opts.refresh_view();
    } else {
      console.log('[connections_visualizer] refresh clicked, no refresh_view() provided');
    }
  });

  // 4) Hook up each slider & radio to re-render the graph or pass changes 
  //    back to environment if you want.

  // For example, the "Relevance threshold" slider:
  const relSlider = frag.querySelector('#sc-relevance-threshold-input');
  const relSliderLabel = frag.querySelector('#sc-relevance-threshold-label');
  if(relSlider) {
    relSlider.addEventListener('input', () => {
      const val = parseFloat(relSlider.value);
      if(relSliderLabel) {
        relSliderLabel.textContent = `Min Relevance: ${(val * 100).toFixed(0)}%`;
      }
      // In a real plugin, store this in environment or your local settings 
      // then re-run or do partial update. 
      // e.g. item.env.plugin.settings?.somehow = val
    });
  }

  // Similarly, the "connectionType" radios:
  const radioButtons = frag.querySelectorAll('input[name="sc-conn-type"]');
  radioButtons.forEach(radio => {
    radio.addEventListener('change', (event) => {
      // item.env.plugin.settings?.connectionType = event.target.value;
      // re-render or partial update
    });
  });

  // Then node size slider
  const nodeSizeSlider = frag.querySelector('#sc-node-size-input');
  const nodeSizeLabel = frag.querySelector('#sc-node-size-label');
  if(nodeSizeSlider) {
    nodeSizeSlider.addEventListener('input', () => {
      const val = parseFloat(nodeSizeSlider.value);
      if(nodeSizeLabel) nodeSizeLabel.textContent = `Node Size: ${val.toFixed(1)}`;
      // item.env.plugin.settings?.nodeSize = val
    });
  }

  // And so on for the others...
  const fadeThresholdSlider = frag.querySelector('#sc-fadeThreshold');
  const fadeThresholdLabel = frag.querySelector('#sc-fadeThresholdLabel');
  if(fadeThresholdSlider) {
    fadeThresholdSlider.addEventListener('input', () => {
      const val = parseFloat(fadeThresholdSlider.value);
      if(fadeThresholdLabel) fadeThresholdLabel.textContent = `Text fade threshold: ${val.toFixed(2)}`;
    });
  }

  // The pattern repeats for minLinkThickness, maxLinkThickness, linkDistance, etc.

  return frag;
}

export default { build_html, render, post_process };
