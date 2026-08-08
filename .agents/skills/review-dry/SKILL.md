---
name: review-dry
description: Review changes for duplication and reuse. Use for DRY passes, utility placement, or API consolidation.
---

# DRY and reuse review

Review the requested change for reuse and abstraction opportunities; do not implement fixes.

1. Understand the changed behavior before comparing syntax. Read the diff, callers, tests, and neighboring implementations so intentionally separate policies are not collapsed into one helper.
2. Search in order: the changed module, package-local helpers, the relevant `@videojs/utils` subpath, then equivalent behavior across other packages. Prefer an existing utility when its contract already fits.
3. For each candidate, compare inputs, outputs, defaults, errors, state and lifecycle ownership, side effects, platform requirements, and likely evolution. Similar-looking code is not duplication when these semantics differ.
4. Place shared behavior at the nearest honest owner:
   - keep one-off behavior inline;
   - share within the package when consumers have the same package policy;
   - promote runtime-neutral behavior with concrete cross-package consumers to an appropriate `@videojs/utils` subpath;
   - put browser-specific helpers under `@videojs/utils/dom`;
   - keep framework and product policy out of generic utilities.
5. Evaluate the proposed abstraction as an API: name, contract, inference, dependency direction, call-site clarity, testing burden, exports, side effects, and tree-shaking cost. Prefer a small shared primitive over a generic mechanism built for hypothetical consumers.
6. Check whether the change duplicates an existing public or internal API shape, not only function bodies. Recommend consolidation only when it leaves one clearer ownership model.
7. Validate every recommendation with concrete existing implementations and callers. Do not use a fixed finding quota or report mechanical similarities in tests, generated code, or adapters that intentionally preserve platform boundaries.

## Output

Report candidates in this order:

1. **Reuse existing** — an existing helper or API already satisfies the contract.
2. **Extract locally** — repeated behavior has one package owner.
3. **Promote to shared utils** — stable behavior has concrete cross-package consumers and a valid neutral or DOM-specific home.
4. **Consolidate API** — multiple surfaces express the same user-facing contract.

For each candidate, cite every relevant location, describe the common semantics, name the correct owner, show the smallest useful abstraction, and state dependency or bundle consequences. Separate actionable duplication from optional design ideas. Say explicitly when the current duplication is preferable or no useful DRY findings remain.

## Example

Input: “Do a DRY pass on this branch.”

Output: Evidence-backed reuse or extraction candidates, including existing utilities and callers, with speculative or boundary-breaking abstractions rejected.
