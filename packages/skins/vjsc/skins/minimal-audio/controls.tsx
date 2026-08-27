import * as $ from '@videojs/core/vjsc';
import { Box } from 'vjsc/components';

import { AudioPlayButton } from '../../components/buttons/audio-play-button';
import { SeekButton } from '../../components/buttons/seek-button';
import { VolumePopover } from '../../components/controls/volume-popover';
import { PlaybackRateMenu } from '../../components/menus/playback-rate-menu';
import { AudioTimeSlider } from '../../components/sliders/audio-time-slider';
import surfaceStyles from '../../styles/surfaces/surface.styles';
import styles from './controls.styles';

export function MinimalAudioControls() {
  return (
    <Box className={styles.provider}>
      <Box className={[surfaceStyles.root, styles.root]}>
        <$.Tooltip.Provider>
          <Box className={styles.start}>
            <AudioPlayButton />
            <SeekButton seconds={-10} />
            <SeekButton seconds={10} />
          </Box>

          <Box className={styles.timeSliderGroup}>
            <$.Time.Group className={styles.timeGroup}>
              <$.Time.Value className={styles.currentValue} type="current" toggle />
              <$.Time.Separator className={styles.timeSeparator} />
              <$.Time.Value className={styles.durationValue} type="duration" />
            </$.Time.Group>
            <AudioTimeSlider />
          </Box>

          <Box className={styles.end}>
            <VolumePopover showTooltip side="left" orientation="horizontal" />
            <PlaybackRateMenu />
          </Box>
        </$.Tooltip.Provider>
      </Box>
    </Box>
  );
}
