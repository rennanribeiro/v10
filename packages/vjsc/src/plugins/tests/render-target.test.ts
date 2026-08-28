import { type Plugin, rolldown } from 'rolldown';
import { describe, expect, it } from 'vite-plus/test';

import { defineComponent, defineSchema } from '../../components/definition';
import { defineComponentTarget } from '../../target/definition';
import { readComponentSource } from '../component-meta';
import { componentSourcePlugin } from '../component-source';
import { componentTargetPlugin } from '../component-target';
import { reactTargetPropsPlugin } from '../react-target-props';
import { renderTargetPlugin } from '../render-target';
import { targetImportCleanupPlugin } from '../target-import-cleanup';
import { targetJsxPlugin } from '../target-jsx';

const MODULE_ID = '\0fixture.tsx?target=react';

const schema = defineSchema('@fixture/components', {
  PlayButton: defineComponent({ name: 'PlayButton' }),
});

const reactTarget = defineComponentTarget<typeof schema>()(({ element, imported }) => ({
  source: '@fixture/components',
  renderTargets: {
    Button: element('button', {
      props: { from: 'react', name: 'ComponentProps', intrinsic: 'button' },
    }),
  },
  resolve: ({ component }) => imported({ from: '@fixture/react', name: component }),
  jsx: { importSource: 'react', attributes: 'react' },
}));

const htmlTarget = defineComponentTarget<typeof schema>()(({ element }) => ({
  source: '@fixture/components',
  renderTargets: { Button: element('button') },
  resolve: ({ component }) => element(`media-${component.toLowerCase()}`),
  jsx: { importSource: 'vjsc/html-runtime', attributes: 'html' },
}));

describe('renderTargetPlugin', () => {
  it('generates a typed React target and composes it through render', async () => {
    const source = await transform(
      `
        import * as $ from '@fixture/components';
        import { defineRenderTarget } from 'vjsc/components';

        export const Button = defineRenderTarget('Button', 'media-button');
        export const play = <$.PlayButton $render={Button} className="specific" />;
      `,
      reactTarget
    );

    expect(source).toContain('export interface ButtonProps extends ComponentProps<"button"> {}');
    expect(source).toContain('export function Button({ className, ...props }: ButtonProps)');
    expect(source).toContain('<button className={cn("media-button", className)} {...props} />');
    expect(source).toContain('<PlayButton render={<Button />} className="specific" />');
    expect(source).not.toContain('defineRenderTarget');
    expect(source).not.toContain('$render');
  });

  it('keeps HTML on the resolved custom-element host', async () => {
    const source = await transform(
      `
        import * as $ from '@fixture/components';
        import { defineRenderTarget } from 'vjsc/components';

        export const Button = defineRenderTarget('Button', 'media-button');
        export const play = <$.PlayButton $render={Button} className="specific" />;
      `,
      htmlTarget
    );

    expect(source).toContain('export const Button = "media-button";');
    expect(source).toContain('<media-playbutton className={[Button, "specific"]} />');
    expect(source).not.toContain('<button');
    expect(source).not.toContain('$render');
  });

  it('resolves named relative imports without scanning their source module', async () => {
    const source = await transform(
      `
        import * as $ from '@fixture/components';
        import { Button as SharedButton } from './button';

        export const play = <$.PlayButton $render={SharedButton} />;
      `,
      reactTarget
    );

    expect(source).toContain("import { Button as SharedButton } from './button';");
    expect(source).toContain('<PlayButton render={<SharedButton />} />');
  });

  it('rejects unknown, misplaced, and unconsumed compiler directives', async () => {
    await expect(
      transform(
        `import * as $ from '@fixture/components'; export const play = <$.PlayButton $render={Missing} />;`,
        reactTarget
      )
    ).rejects.toThrow('Cannot resolve render target `Missing`');

    await expect(
      transform(`import { Button } from './button'; export const play = <button $render={Button} />;`, reactTarget)
    ).rejects.toThrow('can only be used on a canonical component or part');

    await expect(
      transform(`import * as $ from '@fixture/components'; export const play = <$.PlayButton $unknown />;`, reactTarget)
    ).rejects.toThrow('Unknown VJSC compiler directive `$unknown`');
  });
});

async function transform(source: string, target: typeof reactTarget | typeof htmlTarget): Promise<string> {
  let meta: unknown;
  const inspect: Plugin = {
    name: 'fixture:inspect',
    buildEnd() {
      meta = this.getModuleInfo(MODULE_ID)?.meta;
    },
  };
  const targets = [target];
  const bundle = await rolldown({
    input: 'fixture',
    experimental: { nativeMagicString: true },
    external: /^(?:@fixture\/|\.\/button|react$|vjsc\/)/,
    transform: { jsx: 'preserve' },
    plugins: [
      fixturePlugin(source),
      targetJsxPlugin({ targets }),
      renderTargetPlugin({ targets }),
      componentTargetPlugin({ targets }),
      reactTargetPropsPlugin({ targets }),
      targetImportCleanupPlugin({ targets }),
      componentSourcePlugin(),
      inspect,
    ],
  });

  await bundle.generate({ format: 'es' });

  const output = readComponentSource(meta);
  if (output === undefined) throw new Error('Fixture build did not retain editable source.');

  return output;
}

function fixturePlugin(source: string): Plugin {
  return {
    name: 'fixture:module',
    resolveId(id) {
      return id === 'fixture' ? MODULE_ID : null;
    },
    load(id) {
      return id === MODULE_ID ? { code: source, moduleType: 'tsx' } : null;
    },
  };
}
