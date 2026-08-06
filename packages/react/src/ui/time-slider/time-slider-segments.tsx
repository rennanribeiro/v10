'use client';

import { getChapterSegments } from '@videojs/core';
import { forwardRef } from 'react';
import { useTextTrack } from '../../player/use-text-track';
import { useSliderContext } from '../slider/context';
import { SliderSegments, type SliderSegmentsProps } from '../slider/slider-segments';

export interface TimeSliderSegmentsProps extends Omit<SliderSegmentsProps, 'segments'> {}

/** Renders chapter cues from the player store as slider segments. */
export const TimeSliderSegments = forwardRef<SVGSVGElement, TimeSliderSegmentsProps>(
  function TimeSliderSegments(props, ref) {
    const cues = useTextTrack('chapters')?.cues ?? [];
    const { min, max } = useSliderContext();
    const segments = getChapterSegments(cues, min, max);

    return <SliderSegments ref={ref} {...props} segments={segments} />;
  }
);

export namespace TimeSliderSegments {
  export type Props = TimeSliderSegmentsProps;
  export type State = SliderSegments.State;
}
