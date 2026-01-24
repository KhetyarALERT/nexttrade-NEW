/**
 * Shared formatting utilities for the app.
 * Forces Latin digits (0-9) even in Arabic UI.
 */

/**
 * Get locale string with forced Latin numerals for Arabic
 * @param {string} language - "en" or "ar"
 * @returns {string} Locale string
 */
export function getLocale(language) {
  // 'ar-u-nu-latn' = Arabic with Latin numerals
  return language === "ar" ? "ar-u-nu-latn" : "en-US";
}

/**
 * Normalize any Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) to Latin (0123456789)
 * @param {string|number} input
 * @returns {string}
 */
export function normalizeDigits(input) {
  if (input === null || input === undefined) return "";
  const str = String(input);
  // Arabic-Indic digits U+0660 to U+0669
  return str.replace(/[\u0660-\u0669]/g, (d) => d.charCodeAt(0) - 0x0660);
}

/**
 * Format a number with Latin digits
 * @param {number} value
 * @param {object} options
 * @param {number} [options.minFrac=0] - Minimum fraction digits
 * @param {number} [options.maxFrac=2] - Maximum fraction digits
 * @param {string} [options.language="en"] - Language code
 * @returns {string}
 */
export function formatNumber(value, { minFrac = 0, maxFrac = 2, language = "en" } = {}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "0";
  }
  const locale = getLocale(language);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  }).format(value);
}

/**
 * Format USDT amount (2 decimal places, Latin digits)
 * @param {number} value
 * @param {string} [language="en"]
 * @returns {string}
 */
export function formatUsdt(value, language = "en") {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "0.00";
  }
  const locale = getLocale(language);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format USDT with more precision (up to 6 decimals)
 * @param {number} value
 * @param {string} [language="en"]
 * @returns {string}
 */
export function formatUsdtPrecise(value, language = "en") {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "0.00";
  }
  const locale = getLocale(language);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);
}

/**
 * Format percentage (Latin digits)
 * @param {number} value
 * @param {string} [language="en"]
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatPercent(value, language = "en", decimals = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "0%";
  }
  const locale = getLocale(language);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${formatted}%`;
}

/**
 * Format date with Latin digits
 * @param {Date|string} date
 * @param {string} [language="en"]
 * @param {object} [options] - Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatDate(date, language = "en", options = {}) {
  if (!date) return "-";
  
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "-";
  
  const locale = getLocale(language);
  const defaultOptions = { month: "short", day: "numeric", year: "numeric" };
  
  return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(dateObj);
}

/**
 * Format short date (month + day only)
 * @param {Date|string} date
 * @param {string} [language="en"]
 * @returns {string}
 */
export function formatShortDate(date, language = "en") {
  return formatDate(date, language, { month: "short", day: "numeric", year: undefined });
}

/**
 * Format integer (no decimals, Latin digits)
 * @param {number} value
 * @param {string} [language="en"]
 * @returns {string}
 */
export function formatInteger(value, language = "en") {
  return formatNumber(value, { minFrac: 0, maxFrac: 0, language });
}