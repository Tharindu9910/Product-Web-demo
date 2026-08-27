// GitHub Pages serves this site from a repo subpath (/Product-Web-demo/),
// not the domain root, so every root-absolute link/asset path needs the
// configured `base` prefixed on. Normalize both sides of the join so this
// doesn't silently break if `base` in astro.config.mjs ever loses its
// trailing slash.
export const withBase = (path: string) =>
  import.meta.env.BASE_URL.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
