---
name: review-architecture
description: Review a branch or PR with a text architecture map and cross-domain findings. Use for whole-change, data-flow, boundary, API, or tree-shaking review.
---

# Architecture review

Review the requested change as a whole; do not implement fixes.

1. Determine the intended base. Inspect the merge-base diff, commit history, and working tree separately. Fetch a linked issue or pull request when supplied and derive the acceptance boundary.
2. Read changed code in context: incoming callers, outgoing calls, state owners, types, tests, exports, package metadata, build configuration, and relevant records. Follow the change beyond the edited lines.
3. Trace each primary data or control flow end to end. Verify every edge through a call, import, event, subscription, callback, render path, or build entry. Mark inference rather than presenting an assumed edge as fact.
4. Identify boundaries that affect behavior or maintenance: source versus derived state, synchronous versus asynchronous work, public versus private contracts, pure logic versus side effects, core versus adapters, lifecycle ownership, and eager versus optional imports.
5. Delegate independent domain reviews when the change crosses distinct surfaces. Give each delegate the acceptance boundary and its focused files, then reconcile duplicate or conflicting findings by concrete failure mode.
6. Capture the complete changed API surface and its demonstrated usage. Include exports, types, functions, props, events, attributes, methods, context, styling hooks, registration, and entrypoints when applicable.
7. Inspect tree-shaking and package boundaries from actual imports, re-exports, `exports`, `sideEffects`, build entries, and available bundle evidence. Check whether optional behavior remains optional.
8. Validate suspected findings with a targeted command or source trace when practical. Prioritize correctness, regressions, security, accessibility, compatibility, and missing tests over style enforced by tools.

## Output

Always include an architectural overview, even when no actionable findings remain.

- Start with a concise verdict and description of the change.
- Draw one to three compact text diagrams in fenced code blocks. Name the key functions or components, label what each arrow carries or invokes, show important callers, and mark architectural boundaries inline. Use a control or dependency flow when the change has no runtime data flow.
- Explain what each key function owns and why it is in the flow. Cover affected API usage and tree-shaking boundaries where relevant.
- Do not replace the flow with a generic package inventory, boundary ledger, or decorative diagram.
- Follow the overview with actionable findings ordered by severity. For each, include the file and line, affected consumer, concrete failure mode, evidence, and smallest correction.
- Separate verified behavior, likely inference, and open questions. End with residual test gaps and say explicitly when no actionable findings remain.

## Example

Input: “Review this branch against main.”

Output: A source-backed text diagram of the changed flow and its key functions, boundary and API analysis, then deduplicated findings from the affected review domains.
