import { defineConfig, jsx, transform } from '@videojs/compiler';
import { anyTag, childAsProp } from '@videojs/compiler/ast';

const reactSourceConfig = defineConfig({
  target: jsx({
    imports: {
      '@videojs/core/components': '@videojs/react',
      '@videojs/icons/components': './icons',
      '@videojs/jsx': (name) => ({ source: 'react', name: name === 'ComponentNode' ? 'ReactElement' : name }),
    },
    transforms: [
      childAsProp({
        match: anyTag(['Popover.Trigger', 'TooltipPrimitive.Trigger']),
        prop: 'render',
      }),
    ],
  }),
  plugins: [
    transform(
      (code) => {
        const cn = code.import('@videojs/utils/style', 'cn');

        return [
          code.jsx.element('Text').replace('span'),
          code.jsx.element('Slider.Thumbnail.Root').replace('div'),
          code.jsx.element('Slider.Thumbnail.Image').replace('Slider.Thumbnail'),
          code.jsx.props('className').replace(({ value }) => code.value.call(cn, [value])),
        ];
      },
      { name: '@videojs/react:source-ui' }
    ),
  ],
});

export default reactSourceConfig;
