import type { MenuOptionState } from '@videojs/core';
import { forwardRef } from 'react';

import type { UIComponentProps } from '../../utils/types';
import { renderElement } from '../../utils/use-render';
import { useMenuContext } from './context';

const emptyOptionState: MenuOptionState = { value: '', disabled: true, availability: 'unsupported' };

export interface MenuValueProps extends UIComponentProps<'span', MenuOptionState> {}

/** Displays the selected value published by the option group in this menu. */
export const MenuValue = forwardRef<HTMLSpanElement, MenuValueProps>(function MenuValue(
  { render, className, style, ...elementProps },
  forwardedRef
) {
  const { optionState } = useMenuContext();
  const state = optionState ?? emptyOptionState;

  return renderElement(
    'span',
    { render, className, style },
    { state, ref: forwardedRef, props: [{ children: state.value }, elementProps] }
  );
});

export namespace MenuValue {
  export type Props = MenuValueProps;
  export type State = MenuOptionState;
}
