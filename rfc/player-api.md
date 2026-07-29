---
status: implemented
---

# Player API

This RFC records the decisions that shaped the Video.js 10 player API. It is historical context, not API documentation. Current contracts live in package source, exports, tests, and generated reference pages.

## Problem

The initial direction treated use-case presets such as “website video” as the primary abstraction. That made the common case verbose, hid which capabilities were present, coupled player behavior to skin and media choices, and encouraged users to select one opaque bundle instead of composing the capabilities they needed.

The design also needed one model that could provide useful type inference in React, support declarative custom elements in HTML, keep optional capabilities tree-shakeable, and allow controls to consume narrowly selected state.

## Decision

### Features are the unit of composition

Capabilities compose as player features. Preset-like feature bundles are convenience defaults, not a separate architectural layer. This keeps custom configurations additive and makes the dependency set visible while preserving an easy path for common audio and video players.

### One store owns one composite player target

A player uses one store whose target can contain both the media element and an optional container. One state graph makes cross-feature derivation and debugging simpler; the optional container keeps headless and audio-only composition possible.

The cost is that media-only features receive a broader target than they strictly need. The consistent lifecycle and selector model were judged more valuable than multiple coordinated stores.

### Factories preserve inference and platform conventions

Both platform packages expose a typed player factory configured by features. React receives scoped provider, container, and hook infrastructure. HTML receives equivalent context, controller, and mixin infrastructure while retaining declarative element registration for the common path.

A factory was chosen over global programmatic registration because the feature tuple can drive type inference, separate players can use different configurations, and unused capabilities remain removable. HTML side-effect registration remains a platform adapter rather than the core composition model.

### State access is selector-based

Consumers subscribe through explicit selectors instead of feature-specific hooks or implicit proxy tracking. Selectors make subscription breadth visible, compose across features, and share the same mental model between React hooks and HTML controllers.

Missing optional feature state is represented by an absent selector result rather than an unconditional exception. Reusable controls can therefore provide a fallback or a development warning, while applications that require a capability can enforce that contract themselves.

### Provider, container, media, and skin remain separate concerns

The provider owns store creation and attachment. The container supplies layout and fullscreen context. Media supplies playback, and skins compose presentation plus controls. Keeping these boundaries separate gives HTML and React the same skin meaning and allows transcripts, playlists, or other consumers to remain inside player context but outside the fullscreen target.

The later tactical decisions are recorded in:

- [`internal/decisions/player/player-container-separation.md`](../internal/decisions/player/player-container-separation.md)
- [`internal/decisions/player/provider-attach.md`](../internal/decisions/player/provider-attach.md)
- [`internal/decisions/player/context-media-discovery.md`](../internal/decisions/player/context-media-discovery.md)

### Names describe the object, not the implementation

Public concepts use player, feature, media, skin, and component language. Store slices remain an implementation mechanism. Custom-element names follow the media/player/component role rather than a Video.js-specific prefix.

## Alternatives considered

- **Use-case presets as the primary API** — easy to demonstrate but opaque, mutually exclusive, and difficult to extend incrementally.
- **Multiple feature stores** — narrower targets but more lifecycle coordination and no natural cross-feature selector graph.
- **Feature-specific hooks** — discoverable in isolation but creates parallel APIs and makes cross-feature selection awkward.
- **Global registration for every platform** — natural for custom elements but weakens React inference and makes configuration implicit.
- **Throw when a selector references a missing feature** — strict, but prevents reusable primitives from degrading gracefully.
- **Symbol feature keys with `store.get` and `store.has`** — deferred because selectors already provide typed lookup and composition with less API surface.

## Feedback that changed the shape

Reviewers cautioned against making one default skin account for every possible feature, especially mutually exclusive or specialized controls. The implemented direction therefore keeps common bundles and skins conservative rather than treating “adaptive” as “supports everything.”

There was also concern that feature bundles could become another preset taxonomy. Bundles remain ejectable convenience arrays, and the individual feature definitions remain the underlying contract.

## Amendment 2026-07-29 — the provider takes configuration

The provider now accepts developer-settable fields, as React props and HTML attributes. A feature declares which fields it exposes and which of its own actions writes each one; `createPlayer` collects those declarations and puts them on the provider. A field therefore exists only when the feature that declares it is composed — the same composition gating this RFC established for state, extended to the public provider surface.

This is amended here rather than recorded elsewhere because it changes a public API this RFC settled: at the time of writing, neither provider accepted any configuration at all. React's `ProviderProps` was literally `{ children }`, and `<video-player>` declared no attributes. All developer configuration arrived on the *media* element and was read back by features.

Two earlier positions need reconciling:

- **This RFC deferred "symbol feature keys with `store.get` and `store.has`"** (see alternatives above) on the grounds that selectors gave typed lookup with less API surface. The metadata feature does use symbol keys — but for private tier slots with no public accessor, no lookup API, and no way for a consumer to obtain the symbol. The instinct that rejected them then (keep the store's public surface small) is the same instinct that keeps these private now. See [derived-state.md](/internal/decisions/store/derived-state.md).
- **[provider-attach.md](/internal/decisions/player/provider-attach.md) flagged "provider mixin grows in complexity"**, and [context-media-discovery.md](/internal/decisions/player/context-media-discovery.md) values "no attribute ceremony". Both concerns are real and partly conceded: the provider does grow, and it does grow attributes. The mitigation is that features opt in — every feature shipping today declares nothing and contributes nothing — and that the mechanism reuses the element's existing `static properties` engine rather than inventing a third attribute system.

The alternative was to keep configuration on the media element. Rejected because content metadata is a fact about the *content*, not about a media engine, and because the same value has to be settable when no media is attached at all.

## Consequences

- The feature list is the type and bundle boundary for a player.
- Provider props are part of that boundary: a declared field exists only when its feature is composed.
- React and HTML share state and composition concepts while exposing platform-appropriate adapters.
- Controls depend on selectors instead of the full store when practical.
- Provider/container separation adds visible composition in HTML, but preserves cross-platform parity and enables extended player layouts.
- Current examples, feature inventories, overloads, element registrations, and package paths are deliberately omitted from this record because they evolve with source.

## Current sources

- Feature definition and selectors: `packages/core/src/dom/feature.ts`, `packages/core/src/dom/store/`
- Store composition and selector behavior: `packages/store/src/core/` and colocated tests
- React factory and context: `packages/react/src/player/`
- HTML factory, provider, container, and controller: `packages/html/src/player/`, `packages/html/src/store/`
- Public contracts and examples: package exports, package READMEs, and generated site reference pages
