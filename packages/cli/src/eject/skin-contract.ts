import type { ResolvedCatalogItem } from '../catalog/index.js';

interface SkinNames {
  readonly preset: 'audio' | 'live-audio' | 'live-video' | 'video';
  readonly packaged: string;
  readonly generated: string;
  readonly tag: string;
  readonly minimal: boolean;
}

export interface ReactSkinContract {
  readonly packageSource: string;
  readonly packagedExport: string;
  readonly generatedExport: string;
  readonly stylesheetSource?: string | undefined;
}

export interface HtmlSkinContract {
  readonly registrationSource: string;
  readonly tag: string;
}

const skinNames = {
  video: {
    preset: 'video',
    packaged: 'VideoSkin',
    generated: 'DefaultVideoSkin',
    tag: 'video-skin',
    minimal: false,
  },
  'minimal-video': {
    preset: 'video',
    packaged: 'MinimalVideoSkin',
    generated: 'MinimalVideoSkin',
    tag: 'video-minimal-skin',
    minimal: true,
  },
  audio: {
    preset: 'audio',
    packaged: 'AudioSkin',
    generated: 'DefaultAudioSkin',
    tag: 'audio-skin',
    minimal: false,
  },
  'minimal-audio': {
    preset: 'audio',
    packaged: 'MinimalAudioSkin',
    generated: 'MinimalAudioSkin',
    tag: 'audio-minimal-skin',
    minimal: true,
  },
  'live-video': {
    preset: 'live-video',
    packaged: 'LiveVideoSkin',
    generated: 'DefaultLiveVideoSkin',
    tag: 'live-video-skin',
    minimal: false,
  },
  'minimal-live-video': {
    preset: 'live-video',
    packaged: 'MinimalLiveVideoSkin',
    generated: 'MinimalLiveVideoSkin',
    tag: 'live-video-minimal-skin',
    minimal: true,
  },
  'live-audio': {
    preset: 'live-audio',
    packaged: 'LiveAudioSkin',
    generated: 'DefaultLiveAudioSkin',
    tag: 'live-audio-skin',
    minimal: false,
  },
  'minimal-live-audio': {
    preset: 'live-audio',
    packaged: 'MinimalLiveAudioSkin',
    generated: 'MinimalLiveAudioSkin',
    tag: 'live-audio-minimal-skin',
    minimal: true,
  },
} as const satisfies Readonly<Record<string, SkinNames>>;

export function reactSkinContract(item: ResolvedCatalogItem): ReactSkinContract {
  const names = namesFor(item);
  const packageSource = `@videojs/react/${names.preset}`;

  return {
    packageSource,
    packagedExport: `${names.packaged}${item.style === 'tailwind' ? 'Tailwind' : ''}`,
    generatedExport: names.generated,
    stylesheetSource:
      item.style === 'css' ? `${packageSource}/${names.minimal ? 'minimal-skin' : 'skin'}.css` : undefined,
  };
}

export function htmlSkinContract(item: ResolvedCatalogItem): HtmlSkinContract {
  const names = namesFor(item);
  const entry = `${names.minimal ? 'minimal-skin' : 'skin'}${item.style === 'tailwind' ? '.tailwind' : ''}`;

  return {
    registrationSource: `@videojs/html/${names.preset}/${entry}`,
    tag: `${names.tag}${item.style === 'tailwind' ? '-tailwind' : ''}`,
  };
}

function namesFor(item: ResolvedCatalogItem): SkinNames {
  if (item.kind !== 'skin')
    throw new Error(`Cannot eject ${item.kind} ${item.name}. Recommendation: use \`videojs add\`.`);

  if (!hasSkinName(item.name)) throw new Error(`Skin ${item.name} has no packaged replacement contract.`);

  return skinNames[item.name];
}

function hasSkinName(name: string): name is keyof typeof skinNames {
  return Object.hasOwn(skinNames, name);
}
