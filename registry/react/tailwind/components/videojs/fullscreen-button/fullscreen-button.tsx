import '../styles/tailwind.css';
import { FullscreenButton as FullscreenButtonPrimitive } from '@videojs/react';
import { FullscreenEnterIcon, FullscreenExitIcon } from './icons';
import { button, buttonIcon } from '../styles/components/button.tailwind';
import { ButtonTooltip } from '../button-tooltip/button-tooltip';
import { cn } from '@videojs/utils/style';
export function FullscreenButton() {
  return (
    <ButtonTooltip>
      <FullscreenButtonPrimitive className={cn(button.fullscreen)}>
        <FullscreenEnterIcon className={cn(buttonIcon.fullscreenEnter)} />
        <FullscreenExitIcon className={cn(buttonIcon.fullscreenExit)} />
      </FullscreenButtonPrimitive>
    </ButtonTooltip>
  );
}
