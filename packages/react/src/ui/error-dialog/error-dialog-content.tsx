import type { DialogCore } from '@videojs/core';
import { observeScrollOverflow } from '@videojs/core/dom';
import { forwardRef, useLayoutEffect, useRef, useState } from 'react';

import type { UIComponentProps } from '../../utils/types';
import { useComposedRefs } from '../../utils/use-composed-refs';
import { renderElement } from '../../utils/use-render';
import { useDialogContext } from '../dialog/context';

export interface ErrorDialogContentProps extends UIComponentProps<'div', DialogCore.State> {}

/** Groups scrollable error copy and enters the tab order only when the content overflows. */
export const ErrorDialogContent = forwardRef<HTMLDivElement, ErrorDialogContentProps>(function ErrorDialogContent(
  { render, className, style, ...elementProps },
  forwardedRef
) {
  const { state, stateAttrMap } = useDialogContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const composedRef = useComposedRefs(forwardedRef, contentRef);

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    return observeScrollOverflow(element, setOverflowing);
  }, []);

  return renderElement(
    'div',
    { render, className, style },
    {
      state,
      stateAttrMap,
      ref: composedRef,
      props: [{ tabIndex: overflowing ? 0 : -1 }, elementProps],
    }
  );
});

export namespace ErrorDialogContent {
  export type Props = ErrorDialogContentProps;
  export type State = DialogCore.State;
}
