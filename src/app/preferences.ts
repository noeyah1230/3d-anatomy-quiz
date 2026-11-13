import { useState } from 'react';

export function usePreference<T>(
  key: string,
  fallback: T,
  parse: (value: string) => T,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? fallback : parse(stored);
    } catch {
      return fallback;
    }
  });

  function update(next: T) {
    setValue(next);
    try {
      window.localStorage.setItem(
        key,
        typeof next === 'string' ? next : JSON.stringify(next),
      );
    } catch {
      // Preferences still work for this session if storage is unavailable.
    }
  }
  return [value, update] as const;
}

export function useTheme() {
  return usePreference<'dark' | 'light'>('anatomy.theme', 'dark', (value) =>
    value === 'light' ? 'light' : 'dark',
  );
}

export function useHighlight() {
  return usePreference<'red' | 'blue'>('anatomy.highlight', 'red', (value) =>
    value === 'blue' ? 'blue' : 'red',
  );
}
