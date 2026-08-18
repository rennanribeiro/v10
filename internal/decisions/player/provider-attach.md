---
status: decided
date: 2026-03-13
---

# Player Owns Media Attachment

## Decision

The player (`<video-player>` / React `Player`) owns the `store.attach()` lifecycle. The container (`<media-container>` / React `Container`) does not discover media or call `store.attach()` — it registers itself with the player via context and serves as the visual and interaction reference element.

Media and container elements register themselves with the player through contexts that return identity-specific cleanup callbacks. The player calls `store.attach({ media, container })` when it has a media element. Plain `<video>` and `<audio>` elements cannot consume context, so the player observes its subtree and tracks them directly.

## Context

The [player-container separation](player-container-separation.md) decision established that the player owns state and the container handles layout. But the container still owned a critical piece of the store lifecycle: media discovery and `store.attach()`.

The container discovered media via `querySelector('video, audio')`, duck-type checks for custom media elements, `MutationObserver` watching the subtree, and `slotchange` listeners on `<slot name="media">`. When it found media, it called `store.attach({ media, container: this })` and managed the detach lifecycle.

This split created friction:

- The player creates the store and destroys it, but a descendant controls when state flows through it. The lifecycle is split across two elements.
- Setups without a container (audio-only, headless, programmatic) couldn't attach — they needed the container present just to wire up the store.
- The container's media discovery logic (MutationObserver, slot queries, duck-typing) was brittle and required users to remember `slot="media"`.

## Alternatives Considered

- **Keep attach in the container** — Leave the current architecture. Rejected because it perpetuates the split lifecycle and forces container presence for attachment.

- **Move all discovery to player DOM queries** — Queries cannot see context-aware media nested through shadow DOM. Rejected as the only mechanism; direct subtree observation is used for plain `<video>`/`<audio>` while custom media registers through context.

- **Event-based registration** — Media elements dispatch a bubbling event that the player catches. Simpler than context but doesn't handle disconnection cleanly and requires the player to be in the DOM path (shadow DOM boundaries block event bubbling unless composed).

## Rationale

**Unified lifecycle.** The player already creates and destroys the store. Adding attach/detach means one element controls the full store lifecycle: create → attach → detach → destroy. No split ownership.

**Container stays focused.** The container is a reference element — the store uses it for fullscreen, PiP, keyboard focus, and gesture tracking. It does not need to know about media discovery or store internals. It registers itself with the player and renders children.

**No-container setups work.** Audio-only players, headless stores, and programmatic setups can attach media directly through the player without requiring a container element in the DOM.

**Registration cleanup is identity-safe.** Each registration returns a cleanup callback for that exact media or container. Disconnecting an older element cannot accidentally clear a newer registration, and removing the newest registration restores the previous connected element.

### Trade-offs

- **Player grows in complexity.** It gains attach lifecycle management, native media observation, and two additional context providers. This is manageable because it consolidates previously scattered responsibilities.

- **Native media observation is a pragmatic compromise.** Plain media elements cannot consume context, so the player observes and queries its own light-DOM subtree. This means two discovery paths exist, but both respond to connection and disconnection.
