import { describe, expect, it } from 'vitest';

import packageJson from '../../../package.json' with { type: 'json' };

describe('HTML preset packaging', () => {
  it('preserves bare preset imports through production tree-shaking', () => {
    expect(packageJson.sideEffects).toContain('./dist/*/presets/*.js');
  });
});
