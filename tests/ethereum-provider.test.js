import { test } from "node:test";
import assert from "node:assert/strict";
import { getEthereumProvider } from "../src/lib/web3/ethereumProvider.js";

test("returns null when ethereum is missing", () => {
  assert.equal(getEthereumProvider(null, "metamask"), null);
});

test("selects the MetaMask provider from a providers array", () => {
  const metamask = { isMetaMask: true };
  const coinbase = { isCoinbaseWallet: true };
  const ethereum = { providers: [coinbase, metamask] };

  assert.equal(getEthereumProvider(ethereum, "metamask"), metamask);
});

test("returns null when specific provider is not present", () => {
  const ethereum = { isCoinbaseWallet: true };

  assert.equal(getEthereumProvider(ethereum, "metamask"), null);
});

test("falls back to default provider when specific type is unknown", () => {
  const primary = { isMetaMask: true };
  const secondary = { isCoinbaseWallet: true };
  const ethereum = { providers: [primary, secondary] };

  assert.equal(getEthereumProvider(ethereum, "unknown"), primary);
});
