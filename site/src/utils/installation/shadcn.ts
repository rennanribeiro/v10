import { getInstallationPreset, getMediaSubpath } from './types';
import type { Renderer, Skin, UseCase } from './types';

export type ShadcnFramework = 'html' | 'react';
export type ShadcnStyling = 'css' | 'tailwind';

export interface ShadcnCatalogItem {
  name: string;
  meta?: {
    role?: string;
    framework?: string;
    styling?: string;
    preset?: string;
    variant?: string;
    public?: boolean;
  };
}

interface ResolveShadcnInstallationOptions {
  catalog: readonly ShadcnCatalogItem[];
  framework: ShadcnFramework;
  styling: ShadcnStyling;
  useCase: UseCase;
  skin: Skin;
  renderer: Renderer;
}

export interface ShadcnInstallation {
  items: readonly string[];
  packageOnly: boolean;
  includesPlayer: boolean;
  includesMedia: boolean;
}

/** Resolves the install picker state against the published registry catalog. */
export function resolveShadcnInstallation({
  catalog,
  framework,
  styling,
  useCase,
  skin,
  renderer,
}: ResolveShadcnInstallationOptions): ShadcnInstallation {
  if (useCase === 'background-video') {
    return { items: [], packageOnly: true, includesPlayer: false, includesMedia: false };
  }

  const items: string[] = [];
  const preset = getInstallationPreset(useCase).flag;
  const variant = skin.startsWith('minimal-') ? 'minimal' : 'default';
  const includesPlayer = skin !== 'none';

  if (includesPlayer) {
    const player = catalog.find(
      (item) =>
        item.meta?.public === true &&
        item.meta.role === 'player' &&
        item.meta.framework === framework &&
        item.meta.styling === styling &&
        item.meta.preset === preset &&
        item.meta.variant === variant
    );

    if (!player) {
      throw new Error(`Missing ${framework} ${preset} ${variant} ${styling} Player block in the Video.js registry.`);
    }

    items.push(player.name);
  }

  const mediaName = getMediaSubpath(renderer);
  const media = mediaName
    ? catalog.find(
        (item) =>
          item.name === `${framework}-${mediaName}` &&
          item.meta?.public === true &&
          item.meta.role === 'media' &&
          item.meta.framework === framework
      )
    : undefined;
  if (mediaName && !media) throw new Error(`Missing ${framework} ${mediaName} media item in the Video.js registry.`);

  if (media) items.push(media.name);

  return {
    items,
    packageOnly: false,
    includesPlayer,
    includesMedia: Boolean(media),
  };
}

/** Formats a namespaced Shadcn command for a resolved installation. */
export function shadcnAddCommand(items: readonly string[]): string | null {
  if (items.length === 0) return null;

  return `pnpm dlx shadcn@latest add ${items.map((item) => `@videojs/${item}`).join(' ')}`;
}
