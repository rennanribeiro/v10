import { describe, expect, it } from 'vitest';

import registry from '../../../../../packages/skins/dist/registry/r/registry.json';
import { resolveShadcnInstallation, shadcnAddCommand, type ShadcnCatalogItem } from '../shadcn';
import { getInstallationPreset, USE_CASES } from '../types';
import type { Skin } from '../types';

const catalog: readonly ShadcnCatalogItem[] = registry.items;
const frameworks = ['html', 'react'] as const;
const stylingOptions = ['tailwind', 'css'] as const;
const skins = ['video', 'minimal-video', 'audio', 'minimal-audio'] as const satisfies readonly Skin[];

describe('resolveShadcnInstallation', () => {
  it('resolves every editable Player and renderer combination from the generated catalog', () => {
    for (const framework of frameworks) {
      for (const styling of stylingOptions) {
        for (const useCase of USE_CASES) {
          if (useCase === 'background-video') continue;

          const preset = getInstallationPreset(useCase);
          const compatibleSkins = skins.filter((skin) => skin.includes(preset.mediaType));

          for (const skin of compatibleSkins) {
            for (const renderer of preset.renderers) {
              const result = resolveShadcnInstallation({ catalog, framework, styling, useCase, skin, renderer });

              expect(result.items.length).toBeGreaterThan(0);
              expect(result.includesPlayer).toBe(true);
              expect(result.packageOnly).toBe(false);
            }
          }
        }
      }
    }
  });

  it('installs only non-native media when no skin is selected', () => {
    const result = resolveShadcnInstallation({
      catalog,
      framework: 'react',
      styling: 'tailwind',
      useCase: 'default-video',
      skin: 'none',
      renderer: 'hls',
    });

    expect(result).toEqual({
      items: ['react-hlsjs-video'],
      packageOnly: false,
      includesPlayer: false,
      includesMedia: true,
    });
  });

  it('keeps Background Video package-managed', () => {
    expect(
      resolveShadcnInstallation({
        catalog,
        framework: 'html',
        styling: 'css',
        useCase: 'background-video',
        skin: 'video',
        renderer: 'background-video',
      })
    ).toEqual({ items: [], packageOnly: true, includesPlayer: false, includesMedia: false });
  });
});

describe('shadcnAddCommand', () => {
  it('formats namespaced items', () => {
    expect(shadcnAddCommand(['react-live-video', 'react-hlsjs-video'])).toBe(
      'pnpm dlx shadcn@latest add @videojs/react-live-video @videojs/react-hlsjs-video'
    );
  });

  it('returns null when there is no generated source to install', () => {
    expect(shadcnAddCommand([])).toBeNull();
  });
});
