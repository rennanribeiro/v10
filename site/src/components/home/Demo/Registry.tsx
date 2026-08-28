import { useStore } from '@nanostores/react';

import { framework, skin } from '@/stores/homePageDemos';

interface RegistryDemoProps {
  className?: string;
  defaultHtml: React.ReactNode;
  defaultReact: React.ReactNode;
  minimalHtml: React.ReactNode;
  minimalReact: React.ReactNode;
}

export default function RegistryDemo(props: RegistryDemoProps) {
  const $framework = useStore(framework);
  const $skin = useStore(skin);

  const command =
    $framework === 'html'
      ? $skin === 'default'
        ? props.defaultHtml
        : props.minimalHtml
      : $skin === 'default'
        ? props.defaultReact
        : props.minimalReact;

  return (
    <div className={['bg-faded-black dark:bg-soot overflow-auto p-2.5', props.className].filter(Boolean).join(' ')}>
      {command}
    </div>
  );
}
