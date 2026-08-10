import { useMemo } from 'react';
import { getPosterPlaceholderSrc } from '../sources';
import { useSource } from './use-source';

export function usePosterPlaceholder() {
  const source = useSource();
  return useMemo(() => getPosterPlaceholderSrc(source), [source]);
}
