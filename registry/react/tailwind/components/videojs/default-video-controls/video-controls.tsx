import '../styles/tailwind.css';
import { Controls, Time as TimePrimitive, Tooltip } from '@videojs/react';
import { FullscreenButton } from '../fullscreen-button/fullscreen-button';
import { PlayButton } from '../play-button/play-button';
import { SeekButton } from '../seek-button/seek-button';
import { VolumePopover } from '../volume-popover/volume-popover';
import { TimeSlider } from '../time-slider/time-slider';
import { controlsGroup, time, videoControls } from '../styles/skins/default-video-controls.tailwind';
import { cn } from '@videojs/utils/style';
const SEEK_SECONDS = 10;
export function DefaultVideoControls() {
  return (
    <Controls.Root className={cn(videoControls)}>
      <Tooltip.Provider>
        <Controls.Group className={cn(controlsGroup.base)}>
          <PlayButton />
          <SeekButton seconds={-SEEK_SECONDS} />
          <SeekButton seconds={SEEK_SECONDS} />
        </Controls.Group>

        <Controls.Group className={cn(controlsGroup.time)}>
          <TimePrimitive.Value className={cn(time)} type="current" />
          <TimeSlider />
          <TimePrimitive.Value className={cn(time)} type="remaining" toggle />
        </Controls.Group>

        <Controls.Group className={cn(controlsGroup.base)}>
          <VolumePopover />
          <FullscreenButton />
        </Controls.Group>
      </Tooltip.Provider>
    </Controls.Root>
  );
}
