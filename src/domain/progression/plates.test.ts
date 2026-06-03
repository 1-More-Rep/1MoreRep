import { describe, it, expect } from 'vitest';
import { platesPerSide, closestLoadable } from './plates';

describe('plate calculator', () => {
  it('computes plates per side (greedy largest-first)', () => {
    expect(platesPerSide(100)).toEqual([25, 15]); // (100-20)/2 = 40 = 25+15
    expect(platesPerSide(60)).toEqual([20]); // (60-20)/2 = 20
  });

  it('returns empty for bar-only or below-bar', () => {
    expect(platesPerSide(20)).toEqual([]);
    expect(platesPerSide(15)).toEqual([]);
  });

  it('greedily uses the largest plates', () => {
    expect(platesPerSide(132.5)).toEqual([25, 25, 5, 1.25]); // 56.25 per side
  });

  it('closestLoadable rounds down to a loadable weight', () => {
    expect(closestLoadable(101)).toBe(100);
    expect(closestLoadable(20)).toBe(20);
  });
});
