import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import scope from '../../src/data/scope/muscle_scope_v1.json';

it('preserves the exact imported curriculum and all 46 unique IDs', () => {
  const file = new URL(
    '../../src/data/scope/muscle_scope_v1.json',
    import.meta.url,
  );
  expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(
    '9f0b034adb332a18368127b1dfeaff3e7b41acda106101751b454e48e65dc483',
  );
  expect(scope.targets).toHaveLength(46);
  expect(new Set(scope.targets.map(({ id }) => id)).size).toBe(46);
  expect(new Set(scope.targets.map(({ region }) => region)).size).toBe(9);
});
