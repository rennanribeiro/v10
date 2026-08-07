import './styles.css';
import type { SeekButtonProps } from '@videojs/core';
import { SeekButton as SeekButtonPrimitive } from '@videojs/react';
import { SeekIcon } from './icons';
import { button, buttonIcon, seekLabel } from '../styles/components/button.styles';
import { ButtonTooltip } from '../button-tooltip/button-tooltip';
import { cn } from '@videojs/utils/style';
export function SeekButton(props: SeekButtonProps = {}) {
  const seconds = props.seconds ?? 10;
  return (
    <ButtonTooltip>
      <SeekButtonPrimitive className={cn(button.seek)} {...props} seconds={seconds}>
        <SeekIcon className={cn(seconds < 0 ? buttonIcon.seekBackward : buttonIcon.base)} />
        <span className={cn(seekLabel)}>{Math.abs(seconds)}</span>
      </SeekButtonPrimitive>
    </ButtonTooltip>
  );
}
