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
          <button class="sc-pin" aria-label="Pin the network in place (disable physics)">
            <span class="sc-icon-pin">${this.get_icon_html?.('pin') || '📌'}</span>
            <span class="sc-icon-pin-off" style="display:none;">${this.get_icon_html?.('pin-off') || '📍'}</span>
            <span class="sc-button-label">Pin layout</span>
          </button>
          <button class="sc-create-cluster" aria-label="Create a new cluster with connections relative to the selected node(s)">
            ${this.get_icon_html?.('group') || 'group'}
            <span class="sc-button-label">Create cluster</span>
          </button>
          <button class="sc-remove-from-cluster" aria-label="Ungroup the selected node(s) from the selected cluster">
            ${this.get_icon_html?.('ungroup') || 'ungroup'}
            <span class="sc-button-label">Ungroup from cluster</span>
          </button>
          <!--
          <button class="sc-add-to-cluster" aria-label="Merge node(s) to cluster">
            ${this.get_icon_html?.('combine') || 'combine'}
          </button>
          -->
          <button class="sc-add-to-cluster-center" aria-label="Add node(s) to cluster's center - Makes cluster connect to more notes like selection">
            ${this.get_icon_html?.('badge-plus') || 'plus'}
            <span class="sc-button-label">Add to center</span>
          </button>
          <button class="sc-remove-cluster-center" aria-label="Remove node(s) from cluster's center - Make cluster connect to fewer notes like selection">
            ${this.get_icon_html?.('badge-minus') || 'minus'}
            <span class="sc-button-label">Remove from center</span>
          </button>
          <button class="sc-remove-cluster" aria-label="Remove the selected cluster(s)">
            ${this.get_icon_html?.('badge-x') || 'badge-x'}
            <span class="sc-button-label">Remove cluster(s)</span>
          </button>
          <button class="sc-refresh" aria-label="Refresh clusters visualization">
            ${this.get_icon_html?.('refresh-cw') || '⟳'}
            <span class="sc-button-label">Refresh viz</span>
          </button>
        </div>
      </div>

      <!-- Threshold slider row beneath top bar -->
      <div class="sc-threshold-row">
        <label for="threshold-slider" class="sc-threshold-label">
          Threshold: <span id="threshold-value">0.4</span>
        </label>
        <input
          type="range"
          id="threshold-slider"
          min="0"
          max="1"
          step="0.01"
          value="0.4"
          data-smart-setting="threshold"
        />
      </div>

      <div class="sc-visualizer-content" style="width: 100%; height: 100%;">
        <canvas
          class="clusters-visualizer-canvas"
          width="100%"
          height="100%"
          style="display:block;"
        >
        </canvas>
      </div>
    </div>
  `;
}

// HELPER: find node at the given simulation coords (sx, sy) within radius
function findNodeAt(sx, sy, nodes, currentZoom, expandThreshold = 3.0) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];

    // (Optional) skip child centers if zoom is below threshold
    if (node.type === 'center' && currentZoom < expandThreshold) {
      continue;
    }

    const dx = sx - node.x;
    const dy = sy - node.y;
    if (dx * dx + dy * dy <= node.radius * node.radius) {
      return node;
    }
  }
  return null;
}


export async function render(view, opts = {}) {
  // Let debug logging only occur if the caller sets opts.debug
  let debug = !!opts.debug;

  if (debug) console.log('render() called with:', view.env.cluster_groups);

  const cluster_groups = view.env.cluster_groups;
  const cluster_group = Object.values(cluster_groups.items).sort((a, b) => b.key.localeCompare(a.key))[0];
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
    // find member with key simon
    const simon_member = members.find(
      (member) => getLastSegmentWithoutExtension(member.item.key) === 'Simon'
    );
    console.log('simon_member:', simon_member);
  }

  // Build top-level HTML with <canvas> + toolbar
  const html = await build_html.call(this, cluster_groups, opts);
  const frag = this.create_doc_fragment(html);

  // Grab the "pin" button
  const pinBtn = frag.querySelector('.sc-pin');
  const createClusterBtn = frag.querySelector('.sc-create-cluster');
  const addToClusterBtn = frag.querySelector('.sc-add-to-cluster');
  const addToClusterCenterBtn = frag.querySelector('.sc-add-to-cluster-center');
  const removeFromClusterCenterBtn = frag.querySelector('.sc-remove-cluster-center');
  const removeClusterBtn = frag.querySelector('.sc-remove-cluster');
  const removeFromClusterBtn = frag.querySelector('.sc-remove-from-cluster');

  // Helper to show/hide
  function showButton(btn, doShow) {
    if (!btn) return;
    btn.style.display = doShow ? 'inline-flex' : 'none';
  }

  function updateToolbarUI() {
    // Hide everything by default:
    showButton(createClusterBtn, false);
    showButton(removeFromClusterBtn, false);
    showButton(addToClusterCenterBtn, false);
    showButton(removeFromClusterCenterBtn, false);
    showButton(removeClusterBtn, false);

    if (debug) console.log('selectedNodes: ', selectedNodes);

    // If nothing selected, we're done (pin & refresh remain visible):
    if (selectedNodes.size === 0) {
      return;
    }

    // Gather a count by type:
    let memberCount = 0;
    let clusterCount = 0;
    let centerCount = 0;

    for (const node of selectedNodes) {
      if (node.type === 'member') memberCount++;
      else if (node.type === 'cluster') clusterCount++;
      else if (node.type === 'center') centerCount++;
    }

    if (debug) {
      console.log('memberCount: ', memberCount);
      console.log('cluster count: ', clusterCount);
      console.log('center count: ', centerCount);
    }

    // Some short helpers:
    const onlyMembers = (memberCount > 0 && clusterCount === 0 && centerCount === 0);
    const onlyCenter = (centerCount > 0 && memberCount === 0 && clusterCount === 0);
    const onlyCluster = (clusterCount > 0 && memberCount === 0 && centerCount === 0);

    // 1) When node(s) of type members *only*:
    if (onlyMembers) {
      // Show "Create cluster"
      showButton(createClusterBtn, true);
    }

    // 2) When node(s) of type members *AND* exactly one cluster:
    if (memberCount > 0 && clusterCount === 1) {
      showButton(removeFromClusterBtn, true);
      showButton(addToClusterCenterBtn, true);
    }

    // 3) When node(s) of type center *only*:
    if (onlyCenter) {
      showButton(removeFromClusterCenterBtn, true);
      showButton(removeFromClusterBtn, true);
    }

    // 4) When node(s) of type cluster *only*:
    if (onlyCluster) {
      showButton(removeClusterBtn, true);
    }
  }

  // Add any listeners for your plugin settings
  this.add_settings_listeners(cluster_group, frag);

  // Grab the canvas context
  const canvas_el = frag.querySelector('.clusters-visualizer-canvas');
  if (!canvas_el) {
    console.warn('No <canvas> element found!');
    return frag;
  }
  const context = canvas_el.getContext('2d');

  // For the immediate container
  const container_el = frag.querySelector('.sc-visualizer-content');

  function resizeCanvas() {
    const { width, height } = container_el.getBoundingClientRect();
    canvas_el.width = width;
    canvas_el.height = height;
    ticked();
  }

  requestAnimationFrame(() => {
    setTimeout(() => {
      resizeCanvas();
      centerNetwork();
      ticked();
    }, 0);
  });

  function centerNetwork() {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    nodes.forEach((d) => {
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.y < minY) minY = d.y;
      if (d.y > maxY) maxY = d.y;
    });

    const w = canvas_el.width;
    const h = canvas_el.height;

    const networkWidth = maxX - minX;
    const networkHeight = maxY - minY;

    if (networkWidth === 0 || networkHeight === 0) {
      // Everything is at the same point
      transform = d3.zoomIdentity.translate(w / 2, h / 2).scale(1);
    } else {
      const padding = 0.1;
      const scale = (1 - padding) / Math.max(networkWidth / w, networkHeight / h);

      const midX = (maxX + minX) / 2;
      const midY = (maxY + minY) / 2;

      transform = d3.zoomIdentity
        .translate(w / 2, h / 2)
        .scale(scale)
        .translate(-midX, -midY);
    }

    d3.select(canvas_el)
      .call(zoom_behavior.transform, transform);
  }

  // Locate the threshold slider and value elements
  const slider = frag.querySelector('#threshold-slider');
  const thresholdValueSpan = frag.querySelector('#threshold-value');
  if (slider) {
    slider.value = cluster_group.settings?.threshold || slider.value;

    let debounceTimeout;
    slider.addEventListener('input', (event) => {
      const threshold = parseFloat(slider.value);
      if (thresholdValueSpan) {
        thresholdValueSpan.textContent = threshold.toFixed(2);
      }
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        updateLinks(threshold);
        centerNetwork();
        cluster_group.queue_save();
      }, 100);
    });
  } else {
    console.error('Slider element not found!');
  }

  function updateLinks(threshold) {
    const newLinks = [];

    members.forEach((member) => {
      const member_key = member.item?.key || 'unknown-member';
      Object.entries(member.clusters).forEach(([cl_id, cl_data]) => {
        const { score } = cl_data;
        if (score >= threshold && node_map[cl_id]) {
          const existingLink = links.find(
            (link) => link.source.id === cl_id && link.target.id === member_key
          );

          newLinks.push({
            source: cl_id,
            target: member_key,
            score,
            stroke: existingLink?.stroke || '#4c7787',
            currentAlpha: existingLink?.currentAlpha || 1,
          });
        }
      });
    });

    // Replace the links array
    links.length = 0;
    links.push(...newLinks);

    // Restart the simulation with updated links
    simulation
      .force(
        'link',
        d3.forceLink(links)
          .id((d) => d.id)
          .distance((link) =>
            typeof link.score === 'number' ? distance_scale(link.score) : 200
          )
      )
      .force('center', d3.forceCenter(0, 0))
      .force('radial', d3.forceRadial(100, 0, 0).strength(0.05));

    simulation.alpha(1).restart();
  }

  const nodes = [];
  const links = [];
  const node_map = {};

  function getLastSegmentWithoutExtension(fullPath) {
    const segments = fullPath.split('/');
    const lastSegment = segments[segments.length - 1];
    return lastSegment.replace(/\.[^/.]+$/, '');
  }

  clusters.forEach((cluster) => {
    const childCount = Array.isArray(cluster.centers) ? cluster.centers.length : 0;
    const baseRadius = 20;
    const growthFactor = 3;
    const maxRadius = 70;
    const scaledRadius = Math.min(baseRadius + childCount * growthFactor, maxRadius);

    const c_node = {
      id: cluster.key,
      type: 'cluster',
      color: '#926ec9',
      radius: scaledRadius,
      cluster: cluster,
      children: [],
    };

    nodes.push(c_node);
    node_map[cluster.key] = c_node;

    if (childCount > 0) {
      cluster.centers.forEach((item, i) => {
        const angle = (i / childCount) * 2 * Math.PI;
        const dist = scaledRadius * 0.7;
        const childNode = {
          id: `${item.key}`,
          type: 'center',
          color: '#d092c9',
          radius: 4,
          parent: c_node,
          cluster,
          item,
          offsetAngle: angle,
          offsetDist: dist,
        };
        nodes.push(childNode);
        c_node.children.push(childNode);
      });
    }
  });

  if (debug) console.log('clusters 2: ', clusters);

  members.forEach((member) => {
    const member_key = member.item?.key || 'unknown-member';
    const isAlreadyInCluster = node_map[member_key] !== undefined;
    const isAlreadyCenter = nodes.some((n) => n.id === member_key && n.type === 'center');

    if (!isAlreadyInCluster && !isAlreadyCenter) {
      node_map[member_key] = {
        id: member_key,
        type: 'member',
        color: '#7c8594',
        radius: 7,
        item: member.item,
      };
      nodes.push(node_map[member_key]);
    }

    Object.entries(member.clusters).forEach(([cl_id, cl_data]) => {
      const { score } = cl_data;
      const threshold = cluster_group.settings?.threshold || 0.6;
      if (score >= threshold && node_map[cl_id]) {
        links.push({
          source: cl_id,
          target: member_key,
          score,
          stroke: '#4c7787',
        });
      }
    });
  });

  const all_scores = links
    .filter((l) => typeof l.score === 'number')
    .map((l) => l.score);
  const min_score = d3.min(all_scores) ?? 0.6;
  const max_score = d3.max(all_scores) ?? 1.0;
  const distance_scale = d3
    .scalePow()
    .exponent(2.5)
    .domain([min_score, max_score])
    .range([400, 40])
    .clamp(true);

  const simulation = d3
    .forceSimulation(nodes)
    .velocityDecay(0.9)
    .force('charge', d3.forceManyBody().strength(-400))
    .force(
      'link',
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance((link) =>
          typeof link.score === 'number' ? distance_scale(link.score) : 200
        )
    )
    .force('childToParent', d3.forceManyBody().strength(0))
    .on('tick', ticked);

  let i = 0;
  const max_iter = opts.max_alpha_iterations || 100;
  while (simulation.alpha() > 0.1 && i < max_iter) {
    simulation.tick();
    i++;
  }
  simulation.alphaTarget(0).restart();
  if (debug) {
    console.log(`Pre-run after ${i} ticks, alpha=${simulation.alpha()}`);
  }

  let transform = d3.zoomIdentity;
  let pinned = false;

  const zoom_behavior = d3
    .zoom()
    .scaleExtent([0.1, 10])
    .filter((event) => {
      if (event.shiftKey) return false;
      const [mx, my] = d3.pointer(event, canvas_el);
      const [sx, sy] = transform.invert([mx, my]);
      const node = findNodeAt(sx, sy, nodes, transform.k);
      return !node;
    })
    .on('zoom', (event) => {
      transform = event.transform;
      ticked();
    });

  d3.select(canvas_el).call(zoom_behavior);

  let dragStartPos = null;
  let nodeStartPositions = new Map();
  let isDragging = false;

  const drag_behavior = d3.drag()
    .clickDistance(5)
    .subject((event) => {
      const [mx, my] = d3.pointer(event, canvas_el);
      const [sx, sy] = transform.invert([mx, my]);
      return findNodeAt(sx, sy, nodes, transform.k) || null;
    })
    .on('start', (event) => {
      const node = event.subject;
      if (!node) return;

      isDragging = true;
      hoveredNode = null;

      if (pinned) {
        node.fx = null;
        node.fy = null;
      }

      if (!event.active) simulation.alphaTarget(0.1).restart();

      const [mx, my] = d3.pointer(event, canvas_el);
      const [sx, sy] = transform.invert([mx, my]);
      dragStartPos = [sx, sy];

      if (selectedNodes.has(node)) {
        nodeStartPositions.clear();
        selectedNodes.forEach((sn) => {
          nodeStartPositions.set(sn, { x: sn.x, y: sn.y });
        });
      } else {
        nodeStartPositions.clear();
        nodeStartPositions.set(node, { x: node.x, y: node.y });
      }
    })
    .on('drag', (event) => {
      if (!dragStartPos) return;
      const [mx, my] = d3.pointer(event, canvas_el);
      const [sx, sy] = transform.invert([mx, my]);

      const dx = sx - dragStartPos[0];
      const dy = sy - dragStartPos[1];

      nodeStartPositions.forEach((startPos, n) => {
        n.fx = startPos.x + dx;
        n.fy = startPos.y + dy;
      });
    })
    .on('end', (event) => {
      const node = event.subject;
      if (!node) return;

      if (!event.active) simulation.alphaTarget(0);

      if (pinned) {
        nodeStartPositions.forEach((_, n) => {
          n.fx = n.x;
          n.fy = n.y;
        });
      } else {
        nodeStartPositions.forEach((_, n) => {
          n.fx = null;
          n.fy = null;
        });
      }

      dragStartPos = null;
      nodeStartPositions.clear();
      isDragging = false;
    });

  d3.select(canvas_el).call(drag_behavior);

  let hoveredNode = null;
  const selectedNodes = new Set();
  updateToolbarUI();

  let isSelecting = false;
  let selectionStart = null;
  let selectionEnd = null;

  function updateSelection(isShiftKey) {
    if (!selectionStart || !selectionEnd) return;
    const [x0, y0] = selectionStart;
    const [x1, y1] = selectionEnd;
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    const inBox = [];
    nodes.forEach((node) => {
      const { x, y } = node;
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        inBox.push(node);
      }
    });

    if (isShiftKey) {
      inBox.forEach((node) => selectedNodes.add(node));
    } else {
      selectedNodes.clear();
      inBox.forEach((node) => selectedNodes.add(node));
    }
  }

  d3.select(canvas_el)
    .on('mousedown', (event) => {
      if (event.shiftKey) {
        isSelecting = true;
        const [mx, my] = d3.pointer(event, canvas_el);
        selectionStart = transform.invert([mx, my]);
        selectionEnd = selectionStart;
        ticked();
      }
    })
    .on('mousemove', (event) => {
      if (isDragging) {
        return;
      }
      if (isSelecting) {
        const [mx, my] = d3.pointer(event, canvas_el);
        selectionEnd = transform.invert([mx, my]);
        ticked();
      } else {
        const [mx, my] = d3.pointer(event, canvas_el);
        const [sx, sy] = transform.invert([mx, my]);
        hoveredNode = findNodeAt(sx, sy, nodes, transform.k);
        canvas_el.style.cursor = hoveredNode ? 'pointer' : 'default';
        ticked();
      }
    })
    .on('mouseup', (event) => {
      if (isSelecting) {
        isSelecting = false;
        updateSelection(event.shiftKey);
        updateToolbarUI();
        ticked();
      }
    })
    .on('click', (event) => {

      let hover_preview_elm = document.querySelector('.popover.hover-popover > *');
      if (hover_preview_elm) {
        const mousemove_event = new MouseEvent('mousemove', {
          clientX: event.clientX + 1000,
          clientY: event.clientY + 1000,
          pageX: event.pageX + 1000,
          pageY: event.pageY + 1000,
          fromElement: event.target,
          bubbles: true,
        });
        event.target.dispatchEvent(mousemove_event);
      }

      if (isSelecting) return;
      const [mx, my] = d3.pointer(event, canvas_el);
      const [sx, sy] = transform.invert([mx, my]);
      const clickedNode = findNodeAt(sx, sy, nodes, transform.k);

      if (event.shiftKey) {
        // Multi-select mode
        if (clickedNode) {
          if (selectedNodes.has(clickedNode)) {
            selectedNodes.delete(clickedNode);
          } else {
            selectedNodes.add(clickedNode);
          }
        }
      } else {
        // Single-select mode
        selectedNodes.clear();
        if (clickedNode) {
          selectedNodes.add(clickedNode);

          // Use plugin instance reference:
          if (clickedNode.item?.path) {
            view.app.workspace.trigger('hover-link', {
              event,
              source: view.constructor.view_type,
              hoverParent: event.target,
              targetEl: event.target,
              linktext: clickedNode.item.path,
            });
          }
        }
      }
      updateToolbarUI();
      ticked();
    });

  // Utility for the main draw loop
  function ticked() {
    const w = canvas_el.width;
    const h = canvas_el.height;
    context.clearRect(0, 0, w, h);
    context.save();
    context.translate(transform.x, transform.y);
    context.scale(transform.k, transform.k);

    // Position child nodes at parent's location (or near it)
    nodes.forEach((node) => {
      if (node.type === 'center') {
        node.x = node.parent.x + node.offsetDist * Math.cos(node.offsetAngle);
        node.y = node.parent.y + node.offsetDist * Math.sin(node.offsetAngle);
        node.fx = node.x;
        node.fy = node.y;
      }
    });

    // Determine highlights
    const connectedNodes = new Set();
    const connectedLinks = new Set();
    if (hoveredNode) {
      connectedNodes.add(hoveredNode);
      links.forEach((link) => {
        if (link.source === hoveredNode || link.target === hoveredNode) {
          connectedLinks.add(link);
          connectedNodes.add(link.source);
          connectedNodes.add(link.target);
        }
      });
    }

    // Animate fade for links
    links.forEach((link) => {
      link.desiredAlpha = hoveredNode
        ? (connectedLinks.has(link) ? 1.0 : 0.05)
        : 1.0;
      link.currentAlpha = link.currentAlpha || link.desiredAlpha;
      link.currentAlpha += (link.desiredAlpha - link.currentAlpha) * 0.15;

      context.beginPath();
      context.strokeStyle = `rgba(76,119,135,${link.currentAlpha})`;
      context.lineWidth = link.currentAlpha > 0.5 ? 1.2 : 1;
      context.moveTo(link.source.x, link.source.y);
      context.lineTo(link.target.x, link.target.y);
      context.stroke();
    });

    // Animate fade for nodes
    nodes.forEach((node) => {
      node.desiredAlpha = hoveredNode
        ? (connectedNodes.has(node) ? 1.0 : 0.1)
        : 1.0;
      node.currentAlpha = node.currentAlpha || node.desiredAlpha;
      node.currentAlpha += (node.desiredAlpha - node.currentAlpha) * 0.15;

      context.beginPath();
      if (node.type === 'cluster') {
        if (transform.k < 3.0) {
          context.fillStyle = hexToRgba(node.color, node.currentAlpha);
          context.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
          context.fill();
          if (selectedNodes.has(node)) {
            context.lineWidth = 3;
            context.strokeStyle = '#ff9800';
            context.stroke();
          }
        } else {
          // Zoomed in, fade out cluster circle
          context.fillStyle = hexToRgba(node.color, 0.5);
          context.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
          context.fill();
        }
      } else if (node.type === 'center') {
        if (transform.k >= 3.0) {
          context.fillStyle = hexToRgba(node.color, node.currentAlpha);
          context.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
          context.fill();
          if (selectedNodes.has(node)) {
            context.lineWidth = 3;
            context.strokeStyle = '#ff9800';
            context.stroke();
          }
        }
      } else {
        context.fillStyle = hexToRgba(node.color, node.currentAlpha);
        context.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
        context.fill();
        if (selectedNodes.has(node)) {
          context.lineWidth = 3;
          context.strokeStyle = '#ff9800';
          context.stroke();
        }
      }
    });

    // Selection box
    if (isSelecting && selectionStart && selectionEnd) {
      context.beginPath();
      context.strokeStyle = '#009688';
      context.lineWidth = 1.5;
      const [x0, y0] = selectionStart;
      const [x1, y1] = selectionEnd;
      context.rect(x0, y0, x1 - x0, y1 - y0);
      context.stroke();
    }

    // Show label for hovered node
    if (hoveredNode) {
      context.beginPath();
      context.fillStyle = '#ccc';
      context.font = '10px sans-serif';
      context.textAlign = 'center';
      let labelText = hoveredNode.id;
      if (hoveredNode.type === 'cluster') {
        labelText = getLastSegmentWithoutExtension(hoveredNode.cluster?.name) || hoveredNode.id;
      } else if (hoveredNode.type === 'member') {
        labelText = getLastSegmentWithoutExtension(hoveredNode.item?.key) || hoveredNode.id;
      } else if (hoveredNode.type === 'center') {
        labelText = getLastSegmentWithoutExtension(hoveredNode.id) || hoveredNode.id;
      }
      context.fillText(
        labelText,
        hoveredNode.x,
        hoveredNode.y - hoveredNode.radius - 4
      );
    }

    context.restore();
  }

  // Utility to apply alpha to a hex color
  function hexToRgba(hex, alpha = 1) {
    if (!/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(hex)) {
      return `rgba(0,0,0,${alpha})`;
    }
    hex = hex.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((ch) => ch + ch).join('');
    }
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // --- Pin button ---
  pinBtn?.addEventListener('click', () => {
    pinned = !pinned;
  
    const pinIcon = pinBtn.querySelector('.sc-icon-pin');
    const pinOffIcon = pinBtn.querySelector('.sc-icon-pin-off');
  
    if (pinned) {
      simulation.alpha(0).alphaTarget(0);
      nodes.forEach((n) => {
        n.fx = n.x;
        n.fy = n.y;
        n.vx = 0;
        n.vy = 0;
      });
      // Switch icon visibility
      pinIcon.style.display = 'none';
      pinOffIcon.style.display = 'inline';
    } else {
      nodes.forEach((n) => {
        n.fx = null;
        n.fy = null;
        n.vx = 0;
        n.vy = 0;
      });
      simulation.alpha(0.8).restart();
      // Switch icon visibility back
      pinIcon.style.display = 'inline';
      pinOffIcon.style.display = 'none';
    }
  });

  // --- Create cluster ---
  createClusterBtn?.addEventListener('click', async () => {
    if (debug) console.log('Create new cluster from selection');
    const center = Array.from(selectedNodes.values()).reduce((acc, node) => {
      acc[node.item.key] = { weight: 1 };
      return acc;
    }, {});

    const cluster = await cluster_group.env.clusters.create_or_update({ center });
    await cluster_group.add_cluster(cluster);
    view.render_view();
  });

  // Add to cluster center
  addToClusterCenterBtn?.addEventListener('click', async () => {
    if (debug) console.log('Move node(s) to cluster center');
    const { items, cluster } = Array.from(selectedNodes.values()).reduce(
      (acc, node) => {
        if (node.type === 'member') {
          acc.items.push(node.item);
        } else if (node.type === 'cluster') {
          acc.cluster = node.cluster;
        }
        return acc;
      },
      { items: [], cluster: null }
    );

    if (debug) console.log('items:', items);
    await cluster.add_centers(items);
    view.render_view();
  });

  // Remove from cluster center
  removeFromClusterCenterBtn?.addEventListener('click', async () => {
    if (debug) console.log('Remove node(s) from cluster center');
    const nodesArr = Array.from(selectedNodes.values());
    if (!nodesArr.length) return;

    const parentNode = nodesArr[0].parent;
    const parentCluster = parentNode?.cluster;
    if (!parentCluster) {
      console.warn('No parent cluster found for the selected nodes!');
      return;
    }

    const centerItems = nodesArr.map((node) => node.item);
    await parentCluster.remove_centers(centerItems);
    view.render_view();
  });

  // Remove entire cluster
  removeClusterBtn?.addEventListener('click', async () => {
    if (debug) console.log('Remove node(s) from cluster(s)');
    const clArr = Array.from(selectedNodes.values()).map((node) => node.cluster);
    if (debug) console.log('clusters removed:', clArr);
    await cluster_group.remove_clusters(clArr);
    view.render_view();
  });

  // Ungroup from cluster
  removeFromClusterBtn?.addEventListener('click', async (e) => {
    if (debug) console.log('Ungroup selected node(s) from cluster');
    const { items, cluster } = Array.from(selectedNodes.values()).reduce(
      (acc, node) => {
        if (node.type === 'member') {
          acc.items.push(node.item);
        } else if (node.type === 'cluster') {
          acc.cluster = node.cluster;
        }
        return acc;
      },
      { items: [], cluster: null }
    );
    await cluster.remove_members(items);
    view.render_view();
  });

  return await post_process.call(this, view, frag, opts);
}

/**
 * Post-process function: binds refresh/help buttons, etc.
 * @param {Object} view
 * @param {HTMLElement} frag
 * @param {Object} [opts]
 * @returns {Promise<HTMLElement>}
 */
export async function post_process(view, frag, opts = {}) {
  const refresh_btn = frag.querySelector('.sc-refresh');
  if (refresh_btn) {
    refresh_btn.addEventListener('click', () => {
      view.render_view();
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