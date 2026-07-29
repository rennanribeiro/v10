import { describe, expect, it, vi } from 'vitest';

import {
  isMediaContentPosterAltCapable,
  isMediaContentPosterCapable,
  isMediaContentTitleCapable,
} from '../../core/predicate';
import { HTMLMediaElementHost, type HTMLMediaTargetLike } from '../media-host';

class TestHost extends HTMLMediaElementHost<HTMLMediaTargetLike, Record<string, Event>> {}

describe('HTMLMediaElementHost content metadata', () => {
  it('reports null rather than an empty string when nothing has been set', () => {
    const host = new TestHost();

    expect(host.contentTitle).toBeNull();
    expect(host.contentPoster).toBeNull();
    expect(host.contentPosterAlt).toBeNull();
  });

  it('dispatches a change event when a value is assigned', () => {
    const host = new TestHost();
    const listener = vi.fn();

    host.addEventListener('contenttitlechange', listener);
    host.contentTitle = 'A title';

    expect(host.contentTitle).toBe('A title');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch when the value is unchanged', () => {
    const host = new TestHost();
    const listener = vi.fn();

    host.contentTitle = 'A title';
    host.addEventListener('contenttitlechange', listener);
    host.contentTitle = 'A title';

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps an empty string as a real value distinct from absence', () => {
    const host = new TestHost();
    const listener = vi.fn();

    host.addEventListener('contenttitlechange', listener);
    host.contentTitle = '';

    expect(host.contentTitle).toBe('');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('normalises a cleared value to null so the host stays capable', () => {
    const host = new TestHost();

    host.contentTitle = 'A title';
    host.contentTitle = undefined;

    expect(host.contentTitle).toBeNull();
    expect(isMediaContentTitleCapable(host)).toBe(true);
  });

  it('dispatches a separate event per field', () => {
    const host = new TestHost();
    const title = vi.fn();
    const poster = vi.fn();
    const posterAlt = vi.fn();

    host.addEventListener('contenttitlechange', title);
    host.addEventListener('contentposterchange', poster);
    host.addEventListener('contentposteraltchange', posterAlt);

    host.contentPoster = 'poster.jpg';

    expect(poster).toHaveBeenCalledTimes(1);
    expect(title).not.toHaveBeenCalled();
    expect(posterAlt).not.toHaveBeenCalled();
  });

  it('keeps content metadata separate from the element’s own title and poster', () => {
    const host = new TestHost();

    host.contentTitle = 'Content title';

    // `title` is the developer's setting on the element and is a different
    // concept; the two are deliberately not reconciled.
    expect(host.title).toBe('');
    expect(host.contentTitle).toBe('Content title');
  });
});

describe('content metadata predicates', () => {
  it('report capable for any host carrying the declaration', () => {
    const host = new TestHost();

    expect(isMediaContentTitleCapable(host)).toBe(true);
    expect(isMediaContentPosterCapable(host)).toBe(true);
    expect(isMediaContentPosterAltCapable(host)).toBe(true);
  });

  it('report not capable for a media that does not declare the property', () => {
    expect(isMediaContentTitleCapable({ paused: true })).toBe(false);
    expect(isMediaContentPosterCapable({ paused: true })).toBe(false);
    expect(isMediaContentPosterAltCapable({ paused: true })).toBe(false);
  });

  it('report capable when the value is null, so capability cannot flicker', () => {
    expect(isMediaContentTitleCapable({ contentTitle: null })).toBe(true);
  });

  it('report not capable when the value is undefined', () => {
    expect(isMediaContentTitleCapable({ contentTitle: undefined })).toBe(false);
  });
});
