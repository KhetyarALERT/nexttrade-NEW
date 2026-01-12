import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tMemeCoins } from '../src/lib/i18n/memecoins.js';

const requiredKeys = [
  'pageTitle',
  'pageSubtitle',
  'discover',
  'discoverHelp',
  'watchlist',
  'watchlistHelp',
  'sort',
  'sortHelp',
  'sortTrending',
  'sortVolume',
  'sortLiquidity',
  'sortGainers',
  'sortLosers',
  'sortNew',
  'searchLabel',
  'searchHelp',
  'searchPlaceholder',
  'minLiquidityShort',
  'minLiquidityHelp',
  'minVolumeShort',
  'minVolumeHelp',
  'maxAgeShort',
  'maxAgeHelp',
  'dataUnavailable',
  'newBadge',
  'addWatchlist',
  'removeWatchlist',
  'selectTokenToViewChart',
  'selectTokenToTrade',
  'chartTitle',
  'timeframeLabel',
  'timeframeHelp',
  'amountLabel',
  'amountHelp',
  'amountChipHelp',
  'max',
  'maxHelp',
  'balanceLabel',
  'slippage',
  'slippageHelp',
  'slippageAuto',
  'slippageAutoHelp',
  'slippageManual',
  'slippageManualHelp',
  'priorityFee',
  'priorityFeeHelp',
  'buyHelp',
  'sellHelp',
  'tradeCtaHelp',
  'tradePanelHelp',
  'advanced',
  'advancedHelp',
  'switchSide',
  'switchSideHelp',
  'tokenInfoTitle',
  'overviewTab',
  'socialsTab',
  'safetyTab',
  'holdersTab',
  'txnsLabel',
  'pairAgeLabel',
  'dexLabel',
  'contractLabel',
  'copyAddressHelp',
  'noSocials',
  'safetyTitle',
  'safetyNote',
  'holdersHelp',
  'viewHolders',
  'openLink',
  'confirmTradeTitle',
  'confirmTradeCta',
  'confirmSide',
  'executionSoonTitle',
  'executionSoonDetail',
  'listTab',
  'chartTab',
  'tradeTab',
];

test('meme coins i18n provides required keys in English', () => {
  const t = tMemeCoins('en');
  requiredKeys.forEach((key) => {
    assert.ok(t[key], `Missing English translation for ${key}`);
  });
});

test('meme coins i18n provides required keys in Arabic', () => {
  const t = tMemeCoins('ar');
  requiredKeys.forEach((key) => {
    assert.ok(t[key], `Missing Arabic translation for ${key}`);
  });
});
