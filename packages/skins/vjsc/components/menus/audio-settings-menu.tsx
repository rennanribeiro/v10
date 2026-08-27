import type { MenuProps } from '@videojs/core';
import * as $ from '@videojs/core/vjsc';
import { type Props, Template } from 'vjsc/components';

import type { SkinComponentMeta } from '../../meta';
import buttonStyles from '../../styles/buttons/button.styles';
import playbackRateButtonStyles from '../../styles/buttons/playback-rate-button.styles';
import styles from '../../styles/menus/menu.styles';
import popupStyles from '../../styles/popups/popup.styles';
import surfaceStyles from '../../styles/surfaces/surface.styles';
import { ButtonTooltip } from '../buttons/button-tooltip';
import { PlaybackRateRadioGroup } from './radio-group';
import { RadioItem } from './radio-item';

export function AudioSettingsMenu({ className, ...props }: Props<MenuProps> = {}) {
  return (
    <$.Menu.Root side="top" align="center" boundary="viewport" {...props}>
      <ButtonTooltip side="top">
        <$.Menu.Trigger>
          <$.PlaybackRateButton className={[buttonStyles.root, playbackRateButtonStyles.root]} />
        </$.Menu.Trigger>
      </ButtonTooltip>
      <$.Menu.Popup
        keepMounted
        className={[popupStyles.root, popupStyles.safeArea, surfaceStyles.root, styles.popup, className]}
      >
        <$.Menu.Content className={styles.content}>
          <PlaybackRateRadioGroup>
            <Template name="playback-rate-option">
              <RadioItem>
                <Template.Part name="label" />
              </RadioItem>
            </Template>
          </PlaybackRateRadioGroup>
        </$.Menu.Content>
      </$.Menu.Popup>
    </$.Menu.Root>
  );
}

export const meta = {
  name: 'audio-settings-menu',
  type: 'component',
  title: 'Audio Settings Menu',
  description: 'A standalone audio settings menu for selecting playback speed.',
} as const satisfies SkinComponentMeta;
