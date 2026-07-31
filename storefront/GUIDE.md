# Responsive Sass system

This storefront uses a compact, orientation-aware Sass API with deterministic
cascade layers and automatic style discovery.

## Daily workflow

```bash
pnpm dev
```

Development performs one style sync before Next.js starts. The watcher then
reacts only when a `.scss` or `.css` file is added, removed, or renamed. Normal
content edits are already handled by Next/Sass and do not regenerate the style
manifest.

```bash
pnpm build
```

Production performs the same one-shot sync before building. The generated CSS
imports are not disabled by an environment variable: only the continuous
watcher is development-only. This keeps local and production style graphs
identical.

Run a manual, idempotent sync at any time:

```bash
pnpm sync:styles
```

## Concise syntax

Every non-system SCSS file receives `_shortcuts.scss` automatically.

```scss
.card {
  @include hb((
    xxs: (padding: 1rem, gap: 0.75rem),
    md:  (padding: 1.5rem, gap: 1rem),
    lg:  (padding: 2rem)
  ));

  @include vb((
    xs: (padding: 1rem),
    s:  (padding: 1.25rem),
    md: (padding: 1.5rem)
  ));

  @include h(lg) {
    grid-template-columns: 2fr 1fr;
  }

  @include v(md) {
    grid-template-columns: 1fr;
  }

  @include font(SBody);
}
```

Available shortcuts:

- `h(key)` and `v(key)` for one responsive block.
- `hb(map)` and `vb(map)` for several breakpoints in a compact declaration.
- `font(token)` for the responsive typography scale.
- Compatibility helpers such as `h-layer`, `v-layer`, `h-block`, `v-block`,
  `xxs-h`, `md-h`, and `s-v` remain available.

## Viewport rules

Landscape breakpoints:

| Key | Minimum width | Extra constraint |
| --- | ---: | --- |
| `xxs` | 400px | — |
| `xs` | 750px | — |
| `sm` | 900px | — |
| `smt` | 900px | max-width 1399.98px, min-height 720px |
| `md` | 1200px | — |
| `mdt` | 1300px | max-width 1399.98px, min-height 950px |
| `lg` | 1400px | — |
| `xl` | 1500px | — |
| `huge` | 1730px | — |

Portrait breakpoints are `xs: 320px`, `sm: 380px`, `s: 400px`, `md: 600px`,
and `lg: 1000px`.

All queries are min-width and orientation-specific. Named cascade layers keep
larger breakpoint rules predictable even when component files are compiled in
a different order.

## Automatic file handling

`scripts/sync-styles.js`:

1. Discovers all non-system `.scss` and `.css` files in a stable sorted order.
2. Adds or repairs the relative `_shortcuts.scss` import in every SCSS file.
3. Writes `src/styles/_generated-styles.scss` with stable path-based aliases.
4. Keeps one fixed generated entry in `globals.scss`.
5. Writes only when output changed and uses atomic replacement for generated
   files.

Moving an SCSS file to a different directory therefore repairs its shortcut
path automatically. Adding, deleting, or renaming a file updates the manifest.
If TypeScript imports a CSS Module by filename, that TypeScript import still
needs to be updated by the IDE or refactor tool.

Do not edit `_generated-styles.scss` directly.

## System files

- `_breakpoints.scss`: horizontal and vertical breakpoint configuration.
- `_mixins.scss`: side-effect-free query and layer mixins.
- `_layers.scss`: emits global layer order once.
- `_typography.scss`: responsive typography tokens and `font`.
- `_shortcuts.scss`: compact API injected into component styles.
- `_helpers.scss`: global helper CSS emitted once from `globals.scss`.
- `index.scss`: public, side-effect-free system API.

The old implementation nested every named layer inside another layer with the
same name. The browser accepted that as a sublayer, but it produced paths such
as `vp-s.vp-s` and repeated CSS in component builds. The system now owns the
layer in one place while preserving the original top-level order and media
queries. The rationale is also documented beside the mixins to prevent the
duplicate nesting from being reintroduced accidentally.
