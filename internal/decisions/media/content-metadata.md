---
status: decided
date: 2026-07-29
---

# Content metadata on the media API

## Decision

The media API gains three capabilities — `contentTitle`, `contentPoster`, and `contentPosterAlt` — each with its own change event and predicate.

Four rules govern them:

- **They are separate from `title` and `poster`, deliberately, and are not reconciled with them.**
- **"Nothing" is `null` or `undefined`. An empty string is a real value** meaning deliberately blank.
- **A media must never manufacture `''`** to stand in for absence.
- **A media that reports a field clears it on source change and dispatches the change event.**

## Context

A developer often knows a video's title from their CMS. A media element often knows it too — a `mux-video` can fetch it from the Mux API. The player has to reconcile the two, which requires the media layer to have somewhere to *say* it. Adding these properties to the media surface is that whole job; how a given element populates them is its own business.

The player-side half — three tier slots per field and a fixed resolve order — is [derived-state.md](../store/derived-state.md).

## Alternatives Considered

- **Reuse `title` and `poster`** — rejected. Those are the *developer's* settings on the element: the native tooltip, the `<video poster>` frame. The `content*` properties are *facts about the content*, usually from a backend. Merging them would erase a distinction that has real consequences — a developer setting `poster` for a frame to show before playback is not making a claim about the content. The plain names are out of scope for this work rather than a migration target.
- **One capability holding every field** — rejected, and it contained a contradiction. Support was to be decided by whether the property is *declared*, but a `mux-video` offering a title and no poster would then either declare a `contentPoster` it can never fill or fail the check for a capability it partly implements. Per-field capabilities dissolve that structurally. The decisive argument: metadata will grow, and there is no way to require all of it from every donor. The accepted cost is that eight fields eventually means eight capabilities and eight events.
- **Spell absence as `undefined`** — rejected. Both `null` and `undefined` read as absent to the resolve chain, but the predicates test `!isUndefined`, so `undefined` would make capability *flicker* as an attribute came and went. A feature checks capability once at attach and wires its listener then, so an attribute unset at that moment would mean a value arriving later never reaches the store. `null` keeps a declaring host permanently capable.
- **Presence-based detection (`'contentTitle' in media`)** — rejected on consistency and correctness. All the predicates in `predicate.ts` use `!isUndefined`; the sole `in` check tests for a method. `in` also walks the prototype chain, so a getter on a shared host would make every host report capable.
- **An `emptied` backstop in the player feature** — rejected. See below.

## Rationale

`empty: null` on the `CustomMediaElement` declarations is what makes the empty-string rule work end to end: removing `content-title` yields `null` (absent, fall through), while `content-title=""` yields `''` (present, suppress). The neighbouring `poster` and `src` declarations collapse to `''` — the wrong precedent sitting immediately beside the right one, `preload`.

Suppression is why two empty-ish states are unavoidable. `content-title=""` — the backend supplies a title, the developer wants none shown — is expected to be common. Given that requirement, the only real choice is which of empty-string and null means which, and the platform already answers it: a removed attribute is absent, an attribute set to empty is present-and-empty.

Capability is effectively constant for these fields, and that is accepted knowingly rather than discovered later. Any media host can carry a content title, so there is nothing to gate; the predicate is a formality that keeps the shape consistent with its neighbours.

**The clearing contract's two halves are not equally enforced, and this matters to implementers.** Dispatching on change is structural — assigning through the host setter fires the event, so an implementer would have to work at skipping it. Clearing on source change is pure convention with nothing checking it. The player wires no fallback `emptied` listener, matching what the stream-type feature already assumes and what `hls-js` already honours by resetting itself on `MANIFEST_LOADING` and `DESTROYING`. A third-party media that declares a field and never clears it will show a stale value across a source change. That is a documented contract violation rather than a player bug, and adding defence-in-depth was judged not worth the weight — but it is the thing to check first if stale metadata is ever reported.
