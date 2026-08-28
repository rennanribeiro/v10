import type { MenuProps } from '@videojs/core';
import * as $ from '@videojs/core/vjsc';
import { CaptionsOffIcon, CaptionsOnIcon } from '@videojs/icons/vjsc';
import { type Props, Template } from 'vjsc/components';

import type { SkinComponentMeta } from '../../meta';
import buttonStyles from '../../styles/buttons/button.styles';
import captionsButtonStyles from '../../styles/buttons/captions-button.styles';
import styles from '../../styles/menus/menu.styles';
import { Button } from '../buttons/button';
import { ButtonTooltip } from '../buttons/button-tooltip';
import { CaptionsRadioGroup } from './radio-group';
import { RadioItem } from './radio-item';

export function CaptionsMenu({ className, ...props }: Props<MenuProps> = {}) {
  return (
    <$.Menu.Root side="top" align="center" boundary="viewport" {...props}>
      <ButtonTooltip side="top">
        <$.Menu.Trigger openWhen="multiple-options">
          <$.CaptionsButton $render={Button} className={captionsButtonStyles.root}>
            <CaptionsOffIcon className={[buttonStyles.icon, captionsButtonStyles.offIcon]} />
            <CaptionsOnIcon className={[buttonStyles.icon, captionsButtonStyles.onIcon]} />
          </$.CaptionsButton>
        </$.Menu.Trigger>
      </ButtonTooltip>
      <$.Menu.Popup keepMounted className={[styles.popup, className]}>
        <$.Menu.Content className={styles.content}>
          <CaptionsRadioGroup>
            <Template name="captions-option">
              <RadioItem>
                <Template.Part name="label" />
              </RadioItem>
            </Template>
          </CaptionsRadioGroup>
        </$.Menu.Content>
      </$.Menu.Popup>
    </$.Menu.Root>
  );
}

export const meta = {
  name: 'captions-menu',
  type: 'component',
  title: 'Captions Menu',
  description: 'An adaptive captions button that opens a track menu only when multiple tracks are available.',
} as const satisfies SkinComponentMeta;
