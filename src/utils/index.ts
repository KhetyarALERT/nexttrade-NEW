// Canonical page URL generator.
//
// Goals:
// - Stable, human-readable routes (kebab-case)
// - Works for: "Dashboard", "PrivacyPolicy", "Buy With Card"
//
// Examples:
//   Dashboard      -> /dashboard
//   PrivacyPolicy  -> /privacy-policy
//   BuyWithCard    -> /buy-with-card
//   MemeCoinsNew   -> /meme-coins-new
export function createPageUrl(pageName: string) {
  const raw = String(pageName ?? "").trim();
  if (!raw) return "/";

  const kebab = raw
    // Insert dashes between camelCase/PascalCase boundaries.
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    // Normalize spaces/underscores to dashes.
    .replace(/[\s_]+/g, "-")
    // Collapse repeated dashes.
    .replace(/-+/g, "-")
    .toLowerCase();

  return `/${kebab}`;
}
