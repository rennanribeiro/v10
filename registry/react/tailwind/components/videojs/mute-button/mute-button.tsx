import '../styles/tailwind.css';
import { MuteButton as MuteButtonPrimitive } from '@videojs/react';
import { VolumeHighIcon, VolumeLowIcon, VolumeOffIcon } from './icons';
import { button, buttonIcon } from '../styles/components/button.tailwind';
import { cn } from '@videojs/utils/style';
export function MuteButton(props: Parameters<typeof MuteButtonPrimitive>[0]) {
  return (
    <MuteButtonPrimitive {...props} className={cn(button.mute)}>
      <VolumeOffIcon className={cn(buttonIcon.volumeOff)} />
      <VolumeLowIcon className={cn(buttonIcon.volumeLow)} />
      <VolumeHighIcon className={cn(buttonIcon.volumeHigh)} />
    </MuteButtonPrimitive>
  );
}
