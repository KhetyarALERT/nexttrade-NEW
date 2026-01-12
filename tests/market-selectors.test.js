import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCompactNumber, formatPrice, formatPercent, selectBestPair } from '../src/lib/market/selectors.js';

const makePair = (overrides = {}) => ({
  pairAddress: 'pair',
  chainId: 'solana',
  baseToken: { address: 'base', symbol: 'BASE', name: 'Base' },
  quoteToken: { address: 'quote', symbol: 'QUOTE', name: 'Quote' },
  ...overrides,
});

test('selectBestPair chooses highest liquidity then volume', () => {
  const low = makePair({ liquidityUsd: 1000, volume24h: 2000 });
  const high = makePair({ liquidityUsd: 5000, volume24h: 100 });
  const volume = makePair({ liquidityUsd: 5000, volume24h: 9000 });
  assert.equal(selectBestPair([low, high, volume]).volume24h, 9000);
});

test('formatCompactNumber handles ranges', () => {
  assert.equal(formatCompactNumber(1200), '1.20K');
  assert.equal(formatCompactNumber(2500000), '2.50M');
});

test('formatPrice handles small numbers', () => {
  assert.equal(formatPrice(0.0000009), '$9.00e-7');
  assert.equal(formatPrice(0.5), '$0.5000');
});

test('formatPercent shows sign', () => {
  assert.equal(formatPercent(2.3456), '+2.35%');
  assert.equal(formatPercent(-1.2), '-1.20%');
});
