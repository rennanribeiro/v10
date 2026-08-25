import { styles } from 'vjsc/styles';

export default styles({
  file: 'controls.css',
  layer: 'videojs.components',
  rules: {
    root: {
      className: 'media-minimal-video-root',
      utilities: 'group/minimal-video',
    },
    timeSliderGroup: {
      className: 'media-time-slider-group',
      utilities: [
        '@container/media-time-controls -order-1 flex flex-none basis-full flex-row-reverse items-center gap-3 px-1.5',
        '[--media-slider-height:--spacing(5)]',
        '@2xl/media-root:order-none @2xl/media-root:min-w-0 @2xl/media-root:flex-1 @2xl/media-root:flex-row',
        '@2xl/media-root:[--media-slider-height:--spacing(8)]',
        '@2xl/media-root:[mask-position:100%_0] @2xl/media-root:[mask-size:200%_100%]',
        '@2xl/media-root:[transition:mask-position_50ms_ease-out]',
        'group-data-[active-popup=volume]/minimal-video:@2xl/media-root:[mask-image:linear-gradient(to_right,transparent_10%,black_25%,black_100%)]',
        'group-data-[active-popup=volume]/minimal-video:@2xl/media-root:[mask-position:0_0]',
      ],
    },
  },
});
