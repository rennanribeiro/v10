import '../styles/tailwind.css';
import type { VolumeSliderProps } from '@videojs/core';
import { VolumeSlider as VolumeSliderPrimitive } from '@videojs/react';
import { slider } from '../styles/components/slider.tailwind';
import { cn } from '@videojs/utils/style';
export function VolumeSlider(props: VolumeSliderProps = {}) {
  return (
    <VolumeSliderPrimitive.Root className={cn(slider.root)} thumbAlignment="edge" {...props}>
      <VolumeSliderPrimitive.Track className={cn(slider.track)}>
        <VolumeSliderPrimitive.Fill className={cn(slider.fill)} />
      </VolumeSliderPrimitive.Track>
      <VolumeSliderPrimitive.Thumb className={cn(slider.thumb)} />
    </VolumeSliderPrimitive.Root>
  );
}
