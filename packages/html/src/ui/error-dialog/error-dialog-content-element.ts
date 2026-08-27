import type { DialogState } from '@videojs/core';
import { observeScrollOverflow } from '@videojs/core/dom';
import { ContextConsumer } from '@videojs/element/context';

import { ContextPartElement } from '../context-part-element';
import { dialogContext } from '../dialog/context';

/** Groups scrollable error copy and enters the tab order only when the content overflows. */
export class ErrorDialogContentElement extends ContextPartElement<DialogState> {
  static readonly tagName = 'media-error-dialog-content';

  protected readonly consumer = new ContextConsumer(this, { context: dialogContext, subscribe: true });

  #stopObservingOverflow: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();

    this.#stopObservingOverflow = observeScrollOverflow(this, (overflowing) => {
      this.tabIndex = overflowing ? 0 : -1;
    });
  }

  override disconnectedCallback(): void {
    this.#stopObservingOverflow?.();
    this.#stopObservingOverflow = null;
    super.disconnectedCallback();
  }
}
