import type { ImageMetadata } from "astro";

/**
 * Content-collection JSON (modules/industries/clients) stores image paths
 * as plain strings — "/assets/card/Inventory.jpg" — because Zod schemas
 * over the `file()` loader can't hold a static import, and step 1b moved
 * every real image into src/assets/ (there's no public/assets/ to serve
 * those paths from directly; a bare <img src="/assets/..."> 404s). This
 * globs every src/assets/ file at build time and keys it back to that same
 * "/assets/..." string, so components can do `assetMap[data.photo]` and
 * pass the result through astro:assets like any other imported image.
 */
const files = import.meta.glob<{ default: ImageMetadata }>("/src/assets/**/*.{jpg,jpeg,png}", { eager: true });

export const assetMap: Record<string, ImageMetadata> = Object.fromEntries(
  Object.entries(files).map(([path, mod]) => [path.replace(/^\/src/, ""), mod.default]),
);
