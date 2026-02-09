# NextTrade Copilot Instructions

## Architecture & Entry Points
- Vite + React Router SPA with TanStack Query, Radix UI, Tailwind; TypeScript typings via `jsconfig.json`. App shell in [src/App.jsx](../src/App.jsx) and layout in [src/Layout.jsx](../src/Layout.jsx) (handles auth gating, RTL, theme, notifications, wallets).
- Pages auto-registered; avoid manual route tweaks. Add page files under `src/pages/`, rely on [src/pages.config.js](../src/pages.config.js) and `createPageUrl(pageName)` for canonical/legacy redirects.
- Backend is Base44 serverless functions (Deno) under `functions/`. Interact through `base44.functions.invoke()` / `base44.entities.*` (client in [src/api/base44Client.js](../src/api/base44Client.js)). Functions standardize `{ ok, data?, error? }` via `okResponse()`.

## Navigation & State Patterns
- Auth: `AuthProvider` wraps app; `useAuth()` supplies `isAuthenticated`, `navigateToLogin`. Public routes: Privacy/Terms only.
- Routing utilities: `createPageUrl` generates kebab-case canonical paths plus back-compat redirects. Internal links should use it to avoid 404s.
- Mobile: `MobileNavigationProvider` tracks scroll + bottom nav (Layout). Trigger haptics with `triggerHaptic()` for tab changes or modal opens.
- Query/state: TanStack Query for server state; local `useState` for UI. PropTypes are used instead of TS types.

## Wallets & Deposits
- Wallet page [src/pages/Wallet.jsx](../src/pages/Wallet.jsx) has sub-pages via `?page=` (`overview|deposit|history`). Deposits use [WalletDeposit](../src/components/wallet/WalletDeposit.jsx) which calls `okxUserAccount` actions `getDepositAddress` and `getDepositHistory`; requires an OKX trading account.
- On-chain deposit CTA page [src/pages/OnChainDeposit.jsx](../src/pages/OnChainDeposit.jsx) just deep-links to Profile assets tab (`?tab=assets&assetTab=main&modal=deposit`).
- NOWPayments IPN handling lives in [functions/walletWebhook.ts](../functions/walletWebhook.ts): validates HMAC, credits `Wallet` + `WalletTransaction`, updates `TradingAccount`, and notifies admins (links to `/OKXAdminHub?tab=users&userId=...`). Ensure `NOWPAYMENTS_IPN_SECRET` is set; missing secret skips signature check.
- Internal wallet/entity naming: `Wallet` and `WalletTransaction` store balances; `TradingAccount` mirrors balance/equity; copy-trading wallet fetched via `copyTradingUser` function.

## Trading & Integrations
- OKX: trading flows in [functions/okxTrading.ts](../functions/okxTrading.ts); account provisioning in `okxUserAccount`/`okxProvisioning.ts`; balances pulled into Layout/Wallet.
- Solana: Jupiter swap/terminal via `@jup-ag/*`; Solana wallet via `SolanaWalletProvider` + `UnifiedWalletButton`. EVM wallets via Wagmi + `WalletConnectProvider` (`useWalletConnect()` indicates enabled state).
- Analytics/audit: functions log with prefixed console entries; Layout triggers `trackLogin` and analytics events on auth changes.

## Styling & UX
- Tailwind with CSS vars; `glass-effect` class for blurred surfaces. Premium fonts injected in Layout; RTL supported by toggling `dir` and Arabic font.
- Use Radix UI primitives wrapped in local UI components (`@/components/ui/*`). Maintain mobile-safe padding using `env(safe-area-inset-*)` as seen in Layout and mobile nav.

## Commands & Checks
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint` / auto-fix `npm run lint:fix`
- Type check: `npm run typecheck`
- Preview: `npm run preview`

## Conventions & Gotchas
- Always gate user-specific calls on `isAuthenticated`; handle `authError` in Layout (user_not_registered/auth_required).
- Prefer `@/` alias imports; keep pages functional components with minimal side effects.
- For functions, validate `result.ok` before reading data; return consistent error shapes with `okResponse`.
- Avoid hardcoding paths; use `createPageUrl`. Keep auto-generated `pages.config.js` untouched except `mainPage`.
- When adding deposit/payment flows, ensure admin visibility by creating `Notification` entries similar to `walletWebhook.ts` (include admin link data).