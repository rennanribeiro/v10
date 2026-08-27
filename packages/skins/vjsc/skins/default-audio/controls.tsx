import * as $ from '@videojs/core/vjsc';
import { Box } from 'vjsc/components';

import { AudioPlayButton } from '../../components/buttons/audio-play-button';
import { SeekButton } from '../../components/buttons/seek-button';
import { VolumePopover } from '../../components/controls/volume-popover';
import { PlaybackRateMenu } from '../../components/menus/playback-rate-menu';
import { AudioTimeSlider } from '../../components/sliders/audio-time-slider';
import surfaceStyles from '../../styles/surfaces/surface.styles';
import styles from './controls.styles';

export function DefaultAudioControls() {
  return (
    <Box className={styles.provider}>
      <Box className={[surfaceStyles.root, styles.root]}>
        <$.Tooltip.Provider>
          <Box className={styles.start}>
            <AudioPlayButton />
            <SeekButton className={styles.seekButton} seconds={-10} />
            <SeekButton className={styles.seekButton} seconds={10} />
          </Box>

          <Box className={styles.timeSliderGroup}>
            <$.Time.Value className={styles.currentValue} type="current" />
            <AudioTimeSlider />
            <$.Time.Value className={styles.remainingValue} type="remaining" toggle />
          </Box>

          <Box className={styles.end}>
            <PlaybackRateMenu />
            <VolumePopover />
          </Box>
        </$.Tooltip.Provider>
      </Box>
    </Box>
  );
}
