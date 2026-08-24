import { camelCase, pascalCase } from '@videojs/utils/string';

const PASCAL_CASE_ICON_NAME_OVERRIDES = {
  'airplay-enter': 'AirPlayEnter',
  'airplay-exit': 'AirPlayExit',
} satisfies Record<string, string>;

const CAMEL_CASE_ICON_NAME_OVERRIDES = {
  'airplay-enter': 'airPlayEnter',
  'airplay-exit': 'airPlayExit',
} satisfies Record<string, string>;

/** Resolve an SVG filename stem to the identifiers used by every icon target. */
export function iconNames(value: string) {
  return {
    pascal: PASCAL_CASE_ICON_NAME_OVERRIDES[value] ?? pascalCase(value),
    camel: CAMEL_CASE_ICON_NAME_OVERRIDES[value] ?? camelCase(value),
  } satisfies { pascal: string; camel: string };
}
