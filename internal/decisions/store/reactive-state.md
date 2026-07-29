---
status: decided
date: 2026-07-13
---

# Use explicit store state and computed values

> **Partly superseded 2026-07-29 by [derived-state.md](./derived-state.md).** Derivation is now eager rather than lazy, and a `derived` map means a patch can change keys the caller did not name — a real reduction in the explicitness this record valued. That record argues the trade-off. Everything else here still holds: no proxy mutation, no public queue, frozen snapshots, target-specific async in slices.
>
> Note also that "computed values" in the prose below most likely describes **selectors**, which exist and are lazy at read. It should not be read as a mandate that the newer `derived` primitive was fulfilling.

## Decision

`@videojs/store` uses explicit state updates and computed values rather than proxy mutation, a public request queue, or implicit task orchestration.

## Context

An early proxy-based implementation reduced update ceremony but obscured mutation boundaries and complicated snapshots. Earlier queue and task APIs also modeled work the media target already owns. The replacement shipped through [#311](https://github.com/videojs/v10/pull/311) and [#321](https://github.com/videojs/v10/pull/321), followed by removal of the queue surface.

## Alternatives considered

- **Proxy mutation** — concise writes, but less explicit state transitions and more runtime machinery.
- **Public queue/task API** — useful for general orchestration, but duplicated target behavior and expanded the store's responsibility.

## Rationale

Explicit updates make ownership and tests easier to follow. Frozen snapshots prevent accidental mutation, key-aware subscriptions avoid unrelated work, and computed values keep derivation lazy. Target-specific async behavior stays in slices or the target rather than a generic store queue.

The current API and examples live in `packages/store/src/`, its tests, and `packages/store/README.md`.
