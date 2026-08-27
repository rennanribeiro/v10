import { afterEach, describe, expect, it } from 'vite-plus/test';

import { registerIcons } from '../element/register';

let familyId = 0;

afterEach(() => {
  document.body.replaceChildren();
});

describe('registerIcons', () => {
  it('merges exact overlapping icon registrations', () => {
    const family = `test-exact-icons-${familyId++}`;

    registerIcons(family, { play: '<svg data-icon="play"></svg>' });
    registerIcons(family, { pause: '<svg data-icon="pause"></svg>' });

    const play = document.createElement('media-icon');
    const pause = document.createElement('media-icon');

    for (const [icon, name] of [
      [play, 'play'],
      [pause, 'pause'],
    ] as const) {
      icon.setAttribute('family', family);
      icon.setAttribute('name', name);
      document.body.append(icon);
    }

    expect(play.querySelector('svg')?.dataset.icon).toBe('play');
    expect(pause.querySelector('svg')?.dataset.icon).toBe('pause');
  });
});
