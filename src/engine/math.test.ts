import { clamp, gcd, lcm, mod } from './math';

test('integer helpers', () => {
  expect(mod(-1, 4)).toBe(3);
  expect(gcd(12, 8)).toBe(4);
  expect(lcm(4, 6)).toBe(12);
  expect(clamp(200, 4, 120)).toBe(120);
});
