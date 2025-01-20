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
         <button class="sc-pin" aria-label="Pin network">
            ${this.get_icon_html?.('pin') || 'Hi'}
          </button>
         <button class="sc-create-cluster" aria-label="Create new cluster from selection">
            ${this.get_icon_html?.('group') || 'group'}
          </button>
          <button class="sc-remove-cluster" aria-label="Remove node(s) from cluster(s) and recluster">
            ${this.get_icon_html?.('ungroup') || 'ungroup'}
          </button>
          <button class="sc-add-to-cluster" aria-label="Merge node(s) to cluster">
            ${this.get_icon_html?.('combine') || 'combine'}
          </button>
          <button class="sc-add-to-cluster-center" aria-label="Move node(s) to cluster center">
            ${this.get_icon_html?.('badge-plus') || 'plus'}
          </button>
          <button class="sc-remove-cluster-center" aria-label="Remove node(s) from cluster center">
            ${this.get_icon_html?.('badge-minus') || 'minus'}
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
      <canvas class="clusters-visualizer-canvas" width="1000px" height="1000px" 
              style="border:1px solid #333; display:block;">
      </canvas>
      </div>
    </div>
  `;
}

// HELPER: find node at the given simulation coords (sx, sy) within radius
function findNodeAt(sx, sy, nodes) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const dx = sx - node.x;
    const dy = sy - node.y;
    if (dx * dx + dy * dy <= node.radius * node.radius) {
      return node;
    }
  }
  return null;
}

function updateSelection(isShiftKey) {
  if (!selectionStart || !selectionEnd) return;

  const [x0, y0] = selectionStart;
  const [x1, y1] = selectionEnd;
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  // Gather the nodes in the box
  const inBox = [];
  nodes.forEach((node) => {
    const { x, y } = node;
    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
      inBox.push(node);
    }
  });

  // If SHIFT is pressed, add them to existing selection:
  if (isShiftKey) {
    inBox.forEach((node) => selectedNodes.add(node));
  } else {
    selectedNodes.clear();
    inBox.forEach((node) => selectedNodes.add(node));
  }
}

export async function render(cluster_groups, opts = {}) {
  const debug = !!opts.debug;
  if (debug) console.log('render() called with:', cluster_groups);

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

  // Build top-level HTML with <canvas> + toolbar
  const html = await build_html.call(this, cluster_groups, opts);
  const frag = this.create_doc_fragment(html);

  // Grab the canvas context
  const canvas_el = frag.querySelector('.clusters-visualizer-canvas');
  if (!canvas_el) {
    if (debug) console.warn('No <canvas> element found!');
    return frag;
  }
  const context = canvas_el.getContext('2d');
  const width = canvas_el.width || 800;
  const height = canvas_el.height || 600;

  // Grab the "pin" button
  const pinBtn = frag.querySelector('.sc-pin');
  const createClusterBtn = frag.querySelector('.sc-create-cluster');
  const addToClusterBtn = frag.querySelector('.sc-add-to-cluster');
  const addToClusterCenterBtn = frag.querySelector('.sc-add-to-cluster-center');
  const removeFromClusterCenterBtn = frag.querySelector('.sc-remove-cluster-center');
  const removeClusterBtn = frag.querySelector('.sc-remove-cluster');

  // Build node & link arrays
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
      cluster,
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
        source: member.item,
      };
      nodes.push(node_map[member_key]);
    }
    Object.entries(member.clusters).forEach(([cl_id, cl_data]) => {
      const { score } = cl_data;
      if (score >= 0.6 && node_map[cl_id]) {
        links.push({
          source: cl_id,
          target: member_key,
          score,
          stroke: '#4c7787',
        });
      }
    });
  });

  // Distance scaling
  const all_scores = links
    .filter((l) => typeof l.score === 'number')
    .map((l) => l.score);
  const min_score = d3.min(all_scores) ?? 0.6;
  const max_score = d3.max(all_scores) ?? 1.0;
  const distance_scale = d3
    .scaleLinear()
    .domain([min_score, max_score])
    .range([220, 80])
    .clamp(true);

  // Build the simulation
  const charge_strength = nodes.length > 200 ? -60 : -100;
  const simulation = d3
    .forceSimulation(nodes)
    .force('charge', d3.forceManyBody().strength(charge_strength))
    .force(
      'link',
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance((link) =>
          typeof link.score === 'number' ? distance_scale(link.score) : 200
        )
    )
    .on('tick', ticked);

  // Pre-run to stabilize
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

  // We'll keep track of current transform for panning/zoom
  let transform = d3.zoomIdentity;

  // --- PINNED STATE ---
  let pinned = false; // track whether the network is pinned

  // --- ZOOM Behavior ---
  const zoom_behavior = d3
    .zoom()
    .scaleExtent([0.1, 10])
    .filter((event) => {
      // Allow zooming/panning only when Shift key is not pressed
      if (event.shiftKey) return false;
  
      // If pointer is over a node, skip zoom
      const [mx, my] = d3.pointer(event, canvas_el);
      const [sx, sy] = transform.invert([mx, my]);
      const node = findNodeAt(sx, sy, nodes);
      return !node;
    })
    .on('zoom', (event) => {
      transform = event.transform;
      ticked(); // re-draw
    });

  d3.select(canvas_el).call(zoom_behavior);

  // Keep some state for dragging
  let dragStartPos = null;  // The [x,y] of the pointer at drag start
  let nodeStartPositions = new Map(); 
  // nodeStartPositions will map each *selected* node -> { x, y }

  const drag_behavior = d3.drag()
  .subject((event) => {
    // The node that was clicked, if any
    const [mx, my] = d3.pointer(event, canvas_el);
    const [sx, sy] = transform.invert([mx, my]);
    return findNodeAt(sx, sy, nodes) || null;
  })
  .on('start', (event) => {
    const node = event.subject;
    if (!node) return;

    // "Unfix" just in case pinned is on
    if (pinned) {
      node.fx = null;
      node.fy = null;
    }

    // Standard reheat for dragging
    if (!event.active) simulation.alphaTarget(0.3).restart();

    // Store the initial pointer position
    dragStartPos = [event.x, event.y];

    // If the *clicked* node is in the selection, prepare to move them all
    // Otherwise, we might drag only this node.
    if (selectedNodes.has(node)) {
      // For each selected node, remember its (x, y) at drag-start
      nodeStartPositions.clear();
      selectedNodes.forEach((sn) => {
        nodeStartPositions.set(sn, { x: sn.x, y: sn.y });
      });
    } else {
      // Single node drag fallback:
      nodeStartPositions.clear();
      nodeStartPositions.set(node, { x: node.x, y: node.y });
    }
  })
  .on('drag', (event) => {
    // If there's no reference pointer, do nothing
    if (!dragStartPos) return;

    // How far has the pointer moved since drag start?
    const dx = event.x - dragStartPos[0];
    const dy = event.y - dragStartPos[1];

    // Move every node that was stored in nodeStartPositions
    nodeStartPositions.forEach((startPos, n) => {
      // For a standard D3 force-sim, setting fx/fy positions the node.
      n.fx = startPos.x + dx;
      n.fy = startPos.y + dy;
    });
  })
  .on('end', (event) => {
    const node = event.subject;
    if (!node) return;

    // Reset alpha to finish
    if (!event.active) simulation.alphaTarget(0);

    // If pinned, fix final positions. Otherwise release them
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

    // Cleanup
    dragStartPos = null;
    nodeStartPositions.clear();
  });


  d3.select(canvas_el).call(drag_behavior);

  // For hover state
  let hoveredNode = null;

  // For selection (if you have that from previous snippet)
  const selectedNodes = new Set();

  let isSelecting = false;
  let selectionStart = null;
  let selectionEnd = null;

  d3.select(canvas_el)
  .on('mousedown', (event) => {
    if (event.shiftKey) {
      isSelecting = true;
      const [mx, my] = d3.pointer(event, canvas_el);
      selectionStart = transform.invert([mx, my]);
      selectionEnd = selectionStart;
      ticked(); // Redraw to show the selection box
    }
  })
    .on('mousemove', (event) => {

      if (isSelecting) {
        const [mx, my] = d3.pointer(event, canvas_el);
        selectionEnd = transform.invert([mx, my]);
        ticked(); // Redraw to update the selection box
      } else {
        const [mx, my] = d3.pointer(event, canvas_el);
        const [sx, sy] = transform.invert([mx, my]);
        hoveredNode = findNodeAt(sx, sy, nodes);
        canvas_el.style.cursor = hoveredNode ? 'pointer' : 'default';
        ticked();
      }
     
    })
    .on('mouseup',(event) => {
      if (isSelecting) {
        isSelecting = false;
        updateSelection(event.shiftKey); // pass shift info
        ticked(); // Redraw to reflect selected nodes
      }
    })
    .on('click', (event) => {
      if (isSelecting) return; // or check a "didBoxSelect" boolean 

      const [mx, my] = d3.pointer(event, canvas_el);
    const [sx, sy] = transform.invert([mx, my]);
    const clickedNode = findNodeAt(sx, sy, nodes);

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
      }
    }
    ticked(); // Redraw to reflect selection changes
  });

  function updateSelection() {
  if (!selectionStart || !selectionEnd) return;

  const [x0, y0] = selectionStart;
  const [x1, y1] = selectionEnd;

  // Ensure we treat x0,y0 as the "top-left" and x1,y1 as the "bottom-right"
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  // If you do *not* want to allow multi-select with bounding box by default:
  // selectedNodes.clear();
  //
  // Or if you *do* want SHIFT+Drag to add to existing selection, handle that logic here.
  // E.g. if (multiSelectMode) { do union } else { new selection }.
  // For simplicity, let's do a "fresh" selection each time:

  selectedNodes.clear();

  // Check each node
  nodes.forEach((node) => {
    const { x, y } = node;
    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
      selectedNodes.add(node);
    }
  });
}

   // --- PIN BUTTON CLICK HANDLER ---
   pinBtn?.addEventListener('click', () => {
    pinned = !pinned;
  
    if (pinned) {
      // Instead of simulation.stop():
      simulation.alpha(0).alphaTarget(0);
      // fix all nodes:
      nodes.forEach((n) => {
        n.fx = n.x;
        n.fy = n.y;
        // zero out velocity so they don’t keep drifting
        n.vx = 0;
        n.vy = 0;
      });
      pinBtn.innerHTML = this.get_icon_html?.('pin-off') ?? 'pin-off';
    } else {
      // Unpin:
      nodes.forEach((n) => {
        n.fx = null;
        n.fy = null;
        n.vx = 0;
        n.vy = 0;
      });
      // "Reheat" the simulation
      simulation.alpha(0.8).restart();
      pinBtn.innerHTML = this.get_icon_html?.('pin') ?? 'pin';
    }
  });

  createClusterBtn?.addEventListener('click', () => {
    console.log('Create new cluster from selection.  Available when any node(s) selected - can be nodes from different clusters and orphans - 2 step process - 2nd step is to select which node(s) to be center of new cluster');
  });

  addToClusterBtn?.addEventListener('click', () => {
    console.log('Move node(s) to cluster.  Available when any node(s) selected - can be nodes from different clusters and orphans - 2 step process - 2nd step is to select which cluster to add node(s) to');
  });

  addToClusterCenterBtn?.addEventListener('click', () => {
    console.log('Move node(s) to cluster center. Available only for nodes that are selected + in the same cluster + not in center, unless node(s) drag and dropped into center');
  });

  removeFromClusterCenterBtn?.addEventListener('click', () => {
    console.log('Remove node(s) from cluster center. Available only for nodes that are selected + in cluster center - still keeps them in their respective cluster');
  });

  removeClusterBtn?.addEventListener('click', () => {
    console.log('Remove node(s) from cluster(s) and recluster. Available when any node(s) are selected + in cluster(s) - get prev snapshot on rerender to show were reclustered in UI ');
  });


  function ticked() {
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(transform.x, transform.y);
    context.scale(transform.k, transform.k);

    // Draw links
    links.forEach((link) => {
      context.beginPath();
      context.strokeStyle = link.stroke || '#ccc';
      context.lineWidth = 1.2;
      context.moveTo(link.source.x, link.source.y);
      context.lineTo(link.target.x, link.target.y);
      context.stroke();
    });

    // Draw nodes
    nodes.forEach((node) => {
      context.beginPath();
      context.fillStyle = node.color;
      context.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
      context.fill();

      // If you have multi-select or single selection:
      if (selectedNodes.has(node)) {
        context.lineWidth = 3;
        context.strokeStyle = '#ff9800'; // highlight color
        context.stroke();
      }
    });

     // Draw selection box
      if (isSelecting && selectionStart && selectionEnd) {
        context.beginPath();
        context.strokeStyle = '#009688'; // Selection box color
        context.lineWidth = 1.5;
        const [x0, y0] = selectionStart;
        const [x1, y1] = selectionEnd;
        context.rect(x0, y0, x1 - x0, y1 - y0);
        context.stroke();
      }


    // Hover label
    if (hoveredNode) {
      context.beginPath();
      context.fillStyle = '#ccc';
      context.font = '10px sans-serif';
      context.textAlign = 'center';
      let labelText = hoveredNode.id;
      if (hoveredNode.type === 'cluster') {
        labelText = hoveredNode.cluster?.data?.key || hoveredNode.id;
      } else if (hoveredNode.type === 'member') {
        labelText = hoveredNode.source?.data?.key || hoveredNode.id;
      }
      context.fillText(
        labelText,
        hoveredNode.x,
        hoveredNode.y - hoveredNode.radius - 4
      );
    }

    context.restore();
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
