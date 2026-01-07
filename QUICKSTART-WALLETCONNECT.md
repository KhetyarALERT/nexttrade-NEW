# 🚀 Quick Start - WalletConnect v2

## Installation (3 steps)

### 1️⃣ Install Dependencies
```bash
chmod +x setup-walletconnect.sh
./setup-walletconnect.sh
```

### 2️⃣ Get WalletConnect Project ID
1. Visit: https://cloud.walletconnect.com
2. Sign in with GitHub
3. Create a new project
4. Copy your **Project ID**

### 3️⃣ Configure Environment
Create `.env` file:
```env
VITE_WALLETCONNECT_PROJECT_ID=paste_your_project_id_here
```

### ✅ Start App
```bash
npm run dev
```

---

## Testing Checklist

### Desktop
- [ ] Chrome + MetaMask extension
- [ ] Firefox + MetaMask extension
- [ ] Safari (macOS)

### Mobile Browser
- [ ] Safari (iOS) - WalletConnect
- [ ] Chrome (Android) - WalletConnect

### PWA (CRITICAL)
- [ ] **iOS PWA** (Add to Home Screen from Safari)
- [ ] **Android PWA** (Add to Home Screen from Chrome)

### Functionality
- [ ] Connect wallet
- [ ] View balance & network
- [ ] Copy address
- [ ] Disconnect
- [ ] Reconnect (refresh page)
- [ ] Switch network

---

## Files Changed

### ✅ Created
- `src/lib/web3/walletConnectConfig.js` - Configuration
- `src/lib/web3/WalletConnectProvider.jsx` - Provider
- `src/components/wallet/Web3ModalButton.jsx` - Button
- `setup-walletconnect.sh` - Setup script
- `.env.example` - Environment template
- `docs/WALLETCONNECT_V2_GUIDE.md` - Full docs
- `docs/WALLETCONNECT_V2_COMPLETE.md` - Summary

### ✅ Modified
- `package.json` - Added 5 dependencies
- `src/main.jsx` - Wrapped app with provider
- `src/Layout.jsx` - Replaced old button (2 places)

---

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Invalid project ID" | Get real ID from cloud.walletconnect.com |
| Wallet not opening | Install wallet app, check deep link support |
| Session not saving | Enable localStorage in browser |
| MetaMask not detected | Install browser extension |
| Module not found errors | Run `npm install` |

---

## Platform Behavior

### Desktop
- Shows installed wallets (MetaMask, Coinbase, etc.)
- Direct connection via browser extension

### Mobile Browser
- Shows WalletConnect QR code
- Shows list of wallets with "Open" buttons
- Deep links open wallet apps

### iOS PWA
- **No window.ethereum** (standalone mode)
- Uses **universal links**: `metamask://wc?uri=...`
- Opens wallet app → user approves → returns to PWA
- **No popups** (iOS blocks them)

### Android PWA
- **No window.ethereum**
- Uses **intent links**: `metamask://...` or `trust://...`
- Opens wallet app → user approves → returns to PWA
- Falls back to Play Store if app not installed

---

## Supported Wallets

### Featured
✅ MetaMask
✅ Trust Wallet  
✅ Coinbase Wallet
✅ Rainbow
✅ Uniswap Wallet

### Also Available
+ Argent, BitKeep, OKX, SafePal, TokenPocket, imToken
+ **100+ more** via WalletConnect registry

---

## Supported Networks

✅ Ethereum Mainnet
✅ Polygon
✅ Arbitrum
✅ Optimism
✅ Base
✅ BSC (Binance Smart Chain)

---

## Example Usage

### Get Wallet Info
```jsx
import { useAccount, useBalance } from 'wagmi'

function MyComponent() {
  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({ address })

  return (
    <div>
      {isConnected && (
        <>
          <p>Address: {address}</p>
          <p>Balance: {balance?.formatted} {balance?.symbol}</p>
        </>
      )}
    </div>
  )
}
```

### Send Transaction
```jsx
import { useSendTransaction } from 'wagmi'
import { parseEther } from 'viem'

function SendButton() {
  const { sendTransaction } = useSendTransaction()

  return (
    <button onClick={() => {
      sendTransaction({
        to: '0x...',
        value: parseEther('0.01')
      })
    }}>
      Send
    </button>
  )
}
```

---

## 📚 Full Documentation

See `docs/WALLETCONNECT_V2_GUIDE.md` for complete guide.
