import { defineRenderTarget } from 'vjsc/components';

import type { SkinComponentMeta } from '../../meta';
import styles from '../../styles/buttons/button.styles';

/** Shared generated button host carrying the selected skin's base button styles. */
export const Button = defineRenderTarget('Button', styles.root);

export const meta = {
  name: 'button',
  type: 'component',
  title: 'Button',
  description: 'The shared styled host used by generated media buttons.',
} as const satisfies SkinComponentMeta;
