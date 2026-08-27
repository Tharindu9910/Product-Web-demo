/**
 * Inline <svg> inner-markup for module/service icons, keyed by display
 * name — shared between Platform.astro (tile icons) and Industry.astro
 * (recommended-stack icons), which both draw from the same icon set in
 * legacy/index.html. Three industry-only stack items (Purchasing, Sales
 * Orders, CRM & Loyalty) have no modules.json entry — see the step 4
 * mistake log — so this is keyed by name, not module id, to cover both.
 * Hardcoded here rather than in content.config.ts, same precedent as
 * Nav/Footer's icons and flow-stages' per-node icon.
 */
export const moduleIcon: Record<string, string> = {
  Inventory: '<rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M3 7l2-4h14l2 4M9.5 12h5"/>',
  Logistics:
    '<rect x="2.5" y="9" width="11" height="8" rx="1"/><path d="M13.5 12h3.5l3.5 3v2h-1.5M13.5 17H16"/><circle cx="8" cy="18.5" r="1.6"/><circle cx="17.5" cy="18.5" r="1.6"/>',
  "Integrated Finance": '<path d="M3 9.5L12 4l9 5.5"/><path d="M5.5 10v8M10 10v8M14 10v8M18.5 10v8M3 20h18"/>',
  Payroll: '<rect x="2" y="6" width="16" height="10" rx="1.5"/><circle cx="10" cy="11" r="2.5"/><path d="M22 9v9a1 1 0 0 1-1 1H6"/>',
  "POS System": '<rect x="3" y="10" width="18" height="10" rx="1.5"/><path d="M6 10V5h12v5M8.5 14.5h7"/>',
  "Custom Modules":
    '<path d="M10 4.5a2 2 0 1 1 4 0V6h4a1 1 0 0 1 1 1v4h1.2a2 2 0 1 1 0 4H19v4a1 1 0 0 1-1 1h-4v-1.2a2 2 0 1 0-4 0V20H6a1 1 0 0 1-1-1v-4h1.2a2 2 0 1 0 0-4H5V7a1 1 0 0 1 1-1h4z"/>',
  Accounting: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7.5h8M8 12h2M14 12h2M8 16.5h2M14 16.5h2"/>',
  "Web Development": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M6.5 6.5h.01M9.5 6.5h.01"/>',
  "Digital Marketing": '<path d="M4 10v4a1 1 0 0 0 1 1h3l5 4V5L8 9H5a1 1 0 0 0-1 1z"/><path d="M17 9.5a4 4 0 0 1 0 5"/>',
  "Web Hosting": '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  "Content Writing":
    '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/><path d="M9 9h4M9 13h3"/><path d="M20.4 3.6a1.7 1.7 0 0 1 0 2.4L16 10.4l-2.6.6.6-2.6 4.4-4.4a1.7 1.7 0 0 1 2 0z"/>',
  // industry-only stack items — no modules.json entry (mistake log 2026-08-23)
  "CRM & Loyalty":
    '<circle cx="9" cy="8" r="3"/><path d="M3.5 19.5c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6"/><path d="M17 8h4M17 12h4M17 16h2.5"/>',
  "Sales Orders":
    '<rect x="5" y="4" width="14" height="17" rx="1.5"/><path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1z"/><path d="M8.5 11.5L10 13l3.5-3.5M8.5 16h7"/>',
  Purchasing:
    '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.3h8.6a1.5 1.5 0 0 0 1.5-1.2L20.5 8H6"/>',
};
