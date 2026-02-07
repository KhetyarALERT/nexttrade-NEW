/**
 * Help Videos Data
 * Structured for future migration to HelpVideo entity if needed.
 * 
 * Fields:
 * - key: unique identifier
 * - title_en: English title
 * - title_ar: Arabic title
 * - category_en: English category
 * - category_ar: Arabic category
 * - youtube_id: YouTube video ID
 * - is_enabled: whether to show (for soft disable)
 * - sort_order: display order
 */

export const HELP_VIDEOS = [
  {
    key: "kyc_verification",
    title_en: "Verify account (KYC)",
    title_ar: "توثيق الحساب (KYC)",
    category_en: "Getting Started",
    category_ar: "البدء",
    youtube_id: "R7IeJxSWkP8",
    is_enabled: true,
    sort_order: 1,
  },
  {
    key: "platform_overview",
    title_en: "Deposit, Withdraw & Copy Trading overview",
    title_ar: "نظرة عامة: الإيداع والسحب ونسخ التداول",
    category_en: "Getting Started",
    category_ar: "البدء",
    youtube_id: "pIo7fPRzU2Q",
    is_enabled: true,
    sort_order: 2,
  },
];

/**
 * Get a specific video by key
 */
export function getHelpVideo(key) {
  return HELP_VIDEOS.find(v => v.key === key && v.is_enabled);
}

/**
 * Get all enabled videos sorted by sort_order
 */
export function getEnabledVideos() {
  return HELP_VIDEOS
    .filter(v => v.is_enabled)
    .sort((a, b) => a.sort_order - b.sort_order);
}