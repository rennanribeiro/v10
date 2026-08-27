import * as $ from '@videojs/core/vjsc';
import { Box } from 'vjsc/components';

import { AudioPlayButton } from '../../components/buttons/audio-play-button';
import { LiveButton } from '../../components/buttons/live-button';
import { VolumePopover } from '../../components/controls/volume-popover';
import surfaceStyles from '../../styles/surfaces/surface.styles';
import styles from './controls.styles';

export function DefaultLiveAudioControls() {
  return (
    <Box className={styles.provider}>
      <Box className={[surfaceStyles.root, styles.root]}>
        <$.Tooltip.Provider>
          <Box className={styles.start}>
            <AudioPlayButton />
            <LiveButton />
          </Box>

          <Box aria-hidden="true" className={styles.spacer} />

          <Box className={styles.end}>
            <VolumePopover />
          </Box>
        </$.Tooltip.Provider>
      </Box>
    </Box>
  );
}
