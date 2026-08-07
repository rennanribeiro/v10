import '../styles/tailwind.css';
import { PlayButton as PlayButtonPrimitive } from '@videojs/react';
import { PauseIcon, PlayIcon, RestartIcon } from './icons';
import { button, buttonIcon } from '../styles/components/button.tailwind';
import { ButtonTooltip } from '../button-tooltip/button-tooltip';
import { cn } from '@videojs/utils/style';
export function PlayButton() {
  return (
    <ButtonTooltip>
      <PlayButtonPrimitive className={cn(button.play)}>
        <RestartIcon className={cn(buttonIcon.restart)} />
        <PlayIcon className={cn(buttonIcon.play)} />
        <PauseIcon className={cn(buttonIcon.pause)} />
      </PlayButtonPrimitive>
    </ButtonTooltip>
  );
}
