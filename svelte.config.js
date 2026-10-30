import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
    runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
  },
  kit: {
    adapter: adapter({ runtime: 'nodejs22.x' }),
    alias: { $extensions: 'src/extensions' },
    csp: {
      // 'auto': nonces for server-rendered pages (response header), hashes for prerendered ones (meta tag).
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        // 'unsafe-inline' is required for style="..." attributes (user-chosen colours, e.g.
        // `style="background-color: {color}"`), which CSP nonces/hashes cannot cover. Script
        // execution stays locked down by script-src.
        'style-src': ['self', 'unsafe-inline'],
        // Type icons and avatars are generated locally as data: SVG URIs.
        'img-src': ['self', 'data:'],
        'font-src': ['self'],
        'connect-src': ['self'],
        'object-src': ['none'],
        'frame-ancestors': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
      },
    },
  },
  preprocess: [mdsvex({ extensions: ['.svx', '.md'] })],
  extensions: ['.svelte', '.svx', '.md'],
};

export default config;
