import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  completeChecklistItems,
  conventionalTitle,
  diagnosticTitle,
  referencedNumbers,
  usefulSearchTerms,
} from '../codex-workflow.mjs';

describe('codex workflow helpers', () => {
  it('extracts unique referenced issue numbers', () => {
    assert.deepEqual(referencedNumbers('Fixes #12, relates to #9 and #12.'), [12, 9]);
  });

  it('normalizes useful search terms', () => {
    assert.equal(usefulSearchTerms('Bug: VideoJS playback stalls with remote text tracks'), 'bug playback stalls remote text');
  });

  it('completes only exact unchecked checklist items', () => {
    const body = '- [ ] Add tests\n- [ ] Add docs\n- [x] Ship code';

    assert.equal(
      completeChecklistItems(body, ['Add tests', 'Missing item']),
      '- [x] Add tests\n- [ ] Add docs\n- [x] Ship code'
    );
  });

  it('falls back from invalid Conventional Commits titles', () => {
    assert.equal(conventionalTitle('not conventional', 'fix: use fallback'), 'fix: use fallback');
    assert.equal(conventionalTitle('docs(site): update reference', 'fix: use fallback'), 'docs(site): update reference');
  });

  it('sanitizes E2E failure phrases for issue titles', () => {
    assert.equal(
      diagnosticTitle({ classification: 'inconclusive', shortFailure: 'Safari <video> timeout!' }, 42),
      'chore(ci): investigate safari video timeout from #42'
    );
  });
});
