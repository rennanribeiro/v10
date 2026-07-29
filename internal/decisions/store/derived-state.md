---
status: decided
date: 2026-07-29
---

# Derived state and symbol-keyed tier slots

## Decision

`@videojs/store` gains a `derived` primitive: a slice may declare formulas alongside its state, and the store computes them eagerly inside `patch`, folding the answers into the same frozen snapshot before it notifies.

Three rules make it small:

- **No dependency tracking.** Every formula reruns on every patch that changed something.
- **A formula reads source keys only.** Reading another formula's output is a compile error, which is what removes run ordering and cycle detection.
- **The formula is the only writer of its key.** `patch` strips derived keys from incoming partials and warns in `__DEV__`.

Separately, features may keep **symbol-keyed slots** in their state as private inputs to a formula. `patch` iterates with `Reflect.ownKeys` so symbol keys participate; `createStore` installs accessors from `Object.keys`, so those slots get no public getter.

This supersedes the "computed values keep derivation lazy" clause of [reactive-state.md](./reactive-state.md).

## Context

The content metadata feature needs one field to resolve from three independent inputs — a developer override, whatever the media reports, and a developer fallback — in a fixed order, no matter which arrives first. Separate slots per input resolve identically however the writes land; a single slot with write-time precedence reduces to last-write-wins with extra bookkeeping.

That leaves the question of who computes the answer. Recomputing by hand at every write site worked until `detach`: it resets state by re-applying the initial state, which lives inside the store, so no feature-owned recompute can hang off it. The resolved value would snap back to the library default while the developer's override still sat in its slot — the exact bug the primitive exists to prevent.

Full exploration in the metadata design notes; the tier model and its consequences are covered by [content-metadata.md](../media/content-metadata.md) on the media side.

## Alternatives Considered

- **Automatic dependency tracking** — a formula records what it read and reruns only when one of those keys changes. Rejected for now. The performance argument does not survive counting: a handful of formulas doing three or four property reads each costs about what deciding whether to rerun them costs, and the same `timeupdate` is re-rendering a progress bar. It also needs re-recording on every run, because a nullish-coalescing chain that finds a value early never reads the later slots and so understates its real dependencies. Formulas are authored as `({ get }) => …` either way, so tracking can be added later without editing a single formula.
- **Compute on read** — expose derived values as getters on the snapshot. Rejected: `patch` spreads the current state, which flattens a getter into a stale value, so getters would have to be reinstalled after every patch and in the constructor. Eager keeps derived values ordinary properties, so store getters, selectors, `store.state`, and `shallowEqual` need no changes at all.
- **One widened state type instead of a source/derived split** — rejected because it would make the type system assert two false things: that `combine`'s merged `state()` output contains the derived keys, and that a feature's `set` may write them.
- **Visible string keys for tier slots** — honestly the more conventional choice, and it would make the slots show up in devtools and selector output for free. Rejected because those slots are implementation detail of one feature's resolve chain, not player state: every consumer wants the resolved answer, and three extra public keys per field (times however many metadata fields eventually land) is a large public surface to buy debuggability. The mitigation is that symbol keys are *internal, not secret* — `Reflect.ownKeys` on a snapshot still lists them. If debugging these turns out to be genuinely painful, a `__DEV__` inspection helper is the cheaper fix.
- **Teaching the store which keys survive `detach`** — rejected. The information already exists in the feature: media slots are seeded in `state()` so the reset clears them, and developer slots are left out so it cannot reach them.

## Rationale

Eager compute-and-store is the version that changes the least. Every existing read path keeps working, because a derived key is still an ordinary value in a frozen snapshot.

Making the formula the sole writer is what buys the real property: **`detach` stops being order-dependent.** Whether cleanup or the reset runs first, the source keys end up the same and the formula produces the same answer. Under hand-rolled recompute the ordering was load-bearing and silent when broken — a trap for whoever next touched `detach`.

The honest cost of dropping tracking is that formulas must stay cheap, which is now documented on the `derived` field. The trigger to revisit is formula count or formula cost growing enough to measure.

One acknowledged tension with [reactive-state.md](./reactive-state.md) beyond laziness: that record valued explicit updates partly because they make it obvious which keys a write changes, and a `derived` map means `patch({ someTier })` can change a key the caller never named. That is a real reduction in explicitness, accepted because the alternative — every call site remembering to write the tier and the answer together — moves the same knowledge somewhere less reliable and punishes forgetting with a silently wrong value.
