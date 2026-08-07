import '../styles/tailwind.css';
import { Slider, TimeSlider as TimeSliderPrimitive } from '@videojs/react';
import { SpinnerIcon } from './icons';
import { slider, thumbnail } from '../styles/components/slider.tailwind';
import { cn } from '@videojs/utils/style';
export function TimeSlider() {
  return (
    <TimeSliderPrimitive.Root className={cn(slider.root)} thumbAlignment="edge">
      <TimeSliderPrimitive.Track className={cn(slider.track)}>
        <TimeSliderPrimitive.Fill className={cn(slider.fill)} />
        <TimeSliderPrimitive.Buffer className={cn(slider.buffer)} />
      </TimeSliderPrimitive.Track>
      <TimeSliderPrimitive.Thumb className={cn(slider.thumb)} />
      <div className={cn(thumbnail.root)}>
        <Slider.Thumbnail className={cn(thumbnail.image)} />
        <TimeSliderPrimitive.Value className={cn(slider.value)} type="pointer" />
        <SpinnerIcon className={cn('size-media-icon drop-shadow-media-icon')} />
      </div>
      <TimeSliderPrimitive.Preview className={cn(slider.preview)}>
        <TimeSliderPrimitive.Value className={cn(slider.value)} type="pointer" />
      </TimeSliderPrimitive.Preview>
    </TimeSliderPrimitive.Root>
  );
}
