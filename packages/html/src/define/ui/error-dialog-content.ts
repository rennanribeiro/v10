import { safeDefine } from '../../registration/safe-define';
import { ErrorDialogContentElement } from '../../ui/error-dialog/error-dialog-content-element';

safeDefine(ErrorDialogContentElement);

declare global {
  interface HTMLElementTagNameMap {
    [ErrorDialogContentElement.tagName]: ErrorDialogContentElement;
  }
}
