import { cleanup, render, renderHook } from '@testing-library/react';
import type { Media } from '@videojs/media';
import { Component, type ErrorInfo, type ReactNode, StrictMode, useEffect } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { createPlayerWrapper } from '../../testing/mocks';
import { useMediaInstance } from '../use-media-instance';

class TestMedia extends EventTarget {
  static instances: TestMedia[] = [];

  readonly engine = null;
  readonly destroy = vi.fn();

  constructor() {
    super();
    TestMedia.instances.push(this);
  }
}

const TestMediaClass = TestMedia as unknown as new () => TestMedia & Media;

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo) {}

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

beforeEach(() => {
  TestMedia.instances = [];
});

afterEach(cleanup);

describe('useMediaInstance', () => {
  it('exposes an explicit nullable readiness contract', () => {
    const { result } = renderHook(() => useMediaInstance(TestMediaClass));

    expectTypeOf(result.current).toEqualTypeOf<(TestMedia & Media) | null>();
    expect(result.current).toBe(TestMedia.instances[0]);
  });

  it('does not acquire during server rendering', () => {
    function ServerComponent() {
      const media = useMediaInstance(TestMediaClass);
      return <div data-ready={media ? 'true' : 'false'} />;
    }

    expect(renderToString(<ServerComponent />)).toContain('data-ready="false"');
    expect(TestMedia.instances).toHaveLength(0);
  });

  it('does not acquire from an abandoned render', () => {
    function Abandoned(): ReactNode {
      useMediaInstance(TestMediaClass);
      throw new Error('abandon render');
    }

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <Boundary>
        <Abandoned />
      </Boundary>
    );

    expect(TestMedia.instances).toHaveLength(0);
    consoleError.mockRestore();
  });

  it('runs setup before publishing and owns cleanup', () => {
    const events: string[] = [];
    const setup = vi.fn(() => events.push('setup'));
    const { value, Wrapper } = createPlayerWrapper();
    value.setMedia = vi.fn(() => events.push('publish'));

    const { result, unmount } = renderHook(() => useMediaInstance(TestMediaClass, setup), { wrapper: Wrapper });
    const instance = result.current!;

    expect(setup).toHaveBeenCalledOnce();
    expect(setup).toHaveBeenCalledWith(instance);
    expect(events).toEqual(['setup', 'publish']);
    expect(value.setMedia).toHaveBeenCalledWith(instance);

    unmount();

    expect(instance.destroy).toHaveBeenCalledOnce();
    const detach = vi.mocked(value.setMedia).mock.calls.at(-1)![0];
    expect(detach).toBeTypeOf('function');
    if (typeof detach === 'function') {
      expect(detach(instance)).toBeNull();
      expect(detach({} as Media)).not.toBeNull();
    }
  });

  it('acquires and publishes before passive effects', () => {
    const events: string[] = [];
    const { value, Wrapper } = createPlayerWrapper();
    value.setMedia = vi.fn(() => events.push('publish'));

    function PassiveProbe() {
      useEffect(() => {
        events.push('passive');
      }, []);

      return null;
    }

    function AcquisitionProbe() {
      const media = useMediaInstance(TestMediaClass, () => events.push('setup'));
      return <div data-ready={media ? 'true' : 'false'} />;
    }

    const { container } = render(
      <>
        <PassiveProbe />
        <AcquisitionProbe />
      </>,
      { wrapper: Wrapper }
    );

    expect(events).toEqual(['setup', 'publish', 'passive']);
    expect(container.firstElementChild?.getAttribute('data-ready')).toBe('true');
  });

  it('cleans up the old class before publishing its replacement', () => {
    class ReplacementMedia extends TestMedia {}

    const ReplacementMediaClass = ReplacementMedia as unknown as new () => ReplacementMedia & Media;
    const events: string[] = [];
    let current: Media | null = null;
    const { value, Wrapper } = createPlayerWrapper();
    value.setMedia = vi.fn((next) => {
      if (typeof next === 'function') {
        events.push('detach:old');
        current = next(current);
      } else {
        events.push(next instanceof ReplacementMedia ? 'publish:new' : 'publish:old');
        current = next;
      }
    });

    const { result, rerender } = renderHook(({ MediaClass }) => useMediaInstance(MediaClass), {
      initialProps: { MediaClass: TestMediaClass },
      wrapper: Wrapper,
    });
    const first = result.current!;
    first.destroy.mockImplementation(() => events.push('destroy:old'));
    events.length = 0;

    rerender({ MediaClass: ReplacementMediaClass });

    expect(events).toEqual(['detach:old', 'destroy:old', 'publish:new']);
    expect(current).toBe(result.current);
    expect(result.current).toBeInstanceOf(ReplacementMedia);
  });

  it('destroys an instance when setup fails before publication', () => {
    const error = new Error('setup failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      renderHook(() =>
        useMediaInstance(TestMediaClass, () => {
          throw error;
        })
      )
    ).toThrow(error);

    expect(TestMedia.instances).toHaveLength(1);
    expect(TestMedia.instances[0]!.destroy).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it('cleans up and reacquires during the StrictMode effect replay', () => {
    const setup = vi.fn();
    const { result, unmount } = renderHook(() => useMediaInstance(TestMediaClass, setup), {
      wrapper: StrictMode,
    });

    expect(TestMedia.instances).toHaveLength(2);
    expect(TestMedia.instances[0]!.destroy).toHaveBeenCalledOnce();
    expect(result.current).toBe(TestMedia.instances[1]);
    expect(setup).toHaveBeenCalledTimes(2);

    unmount();

    expect(TestMedia.instances[1]!.destroy).toHaveBeenCalledOnce();
  });
});
