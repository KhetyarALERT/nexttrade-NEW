import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOkxSymbol, formatOkxSymbolDisplay, getOkxBaseAsset } from '../src/lib/market/okxSymbols.js';

test('normalizeOkxSymbol normalizes common formats', () => {
  assert.equal(normalizeOkxSymbol('btcusdt'), 'BTC-USDT-SWAP');
  assert.equal(normalizeOkxSymbol('BTC-USDT'), 'BTC-USDT-SWAP');
  assert.equal(normalizeOkxSymbol('BTC-USDT-SWAP'), 'BTC-USDT-SWAP');
});

test('formatOkxSymbolDisplay renders display symbol', () => {
  assert.equal(formatOkxSymbolDisplay('BTC-USDT-SWAP'), 'BTC/USDT');
});

test('getOkxBaseAsset extracts base', () => {
  assert.equal(getOkxBaseAsset('ETH-USDT-SWAP'), 'ETH');
});
