/**
 * apiGate.js - Central request deduplication, throttling, and exponential backoff.
 * Prevents 429 spam from multiple components calling the same backend function.
 *
 * Usage:
 *   import { gated } from "@/components/utils/apiGate";
 *   const res = await gated("copyTradingUser:getWallet", () => base44.functions.invoke("copyTradingUser", { action: "getWallet" }), { minIntervalMs: 5000 });
 */

const inflight = new Map();
const lastHit = new Map();
const backoffUntil = new Map();
const backoffState = new Map();
const lastResult = new Map();

function now() { return Date.now(); }

function computeBackoff(key, base, max) {
  const prev = backoffState.get(key) ?? 0;
  const next = prev === 0 ? base : Math.min(max, prev * 2);
  backoffState.set(key, next);
  backoffUntil.set(key, now() + next);
  return next;
}

/**
 * Gated request: deduplicates in-flight, throttles by key, applies backoff on 429/5xx.
 * @param {string} key - Unique key for dedupe/throttle (e.g. "copyTradingUser:getWallet")
 * @param {() => Promise<any>} fn - The actual request function
 * @param {{ minIntervalMs?: number, backoffBaseMs?: number, backoffMaxMs?: number }} opts
 * @returns {Promise<any>}
 */
export async function gated(key, fn, opts = {}) {
  const minIntervalMs = opts.minIntervalMs ?? 3000;
  const backoffBaseMs = opts.backoffBaseMs ?? 3000;
  const backoffMaxMs = opts.backoffMaxMs ?? 30000;

  // If backoff active, return last cached result or throw
  const until = backoffUntil.get(key) ?? 0;
  if (until > now()) {
    if (inflight.has(key)) return inflight.get(key);
    if (lastResult.has(key)) return lastResult.get(key);
    // Silently skip - don't throw, return a stable empty shape
    return null;
  }

  // Throttle: if called too soon, return inflight or last result
  const last = lastHit.get(key) ?? 0;
  if (now() - last < minIntervalMs) {
    if (inflight.has(key)) return inflight.get(key);
    if (lastResult.has(key)) return lastResult.get(key);
    return null;
  }

  // Dedupe in-flight
  if (inflight.has(key)) return inflight.get(key);

  lastHit.set(key, now());

  const p = fn()
    .then((res) => {
      backoffState.delete(key);
      backoffUntil.delete(key);
      lastResult.set(key, res);
      return res;
    })
    .catch((err) => {
      const status = err?.response?.status ?? err?.status;
      if (status === 429 || (status >= 500 && status <= 599)) {
        computeBackoff(key, backoffBaseMs, backoffMaxMs);
        // On error, return last good result if available
        if (lastResult.has(key)) return lastResult.get(key);
      }
      throw err;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, p);
  return p;
}

/** Clear backoff/cache for a specific key (e.g. after user action) */
export function clearGate(key) {
  backoffState.delete(key);
  backoffUntil.delete(key);
  lastResult.delete(key);
  lastHit.delete(key);
}

/** Clear all gate state */
export function clearAllGates() {
  inflight.clear();
  lastHit.clear();
  backoffUntil.clear();
  backoffState.clear();
  lastResult.clear();
}