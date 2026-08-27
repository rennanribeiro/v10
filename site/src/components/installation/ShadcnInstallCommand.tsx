import { useStore } from '@nanostores/react';

import ClientCode from '@/components/Code/ClientCode';
import { Tab, TabsList, TabsPanel, TabsRoot } from '@/components/Tabs';
import { renderer, skin, useCase } from '@/stores/installation';
import {
  resolveShadcnInstallation,
  shadcnAddCommand,
  type ShadcnCatalogItem,
  type ShadcnFramework,
  type ShadcnStyling,
} from '@/utils/installation/shadcn';

interface Props {
  catalog: readonly ShadcnCatalogItem[];
  framework: ShadcnFramework;
}

const STYLING_OPTIONS = ['tailwind', 'css'] as const satisfies readonly ShadcnStyling[];

export default function ShadcnInstallCommand({ catalog, framework }: Props) {
  const $renderer = useStore(renderer);
  const $skin = useStore(skin);
  const $useCase = useStore(useCase);

  const installations = STYLING_OPTIONS.map((styling) => ({
    styling,
    result: resolveShadcnInstallation({
      catalog,
      framework,
      styling,
      useCase: $useCase,
      skin: $skin,
      renderer: $renderer,
    }),
  }));
  const selected = installations[0].result;

  if (selected.packageOnly) {
    return <p>The Background Video preset stays package-managed and is not published as editable registry source.</p>;
  }

  if (!selected.includesPlayer && !selected.includesMedia) {
    return (
      <p>
        This no-skin, native-media combination has no generated source to install. Use the packaged Player and media
        primitives, or choose a skin to install an editable Player block.
      </p>
    );
  }

  return (
    <>
      <p>
        Configure the <code>@videojs</code> namespace once, then run the command for your styling choice. Player blocks
        accept media as children; non-native media is installed beside the selected Player block.
      </p>
      <ClientCode
        code={`pnpm dlx shadcn@latest registry add '@videojs=https://shadcn.videojs.org/r/{name}.json'`}
        lang="bash"
      />
      <TabsRoot maxWidth={false}>
        <TabsList label="Editable source styling">
          <Tab value="tailwind" initial>
            Tailwind
          </Tab>
          <Tab value="css">Vanilla CSS</Tab>
        </TabsList>
        {installations.map(({ styling, result }, index) => {
          const command = shadcnAddCommand(result.items);

          return (
            <TabsPanel key={styling} value={styling} initial={index === 0}>
              {command ? <ClientCode code={command} lang="bash" /> : null}
            </TabsPanel>
          );
        })}
      </TabsRoot>
      {!selected.includesPlayer ? (
        <p>This installs the selected media facade only. Choose Default or Minimal to include a Player block.</p>
      ) : null}
    </>
  );
}
