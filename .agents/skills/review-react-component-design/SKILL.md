---
name: review-react-component-design
description: Review React component designs. Use for boundaries, APIs, opt-outs, and bundles.
---

# React component design review

Read the proposal, nearby records, and relevant React code, tests, exports, and package metadata.

1. Test whether the consumer problem needs a component or part rather than markup, CSS, a hook, a utility, or existing composition.
2. Trace ownership and data flow across core, DOM behavior, and React. Check effects and cleanup.
3. Review compound anatomy, React and CSS APIs, and whether each addition has a consumer. Leave visual structure to CSS.
4. Exercise omission, render replacement, styling, behavior, and import opt-outs.
5. Weigh API complexity against bundle cost and verify client boundaries. Check accessibility, interaction, and SSR constraints.

Use `packages/react/src/ui/`, `use-render.tsx`, and package metadata as evidence. Report findings by severity with the smallest change.

## Example

Input: “Review this React chapter-menu design.”

Output: Prioritized findings about boundaries, APIs, opt-outs, SSR, accessibility, and bundle cost.
