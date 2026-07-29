import type { CSSProperties, PropsWithChildren } from 'react';

export type BaseSkinProps<T = unknown> = PropsWithChildren<
  T & {
    style?: CSSProperties;
    className?: string;
  }
>;

export type BaseVideoSkinProps<T = unknown> = BaseSkinProps<T> & {
  /**
   * Low-resolution placeholder shown behind the poster while it loads (blur-up
   * effect). A different concept from the poster itself, and a different image.
   */
  placeholder?: string | undefined;
};
