# Docs triage execution plan (delete before merge)

Session: docs-feedback triage with Dave (dcepulis@mux.com), 2026-08-26/27.
Notion tracker: Video.js Feedback DB, data source `collection://3bc97a7f-89d0-8096-9329-000bf8f5a286`, Docs view.
Triage is COMPLETE: 17 Fixed, 2 Won't Fix, 15 open with direction baked into each item's Description.
This file drives the execution phase only.

## Delivery model (per Dave)

- TRUE STACKED PRs: each branch based on the previous one, one logical change per PR,
  Claude manages rebases as main moves ("each change is one ripple that you manage").
- All PRs open as drafts. Update each Notion item's PR field once its PR exists.
- Current branch `claude/docs-items-triage-a5cgs0` holds WIP commits a61033b, 6da96ea, bba9301
  (anchors+checker, live preset JSDoc, LiveButton page) — these get re-cut as the first
  stacked branches off main; the triage branch is then just a scratch record.

## Stack order (rebase-friendly: verified WIP first, same-file clusters grouped)

1. anchors + check-anchors.ts        — from a61033b; MUST re-run build proof (restart killed it)
2. live preset JSDoc accuracy        — from 6da96ea; already verified end-to-end
3. LiveButton reference page         — from bba9301; UNVERIFIED: run astro check + build, check
                                        llms.txt entry, review new packages/html/src/define/ui/live-button.ts
4. migrate-from-mux-player fixes     — one branch, three fixes in that file:
   - analytics table casing: FrameworkCase split (or api-ref generator if not over-engineering)
   - pre-migration checklist incl. grep for `mux-player` DOM selectors
   - annotate `aspect-video` as Tailwind in headline snippets (or app-owned class + 2-line CSS)
5. imperative-control sections       — add "how to control the player imperatively" to Plyr,
                                        Media Chrome, vjs8 guides (Mux guide is the model:
                                        ref=native element, usePlayer/store, escape hatches)
6. React provider model              — clarify "Player works like any React provider; lift it to
                                        where you need state; it renders no DOM" in use-player.mdx,
                                        player.mdx, mux guide 'Read player state'. Do NOT eagerly
                                        recommend the bridge pattern (it's a workaround).
7. poster hierarchy                  — encode in add-a-poster-and-loading-placeholder.mdx and link
                                        from relevant places; fix contradicting prose in vjs8 guide
                                        (~line 108) + Plyr guide (~line 80). Dave's hierarchy:
                                        (1) media should provide a poster
                                        (2) skins: set poster on the provider
                                        (3) skins + more control (framework component, <picture>):
                                            slot / renderPoster prop
                                        (4) ejected: provider poster or src directly on media-poster
8. HLS element messaging             — "use the default one and let us handle it; if interested,
                                        /spf is smaller, /hls.js is more compatible" (same for Mux
                                        flavors). Also fix generated preset-ref advertising <Video>
                                        as React live-video default (HTML column shows '–');
                                        see site/scripts/api-docs-builder/src/preset-handler.ts.
9. skip-button discoverability       — mention seek/skip buttons in customize-skins "Where packaged
                                        customization stops"; map Plyr rewind/fast-forward/seekTime
                                        in Plyr guide + temper its "all the common controls" line
                                        (~350); document audio skins ship ±10s but video skins none;
                                        SeekButton default is 30s.
10. Copy Markdown fix                — Turndown rule for .docs-link-card in
                                        site/integrations/llms-markdown.ts emitting
                                        `- [Title](url): description`; affects all See-also sections.
11. site version in chrome           — render VJS10_VERSION (site/src/consts.ts) in header/footer/
                                        docs layout; banner currently version-free.
12. roadmap + blog                   — add installation + migration-guide links to
                                        concepts/v10-roadmap.mdx; add an ASIDE (edit note stating
                                        current state) to blog 2026-03-10-videojs-v10-beta-hello-world-again.mdx
                                        near the stale "We'll have migration guides" lines. Do not
                                        rewrite the original blog text. Algolia weighting = separate scope.

## Explicitly OUT of scope (leave Notion items open/closed as already set)

- Vidstack migration guide (Rahim writes it)
- light-DOM HLS escape hatch docs (power-user, open but deferred)
- installation media-exposure / React CDN (Won't Fix; separate plans)
- TS floor in package metadata; vjsc Tailwind 4.2.1 runtime pin (noted in items only)

## Conventions

- pnpm only; run from repo root. Site checks: `pnpm -F site astro check`
  (env -u SENTRY_AUTH_TOKEN if needed), `pnpm -F site build`, `pnpm check:workspace` after
  AGENTS/skill changes. Lint: `pnpm lint:fix:file <file>`.
- Repo skills to load per task: write-docs (guide prose), write-api-reference (reference pages),
  commit-pr (publication). No model IDs in any pushed artifact.
- After each PR: subscribe_pr_activity, update Notion PR field.
