/**
 * Live video player preset — `liveVideoFeatures` (adds `liveFeature`; drops `playbackRateFeature`, `qualityFeature`,
 * and `audioTrackFeature`) with a skin that swaps the time slider and time displays for a Live button.
 */
export { liveVideoFeatures } from '@videojs/core/dom';
export { LiveVideoPlayerElement, PlayerController } from './player';
export { LiveVideoSkinElement } from './skin';
export { LiveVideoSkinTailwindElement } from './skin.tailwind';
export { MinimalLiveVideoSkinElement } from './minimal-skin';
export { MinimalLiveVideoSkinTailwindElement } from './minimal-skin.tailwind';
