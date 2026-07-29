---
status: implemented
date: 2026-05-28
---

# Poster placeholder

Poster placeholders provide a low-resolution or first-frame visual while the final poster loads. Current props, attributes, and CSS names belong to source and API reference.

## Decisions

- Keep placeholder behavior on the poster component instead of introducing another public component with overlapping lifecycle and accessibility.
- Render placeholder and final poster as separate visual layers so the final image can crossfade without replacing the whole component.
- Let a consumer supply the placeholder directly; extraction of a first frame or image transformation is outside the UI component.
- Expose presentation through CSS custom properties so skins can align sizing, position, filtering, and transition behavior across both layers.
- Keep the placeholder decorative. The poster component owns any meaningful accessible name, preventing duplicate image announcements.

## Consequences

The same concept works in React and HTML and remains skinnable without a JavaScript animation API. Consumers are responsible for choosing a safe placeholder URL and for any media-frame generation policy.

> **Note 2026-07-29 — the placeholder stays consumer-supplied; the poster no
> longer has to be.** `content-poster` on the provider means the *poster* URL can
> now come from the store, while "let a consumer supply the placeholder directly"
> above is unchanged: the placeholder is a genuinely different image and a
> different concept, not a low-resolution variant the player can derive.
>
> A store-backed placeholder (`contentPlaceholder`) is plausible future work and
> deliberately not designed here. Whoever picks it up will hit this record's
> first decision as a real tension and should read the blur-up implementation
> first — the CSS custom property plus React's `loadedSrc` crossfade tracking.
>
> "Keep the placeholder decorative" also still holds, and is now load-bearing in
> a second way: the poster owns the accessible name, and that name comes from
> `content-poster-alt` when the author does not supply one.

## Current sources of truth

- React implementation: `packages/react/src/ui/poster/poster.tsx`
- HTML implementation: `packages/html/src/ui/poster/poster-element.ts`
- Poster design context: [Poster](poster.md)
- Public API reference and package exports
