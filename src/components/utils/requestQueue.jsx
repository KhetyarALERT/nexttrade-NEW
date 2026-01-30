/**
 * requestQueue.js - Central request utility for deduplication, caching, and rate limiting
 * Handles in-flight request coalescing and TTL caching to prevent API spam.
 */

const requestCache = new Map();
const inFlightRequests = new Map();

export const requestQueue = {
  /**
   * Fetch with deduplication and caching
   * @param {string} key - Unique key for the request (e.g. "tokenSafety:mint123")
   * @param {Function} fetcher - Async function that returns the data
   * @param {object} options - { ttl: number (ms), force: boolean }
   */
  fetch: async (key, fetcher, options = { ttl: 60000, force: false }) => {
    const now = Date.now();
    
    // 1. Check Cache (if not forced)
    if (!options.force && requestCache.has(key)) {
      const { data, timestamp } = requestCache.get(key);
      if (now - timestamp < options.ttl) {
        return data;
      }
      requestCache.delete(key);
    }

    // 2. Check In-Flight (Dedupe)
    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key);
    }

    // 3. Execute Request
    const promise = (async () => {
      try {
        const data = await fetcher();
        // Update Cache
        requestCache.set(key, { data, timestamp: Date.now() });
        return data;
      } catch (error) {
        // Don't cache errors? Or maybe cache short term?
        // For now, allow retry on error
        throw error;
      } finally {
        // Clear In-Flight
        inFlightRequests.delete(key);
      }
    })();

    inFlightRequests.set(key, promise);
    return promise;
  },

  /**
   * Clear cache for a specific key
   */
  invalidate: (key) => {
    requestCache.delete(key);
  },

  /**
   * Clear all cache
   */
  clear: () => {
    requestCache.clear();
    inFlightRequests.clear();
  }
};