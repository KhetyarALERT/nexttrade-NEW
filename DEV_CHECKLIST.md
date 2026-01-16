# NextTrade Dev Checklist

## Required secrets / env keys
Set these in Base44 Secrets (server-side):
- `OKX_BASE_URL` (default: `https://www.okx.com`)
- `OKX_MAIN_API_KEY`
- `OKX_MAIN_SECRET`
- `OKX_MAIN_PASSPHRASE`
- `OKX_TRADING_MODE` (`prod` or `demo`)
- `SOLANA_RPC_URL` (fallback: `https://api.mainnet-beta.solana.com`)
- `APP_ENCRYPTION_KEY` (required for encrypting per-user exchange secrets)
- `WALLETCONNECT_ENABLED` (`true`/`false`)
- `WALLETCONNECT_PROJECT_ID` (required if enabled)

Frontend (Vite) vars (mirror as needed):
- `VITE_SOLANA_RPC_URL`
- `VITE_SOLANA_RPC_PROXY` (optional, set to the function URL for proxying)
- `VITE_WALLETCONNECT_ENABLED`
- `VITE_WALLETCONNECT_PROJECT_ID`

## Provisioning test
Run from Base44 Functions:
- `okxSystemTest` with `{ "action": "testProvisioning", "targetUserId": "<user_id>" }`

## Validate DB records
After provisioning, confirm:
- `UserExchangeAccount` has `provider = OKX`, `status = ACTIVE`, and `account_config_json`.
- `ExchangeCredential` has `api_key`, `secret_enc`, `passphrase_enc`, `permissions_json`.
- `UserExchangeAccount.deposit_addresses_json` contains deposit addresses.

## Switch demo/prod trading mode
Set `OKX_TRADING_MODE` to:
- `demo` (adds `x-simulated-trading: 1` for trading endpoints)
- `prod` (default)

## WalletConnect domain allowlist
If `WALLETCONNECT_ENABLED=true`, ensure your domain is allowlisted in WalletConnect Cloud.
If blocked by CSP, the app will show a warning and keep running.
