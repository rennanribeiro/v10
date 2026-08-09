import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Menu } from '../index';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Fixture() {
  return (
    <Menu.Root defaultOpen>
      <Menu.Trigger>Settings</Menu.Trigger>
      <Menu.TransitionRoot render={<Menu.Content data-testid="container" />} className="root-panel">
        <Menu.Item>Copy link</Menu.Item>
        <Menu.TransitionView render={<Menu.Root />}>
          <Menu.Trigger>Quality</Menu.Trigger>
          <Menu.Content data-testid="quality-panel">
            <Menu.Item>Back</Menu.Item>
            <Menu.Item>Auto</Menu.Item>
          </Menu.Content>
        </Menu.TransitionView>
      </Menu.TransitionRoot>
    </Menu.Root>
  );
}

describe('Menu transition parts', () => {
  it('generates the root panel and navigates from committed child state', async () => {
    render(<Fixture />);
    const container = await screen.findByTestId('container');
    const root = container.querySelector<HTMLElement>('[data-menu-root-view]');

    expect(root).not.toBeNull();
    expect(root?.classList.contains('root-panel')).toBe(true);
    expect(root?.getAttribute('data-view-state')).toBe('active');
    expect(root?.hasAttribute('data-open')).toBe(false);
    expect(root?.hasAttribute('data-starting-style')).toBe(false);
    expect(root?.hasAttribute('data-ending-style')).toBe(false);
    expect(container.querySelectorAll('[data-menu-root-view]')).toHaveLength(1);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Quality' }));

    const child = await screen.findByTestId('quality-panel');
    expect(child.parentElement).toBe(container);
    expect(child.hasAttribute('data-submenu')).toBe(true);
    expect(child.hasAttribute('data-open')).toBe(true);
    expect(child.getAttribute('data-view-state')).toBe('active');
    expect(child.getAttribute('data-direction')).toBe('forward');
    expect(root?.getAttribute('data-view-state')).toBe('inactive');
    expect(root?.getAttribute('aria-hidden')).toBe('true');
    expect(root?.hasAttribute('inert')).toBe(true);
    expect(root?.hasAttribute('hidden')).toBe(false);
  });

  it('uses an ordinary item as a back row and restores the root panel', async () => {
    render(<Fixture />);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Quality' }));
    const child = await screen.findByTestId('quality-panel');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Back' }));

    await waitFor(() => expect(child.getAttribute('data-view-state')).toBe('inactive'));
    const root = screen.getByTestId('container').querySelector('[data-menu-root-view]');
    expect(root?.getAttribute('data-view-state')).toBe('active');
    expect(root?.getAttribute('data-direction')).toBe('back');
  });

  it('delegates initial and restored focus to the bound child Menu lifecycle', async () => {
    render(<Fixture />);
    const trigger = await screen.findByRole('menuitem', { name: 'Quality' });
    const child = await screen.findByTestId('quality-panel');
    const back = child.querySelector<HTMLElement>('[role="menuitem"]')!;
    const triggerFocus = vi.spyOn(trigger, 'focus');
    const backFocus = vi.spyOn(back, 'focus');

    fireEvent.click(trigger);

    await waitFor(() => expect(backFocus).toHaveBeenCalledTimes(1));
    fireEvent.click(back);
    await waitFor(() => expect(child.getAttribute('data-view-state')).toBe('inactive'));
    await waitFor(() => expect(triggerFocus).toHaveBeenCalledTimes(1));
  });

  it('publishes measured size through the stable Menu CSS variables', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this === document.documentElement) return new DOMRect(0, 0, 200, 200);
      const constrained = this.style.getPropertyValue('max-width').includes('--media-menu-available-width');
      return new DOMRect(0, 0, constrained ? 200 : 240, 120);
    });

    render(
      <Menu.Root defaultOpen boundary="viewport">
        <Menu.Trigger>Settings</Menu.Trigger>
        <Menu.TransitionRoot render={<Menu.Content data-testid="sized-container" />}>
          <Menu.Item>Copy link</Menu.Item>
        </Menu.TransitionRoot>
      </Menu.Root>
    );

    const container = await screen.findByTestId('sized-container');
    await waitFor(() => expect(container.style.getPropertyValue('--media-menu-width')).not.toBe(''));
    expect(container.style.getPropertyValue('--media-menu-width')).toBe(
      container.style.getPropertyValue('--media-menu-available-width')
    );
    expect(container.style.getPropertyValue('--media-menu-height')).toBe('120px');
  });

  it('supports ArrowRight, ArrowLeft, and Escape only in the opt-in binding', async () => {
    render(<Fixture />);
    const trigger = await screen.findByRole('menuitem', { name: 'Quality' });

    fireEvent.keyDown(trigger, { key: 'ArrowRight' });
    const child = await screen.findByTestId('quality-panel');
    await waitFor(() => expect(child.getAttribute('data-view-state')).toBe('active'));
    fireEvent.keyDown(child, { key: 'ArrowLeft' });
    await waitFor(() => expect(child.getAttribute('data-view-state')).toBe('inactive'));

    fireEvent.click(trigger);
    await waitFor(() => expect(child.getAttribute('data-view-state')).toBe('active'));
    fireEvent.keyDown(child, { key: 'Escape' });
    await waitFor(() => expect(child.getAttribute('data-view-state')).toBe('inactive'));
    expect(screen.getByTestId('container').isConnected).toBe(true);
  });

  it('does not transition after a controlled child rejects an open request', async () => {
    const onOpenChange = vi.fn();

    function ControlledFixture() {
      const [open, setOpen] = useState(false);
      return (
        <Menu.Root defaultOpen>
          <Menu.Trigger>Settings</Menu.Trigger>
          <Menu.TransitionRoot render={<Menu.Content data-testid="container" />}>
            <button type="button" onClick={() => setOpen(true)}>
              Commit child
            </button>
            <Menu.TransitionView render={<Menu.Root open={open} onOpenChange={onOpenChange} />}>
              <Menu.Trigger>Quality</Menu.Trigger>
              <Menu.Content data-testid="quality-panel">Quality options</Menu.Content>
            </Menu.TransitionView>
          </Menu.TransitionRoot>
        </Menu.Root>
      );
    }

    render(<ControlledFixture />);
    const root = (await screen.findByTestId('container')).querySelector('[data-menu-root-view]');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Quality' }));

    expect(onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'click' }));
    expect(root?.getAttribute('data-view-state')).toBe('active');
    expect(screen.getByTestId('quality-panel').getAttribute('data-view-state')).toBe('inactive');
    expect(screen.getByTestId('quality-panel').hasAttribute('hidden')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Commit child' }));
    expect((await screen.findByTestId('quality-panel')).getAttribute('data-view-state')).toBe('active');
  });

  it('honors preventDefault on a child-view trigger', async () => {
    render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Settings</Menu.Trigger>
        <Menu.TransitionRoot render={<Menu.Content />}>
          <Menu.TransitionView render={<Menu.Root />}>
            <Menu.Trigger onClick={(event) => event.preventDefault()}>Quality</Menu.Trigger>
            <Menu.Content data-testid="quality-panel">Quality</Menu.Content>
          </Menu.TransitionView>
        </Menu.TransitionRoot>
      </Menu.Root>
    );

    fireEvent.click(await screen.findByRole('menuitem', { name: 'Quality' }));

    expect(screen.getByTestId('quality-panel').getAttribute('data-view-state')).toBe('inactive');
  });
});
