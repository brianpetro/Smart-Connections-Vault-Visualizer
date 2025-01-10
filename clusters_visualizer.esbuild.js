// should build clusters_visualizer.js into clusters_visualizer.dist.js using esbuild

/**
 * @file clusters_visualizer.esbuild.js
 * @description Bundles clusters_visualizer.js (and any D3 usage) into a single .dist.js file via esbuild.
 *
 * Example usage:
 *   node clusters_visualizer.esbuild.js
 */

import esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['./clusters_visualizer.js'],
  outfile: './dist/clusters_visualizer.js',
  bundle: true,
  format: 'esm',   // or 'iife' if you prefer
  platform: 'node',
  sourcemap: true,
  external: ['obsidian'], 
  // ^ if you want to load d3 from a CDN or external script. 
  //   Otherwise remove from external and `npm install d3` to bundle it fully.

  // watch: true, // if you want watch mode
}).then(() => {
  console.log('clusters_visualizer build success');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
