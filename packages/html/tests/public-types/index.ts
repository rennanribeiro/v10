import { createPlayer, selectPlayback, type UIElement, videoFeatures } from '@videojs/html';
import { PlayerController as AudioPlayerController, AudioPlayerElement } from '@videojs/html/audio';
import { PlayerController as BackgroundPlayerController, BackgroundVideoPlayerElement } from '@videojs/html/background';
import { PlayerController as LiveAudioPlayerController, LiveAudioPlayerElement } from '@videojs/html/live-audio';
import { PlayerController as LiveVideoPlayerController, LiveVideoPlayerElement } from '@videojs/html/live-video';
import { PlayerController as VideoPlayerController, VideoPlayerElement } from '@videojs/html/video';
import '@videojs/html/ui/slider-thumbnail';

const { PlayerElement: CustomPlayerElement, PlayerController } = createPlayer({
  features: videoFeatures,
});

declare const host: UIElement;

new PlayerController(host, selectPlayback);
new VideoPlayerController(host);
new AudioPlayerController(host);
new LiveVideoPlayerController(host);
new LiveAudioPlayerController(host);
new BackgroundPlayerController(host);

const playerElements = [
  CustomPlayerElement,
  VideoPlayerElement,
  AudioPlayerElement,
  LiveVideoPlayerElement,
  LiveAudioPlayerElement,
  BackgroundVideoPlayerElement,
];

void playerElements;
