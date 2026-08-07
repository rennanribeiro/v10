---
name: write-component-design
description: Write or update a Video.js UI component design record only when the user explicitly requests that record. Use for compact, non-inferable rationale about component boundaries and contracts.
---

# Component design records

Read `internal/design/README.md`, the nearest records under `internal/design/ui/`, current component code and tests, and the relevant package exports. Use `internal/design/ui/slider.md` and `internal/design/ui/menus.md` as concise implemented examples.

## Workflow

1. Confirm that the user explicitly requested creation or revision of the record. Do not invoke this skill merely because component design work exists.
2. Use the requested artifact and path when given; otherwise choose the smallest matching UI design or decision location.
3. Read the relevant implementation, tests, exports, and existing records. Treat them as the source of current behavior.
4. State the chosen component boundary directly and preserve only the important rationale or constraint that cannot be inferred from code.
5. Cover ownership, markup versus styling, HTML and React differences, CSS API, opt-outs, or bundle trade-offs only when they explain the decision.
6. Link source instead of copying anatomy, properties, props, events, parts, state flow, styling hooks, exports, or defaults.
7. Include alternatives or consequences only when they materially explain the choice. Omit empty headings and speculative detail.

Keep the result to a few paragraphs when possible. Do not create companion decisions or an RFC without a separate explicit request. Consult external prior art only when the user requests research or it is necessary to explain the recorded choice.

## Example

Input: “Write a component design record for chapter selection in HTML and React.”

Output: A compact component decision and the non-inferable reason it should survive outside the code, with source links where useful.
