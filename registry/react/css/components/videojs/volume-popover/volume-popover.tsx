import './styles.css';
import { Popover } from '@videojs/react';
import { volumePopover } from '../styles/components/popup.styles';
import { MuteButton } from '../mute-button/mute-button';
import { VolumeSlider } from '../volume-slider/volume-slider';
import { cn } from '@videojs/utils/style';
export function VolumePopover() {
  return (
    <Popover.Root openOnHover delay={200} closeDelay={100} side="top">
      <Popover.Trigger render={<MuteButton />} />
      <Popover.Popup className={cn(volumePopover)}>
        <VolumeSlider orientation="vertical" />
      </Popover.Popup>
    </Popover.Root>
  );
}
