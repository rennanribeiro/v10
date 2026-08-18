/**
 * Mock HTML video preset.
 *
 * Exercises: preset discovery, feature bundle export, skin exports,
 * tailwind skin exclusion. HTML presets do NOT export media elements
 * (the native <video> is implied by the preset name).
 */
export { videoFeatures } from '../../../core/src/dom/store/features/presets';
export { VideoPlayerElement } from '../define/video/player';
export { VideoSkinElement } from '../define/video/skin';
