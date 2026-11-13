/** Small integer helpers shared by the pattern and picture engines. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n;
export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;
export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
