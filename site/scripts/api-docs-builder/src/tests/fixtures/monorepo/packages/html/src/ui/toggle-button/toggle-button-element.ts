/**
 * HTML element fixture for single-part component.
 *
 * Exercises: static tagName extraction for platforms.html.
 */

export class ToggleButtonElement {
  static readonly tagName = 'media-toggle-button';

  static readonly properties = {
    disabled: { type: Boolean },
    label: { type: String },
  };
}
