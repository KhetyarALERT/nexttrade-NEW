import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchGeckoOhlcv } from '../src/lib/market/geckoterminal.js';

test('fetchGeckoOhlcv returns mock OHLCV data', async () => {
  const result = await fetchGeckoOhlcv({
    poolAddress: 'mock-pool',
    timeframe: 'minute',
    aggregate: 1,
    limit: 12,
  });

  assert.ok(result?.data?.attributes?.ohlcv_list, 'Expected OHLCV list');
  assert.equal(result.data.attributes.ohlcv_list.length, 12);
  const [time, open, high, low, close, volume] = result.data.attributes.ohlcv_list[0];
  assert.equal(typeof time, 'number');
  assert.equal(typeof open, 'number');
  assert.equal(typeof high, 'number');
  assert.equal(typeof low, 'number');
  assert.equal(typeof close, 'number');
  assert.equal(typeof volume, 'number');
});
