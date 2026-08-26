import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '../../..');

function prompt(name) {
  return readFileSync(resolve(repositoryRoot, `.github/codex/prompts/${name}.md`), 'utf8');
}

function assertIncludesAll(value, fragments) {
  for (const fragment of fragments) assert.ok(value.includes(fragment), `Missing prompt guidance: ${fragment}`);
}

describe('Codex prompt contracts', () => {
  it('retains issue-triage classification, help, and planning guidance', () => {
    assertIncludesAll(prompt('issue-triage'), [
      'otherwise preserve the existing description',
      'instead of guessing',
      'practical next steps or a minimal example',
      'documentation is missing or unclear',
      'roadmap inclusion',
      'blocked-by relationship',
      'priority from P0 through P2',
      'do not claim to have inspected project contents that were not staged',
    ]);
  });

  it('retains changelog-specific editorial guidance', () => {
    assertIncludesAll(prompt('changelog'), [
      'never pad',
      'default to “This release…”',
      'sentence-case `##` headings',
      'one bullet per change',
      'old name to new name',
      'Drop per-change author credits',
      'link to their GitHub profile',
      'escape those characters in ordinary prose',
      'never fabricate details',
    ]);
  });

  it('retains E2E comment content requirements', () => {
    assertIncludesAll(prompt('e2e-pr'), ['state the classification and observable failure']);
    assertIncludesAll(prompt('e2e-main'), [
      'classification, strongest evidence, affected tests, recommended next action',
      'staged failed-run URL',
    ]);
  });
});
