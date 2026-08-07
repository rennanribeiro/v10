---
name: review-component-design
description: Review proposed Video.js UI component designs without editing them. Use for boundaries, anatomy, data flow, HTML and React contracts, CSS APIs, opt-outs, tree shaking, or API and bundle trade-offs.
---

# Component design review

Read the proposal, nearest implemented UI records, relevant core/DOM/HTML/React code and tests, public exports, and package metadata.

1. Confirm the consumer problem and constraints justify a component or new part rather than markup, CSS, a utility, or an existing composition.
2. Trace ownership and data flow: source of truth, derivation, subscriptions, mutations, events or callbacks, context, lifecycle, and adapter responsibilities.
3. Review anatomy and boundaries. Each part should represent a semantic, focusable, placeable, omittable, or replaceable node; leave purely visual distinctions to CSS or pseudo-elements.
4. Enumerate the proposed public surface across props and properties, attributes, events and callbacks, methods, context, data attributes, CSS custom properties, parts, tag names, and exports. Require a concrete consumer for each addition.
5. Exercise opt-outs and composition: omit optional parts, replace markup without losing behavior, override styling, disable optional behavior, and avoid importing unused integrations.
6. Weigh ergonomics against concept count, typing and implementation complexity, platform parity, test matrix, compatibility commitment, dependencies, and bundle size. Verify that registration, exports, and side-effect boundaries make tree-shaking claims credible.
7. Check accessibility, keyboard and focus behavior, RTL and localization, animation ownership, cleanup, SSR, and how the design will be verified.

Use `internal/design/ui/slider.md`, `internal/design/ui/menus.md`, `packages/core/src/core/ui/`, `packages/core/src/dom/ui/`, and the matching HTML and React directories as local evidence. Where local precedent does not decide the issue, consult [Open UI](https://open-ui.org/component-spec-template/), [Lit composition](https://lit.dev/docs/composition/component-composition/), [React data flow](https://react.dev/learn/you-might-not-need-an-effect), [Base UI composition and styling](https://base-ui.com/react/handbook/composition), [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/), or [bundler side-effect guidance](https://webpack.js.org/guides/tree-shaking/).

Report findings by severity with the affected consumer, evidence, trade-off, and smallest design change. Separate blocking contract gaps from non-blocking preferences.

## Example

Input: “Review this chapter-menu component design.”

Output: Prioritized design findings about scope, flow, anatomy, public and CSS contracts, opt-outs, parity, accessibility, or bundle cost.
