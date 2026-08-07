import { MuteButton as MuteButtonPrimitive } from '@videojs/core/components';
import { VolumeHighIcon, VolumeLowIcon, VolumeOffIcon } from '@videojs/icons/components';
import { button, buttonIcon } from '../../styles/components/button.tailwind';

export function MuteButton(props: Parameters<typeof MuteButtonPrimitive>[0]) {
  return (
    <MuteButtonPrimitive {...props} className={button.mute}>
      <VolumeOffIcon className={buttonIcon.volumeOff} />
      <VolumeLowIcon className={buttonIcon.volumeLow} />
      <VolumeHighIcon className={buttonIcon.volumeHigh} />
    </MuteButtonPrimitive>
  );
}
