// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';

vi.mock('../../src/features/anatomy/AnatomyViewer', () => ({
  default: () => <div>Viewer mounted</div>,
}));

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('starts with red and persists blue and light theme across mounts', async () => {
  const firstMount = render(<App />);
  await screen.findByText('Viewer mounted');
  expect(
    screen.getByRole('button', { name: 'Red' }).getAttribute('aria-pressed'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Light theme' }));
  firstMount.unmount();
  render(<App />);
  expect(
    screen.getByRole('button', { name: 'Blue' }).getAttribute('aria-pressed'),
  ).toBe('true');
  expect(screen.getByRole('button', { name: 'Dark theme' })).toBeTruthy();
});
