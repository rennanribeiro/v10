import type { AnyPlayerStore } from '@videojs/core/dom';
import { ContextProvider } from '@videojs/element/context';
import type {
  MediaAudioTrackState,
  MediaPlaybackRateState,
  MediaQualityState,
  MediaTextTrackState,
} from '@videojs/media';
import { createStore } from '@videojs/store';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { playerContext } from '../../player/context';
import { MediaElement } from '../../ui/media-element';
import { installVideoMenuSettings } from '../video-menu-settings-controller';

type SettingsState = MediaAudioTrackState & MediaPlaybackRateState & MediaQualityState & MediaTextTrackState;

function defineElement(tagName: string, Base: CustomElementConstructor): void {
  if (!customElements.get(tagName)) customElements.define(tagName, Base);
}

function createSettingsStore(overrides: Partial<SettingsState> = {}): AnyPlayerStore {
  return createStore<unknown>()<SettingsState>({
    name: 'videoMenuSettings',
    state: () => ({
      audioTrackList: [
        { id: '0', kind: 'main', label: 'English', language: 'en', enabled: false },
        { id: '1', kind: 'alternative', label: 'Spanish', language: 'es', enabled: true },
      ],
      selectAudioTrack: vi.fn(),
      playbackRates: [0.5, 1, 1.5, 2],
      playbackRate: 1.5,
      setPlaybackRate: vi.fn(),
      videoRenditionList: [
        { id: '0', height: 1080, selected: false },
        { id: '1', height: 720, selected: true },
      ],
      activeVideoRendition: null,
      selectVideoRendition: vi.fn(),
      chaptersCues: [],
      thumbnailCues: [],
      thumbnailTrackSrc: null,
      textTrackList: [
        { kind: 'captions', label: 'English', language: 'en', mode: 'showing' },
        { kind: 'subtitles', label: 'Spanish', language: 'es', mode: 'disabled' },
      ],
      subtitlesShowing: true,
      toggleSubtitles: vi.fn(),
      selectSubtitlesTrack: vi.fn(),
      ...overrides,
    }),
  }) as unknown as AnyPlayerStore;
}

class TestPlayerProviderElement extends MediaElement {
  store: AnyPlayerStore = createSettingsStore();

  readonly #provider = new ContextProvider(this, { context: playerContext });

  override connectedCallback(): void {
    this.#provider.setValue(this.store);
    super.connectedCallback();
  }

  setStore(store: AnyPlayerStore): void {
    this.store = store;
    this.#provider.setValue(store);
  }
}

class TestVideoSkinElement extends MediaElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot!.innerHTML = `
      <div data-setting="quality"><span data-setting-value></span></div>
      <div data-setting="audio-track"><span data-setting-value></span></div>
      <div data-setting="playback-rate"><span data-setting-value></span></div>
      <div data-setting="captions"><span data-setting-value></span></div>
    `;
    installVideoMenuSettings(this);
  }
}

defineElement('test-video-menu-settings-player', TestPlayerProviderElement);
defineElement('test-video-menu-settings-skin', TestVideoSkinElement);

async function setup(store: AnyPlayerStore): Promise<TestVideoSkinElement> {
  const provider = document.createElement('test-video-menu-settings-player') as TestPlayerProviderElement;
  const skin = document.createElement('test-video-menu-settings-skin') as TestVideoSkinElement;
  provider.setStore(store);
  provider.append(skin);
  document.body.append(provider);
  await skin.updateComplete;
  return skin;
}

function getSetting(skin: TestVideoSkinElement, setting: string): HTMLElement {
  return skin.shadowRoot!.querySelector<HTMLElement>(`[data-setting="${setting}"]`)!;
}

describe('installVideoMenuSettings', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders current values inside the video skin composition', async () => {
    const skin = await setup(createSettingsStore());

    expect(getSetting(skin, 'quality').textContent).toBe('720p');
    expect(getSetting(skin, 'audio-track').textContent).toBe('Spanish');
    expect(getSetting(skin, 'playback-rate').textContent).toBe('1.5×');
    expect(getSetting(skin, 'captions').textContent).toBe('English');
  });

  it('publishes availability on the composed menu items', async () => {
    const skin = await setup(
      createSettingsStore({
        audioTrackList: [],
        playbackRates: [],
        videoRenditionList: [],
        textTrackList: [],
        subtitlesShowing: false,
      })
    );

    for (const setting of ['quality', 'audio-track', 'playback-rate', 'captions']) {
      const item = getSetting(skin, setting);
      expect(item.dataset.availability).toBe('unavailable');
      expect(item.getAttribute('aria-disabled')).toBe('true');
    }
  });
});
