import { defineCollection, z } from "astro:content";
import { file } from "astro/loaders";

/**
 * All site copy lives here, not in components.
 * One edit to modules.json updates the platform grid, the module page,
 * the nav and the footer at once.
 *
 * Each collection is a single JSON file: src/content/data/<name>.json
 * containing an array of objects with an `id` field.
 */

const modules = defineCollection({
  loader: file("src/content/data/modules.json"),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(["erp-module", "service"]),
    core: z.boolean().default(false),
    order: z.number(),
    blurb: z.string().max(140), // one line per card — enforced, not suggested
    photo: z.string(),
    href: z.string().optional(), // only modules with their own page
    /** Platform explorer detail panel (step 7) — only the non-core modules
     * expand into one, so both are absent on inventory/logistics. */
    panelText: z.string().optional(),
    benefits: z.array(z.string()).length(5).optional(),
  }),
});

const industries = defineCollection({
  loader: file("src/content/data/industries.json"),
  schema: z.object({
    id: z.string(),
    name: z.string(), // tab label, e.g. "Distribution"
    order: z.number(),
    image: z.string(), // .ind-panel-art source
    stack: z.array(z.string()), // "Recommended stack" — display names, not
    // all of them are entries in modules.json (CRM & Loyalty, Sales Orders,
    // Purchasing appear only here), so this stays plain strings, not ids.
    changes: z.array(z.string()), // "What changes" bullets
    /** "Who already runs this" — omitted (not []) means the section renders
     * a Slot.astro PENDING placeholder instead of a client list (rule 7). */
    clients: z.array(z.object({ name: z.string(), place: z.string() })).optional(),
    cta: z.string(), // e.g. "SEE A RESTAURANT DEMO"
  }),
});

const painPoints = defineCollection({
  loader: file("src/content/data/pain-points.json"),
  schema: z.object({
    id: z.string(),
    order: z.number(),
    title: z.string(),
    items: z.array(z.string()), // .pain-list bullets — legacy has no card-level body copy
  }),
});

const flowStages = defineCollection({
  loader: file("src/content/data/flow-stages.json"),
  schema: z.object({
    id: z.string(),
    order: z.number().min(1).max(8),
    stage: z.string(), // .flow-node-label — legacy's flow diagram has nothing
    // else per node (no whatHappens/whatStops/recordId copy anywhere in the
    // source); the per-node icon is bespoke SVG, hardcoded in the component
    // that renders it, same as Nav/Footer's icons.
  }),
});

const clients = defineCollection({
  loader: file("src/content/data/clients.json"),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    /** Only stated for clients that also appear in an industry panel's
     * "who already runs this" list (e.g. Chicking, restaurant → Maldives).
     * Legacy's trust marquee itself carries no per-logo country. */
    country: z.string().optional(),
    logo: z.string(),
  }),
});

const faqs = defineCollection({
  loader: file("src/content/data/faqs.json"),
  schema: z.object({
    id: z.string(),
    page: z.enum(["home", "why-us", "inventory", "logistics", "contact"]),
    order: z.number(),
    question: z.string(),
    answer: z.string(),
  }),
});

const testimonials = defineCollection({
  loader: file("src/content/data/testimonials.json"),
  schema: z.object({
    id: z.string(),
    quote: z.string(),
    author: z.string(),
    role: z.string(),
    company: z.string(),
    /** Anything not 'client-approved' must not render in production. */
    status: z.enum(["placeholder", "client-approved"]).default("placeholder"),
  }),
});

export const collections = {
  modules,
  industries,
  painPoints,
  flowStages,
  clients,
  faqs,
  testimonials,
};
