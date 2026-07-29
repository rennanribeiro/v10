---
status: implemented
date: 2025-02-05
---

# Poster

Display component for video poster image. Shows before playback starts, hides after.

## Problem

Video players show a poster image before playback. Existing solutions (Media Chrome, Vidstack) either manage the image internally via `src` prop or expose complex state (`data-loading`, `data-error`, `data-hidden`, `data-visible`).

We want a simpler approach: expose minimal state (`data-visible`), let the user control the image.

## Solution

**HTML:** Wrapper element that accepts `<img>` as child.
**React:** Renders `<img>` directly — no wrapper needed.

Visibility: `visible = !playback.started`. The poster shows until playback starts. `started` persists — pausing doesn't reset it.

## Accessibility

**Wrapper (`<media-poster>`):** No ARIA role needed. Custom elements have no implicit role, so there's no semantics to hide or override. Do not add `aria-hidden` — the poster image may be informative.

**Child (`<img>`):** User provides appropriate `alt` text. Whether a poster is informative or decorative is the author's judgment (per [WAI guidelines](https://www.w3.org/WAI/tutorials/images/decorative/)). This is an advantage over Media Chrome (which forces `aria-hidden="true"` on the internal image) and native `<video poster>` (which has no `alt` equivalent).

## Alternatives Considered

### Raw state attributes (`data-started`, `data-ended`)

Expose underlying state, let users compose visibility in CSS.

**Why not:** Requires users to understand the state model. `data-started` on a poster doesn't make sense in the component's local context — `data-visible` directly describes the poster's state. Consistent with how button components use context-appropriate names (`data-fullscreen`, `data-muted`) rather than raw feature state.

### Component-managed image (`src` prop)

Like Media Chrome — component owns the `<img>` internally.

**Why not:** Limits user control. Can't use `srcset`, `loading="lazy"`, `<picture>`, or framework-specific optimized image components (Next.js `<Image>`, Astro `<Image>`). Media Chrome acknowledges this tradeoff in their docs.

Our approach makes the flexible path the default.

> **Amended 2026-07-29 — the poster URL can come from the store.** With
> `content-poster` settable on the provider, the poster reaches the screen by
> **filling in, not taking over**, so the reasoning above still holds. React's
> `<Poster>` reads the resolved value only when given no `src`; HTML's
> `<media-poster>` fills an empty `src` on the image the author supplied and never
> creates one. `srcset`, `loading`, `<picture>`, and framework image components
> all keep working, and a local `src` short-circuits the store entirely.
>
> A local `src` is therefore not a fourth precedence tier — the component only
> decides *whether to ask*. See
> [content-metadata.md](/internal/decisions/media/content-metadata.md).
>
> **The platform asymmetry is deliberate.** React's component owns its image;
> HTML's element is a wrapper around yours. User-visible behaviour is identical
> and each side follows its platform's grain. Giving `<media-poster>` a shadow
> root with an owned image is the only shape where zero author markup works, but
> it was rejected: it adds a shadow root to an element family that deliberately
> has none, needs part-based styling for the fallback, and needs manual slot
> assignment, since native fallback content is suppressed when an empty slot
> element is itself the assigned content. Default skins get zero-markup behaviour
> instead by putting a fallback `<img>` inside their own poster slot.
>
> **`alt` is decided by presence, never emptiness.** An author writing `alt=""` is
> deliberately marking the image decorative — which is what this record's
> accessibility section already says is the author's judgment — so the element
> fills a *missing* `alt` and never an empty one. The store supplies it via
> `content-poster-alt`, whose library default is the empty string: decorative
> rather than an image with no accessible name.

## Future

1. **`data-ended`** — Show poster when media ends.
2. **`data-loaded`** — Set when child image loads, enabling CSS-only placeholder-to-main transitions.
3. **Transition/animation support** — CSS transition recommendations for fade in/out.
