# WalletConnect v2 Implementation Guide

## Overview

This app now uses **WalletConnect v2** with **Wagmi** and **Web3Modal** for wallet connections. This implementation works across ALL platforms:

- ✅ **Desktop browsers** - Injected wallets (MetaMask, Coinbase, etc.)
- ✅ **Mobile browsers** - WalletConnect QR codes + deep links
- ✅ **iOS PWA** - Universal links to open wallet apps
- ✅ **Android PWA** - Intent/deep links to open wallet apps

## Quick Start

### 1. Install Dependencies

```bash
chmod +x setup-walletconnect.sh
./setup-walletconnect.sh
```

Or manually:

```bash
npm install @wagmi/core@^2.13.4 @wagmi/connectors@^5.1.5 @web3modal/wagmi@^5.1.5 viem@^2.21.4 wagmi@^2.12.9
```

### 2. Get WalletConnect Project ID

1. Visit https://cloud.walletconnect.com
2. Sign in with GitHub
3. Create a new project
4. Copy your **Project ID**

### 3. Configure Environment

Create or update `.env`:

```env
# WalletConnect Project ID (REQUIRED)
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here

# App Metadata
VITE_APP_NAME=NextTrade
VITE_APP_URL=https://nexttrade.app
```

### 4. Start Development Server

```bash
npm run dev
```

## Architecture

### Core Components

#### 1. `walletConnectConfig.js`
Central configuration file:
- Project ID and metadata
- Supported chains (Ethereum, Polygon, Arbitrum, Optimism, Base, BSC)
- Web3Modal theme and featured wallets
- Platform detection utilities

#### 2. `WalletConnectProvider.jsx`
Root provider component:
- Wraps app with WagmiProvider + QueryClientProvider
- Handles session persistence
- Provides `useWalletConnect` hook

#### 3. `Web3ModalButton.jsx`
Smart wallet button:
- Shows "Connect Wallet" when disconnected
- Shows wallet info when connected (address, network, balance)
- Opens Web3Modal on click
- Auto-detects platform and shows appropriate UI

### Integration Points

#### Main Entry (`main.jsx`)
```jsx
import { WalletConnectProvider } from '@/lib/web3/WalletConnectProvider'

ReactDOM.createRoot(document.getElementById('root')).render(
  <WalletConnectProvider>
    <App />
  </WalletConnectProvider>
)
```

#### Layout (`Layout.jsx`)
```jsx
import { Web3ModalButton } from '@/components/wallet/Web3ModalButton'

// Desktop
<Web3ModalButton language={language} />

// Mobile
<Web3ModalButton language={language} />
```

## Platform-Specific Behavior

### Desktop Browser
- Shows injected wallets (MetaMask, Coinbase, etc.) if installed
- Shows WalletConnect option
- User clicks wallet → direct connection via `window.ethereum`

### Mobile Browser
- Shows WalletConnect QR code
- Shows "Open in Wallet" buttons with deep links
- User clicks wallet → opens wallet app → approves → returns to browser

### iOS PWA (Add to Home Screen)
- No injected providers (window.ethereum doesn't exist)
- Uses universal links: `https://metamask.app.link/...`
- User clicks wallet → iOS opens wallet app → approves → returns to PWA
- **No popups** (iOS PWA blocks them)

### Android PWA
- No injected providers
- Uses intent links: `metamask://...` or `trust://...`
- User clicks wallet → Android opens wallet app → approves → returns to PWA
- Falls back to Play Store if wallet not installed

## Supported Chains

```javascript
- Ethereum Mainnet (chainId: 1)
- Polygon (chainId: 137)
- Arbitrum (chainId: 42161)
- Optimism (chainId: 10)
- Base (chainId: 8453)
- BSC (chainId: 56)
```

To add more chains, edit `walletConnectConfig.js`:

```javascript
import { avalanche } from 'viem/chains'

export const chains = [mainnet, polygon, arbitrum, avalanche]
```

## Featured Wallets

Current featured wallets (shown prominently):
- MetaMask (`c57ca95b564c976b3f7`)
- Trust Wallet (`4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0`)
- Coinbase Wallet (`fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa`)
- Rainbow
- Uniswap Wallet

100+ more wallets available via WalletConnect registry.

## Usage in Components

### Get Wallet Info

```jsx
import { useAccount, useBalance, useNetwork } from 'wagmi'

function MyComponent() {
  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({ address })
  const { chain } = useNetwork()

  if (!isConnected) return <div>Not connected</div>

  return (
    <div>
      <p>Address: {address}</p>
      <p>Balance: {balance?.formatted} {balance?.symbol}</p>
      <p>Network: {chain?.name}</p>
    </div>
  )
}
```

### Send Transaction

```jsx
import { useSendTransaction, useWaitForTransaction } from 'wagmi'

function SendButton() {
  const { sendTransaction, data: hash } = useSendTransaction()
  const { isLoading, isSuccess } = useWaitForTransaction({ hash })

  const handleSend = async () => {
    sendTransaction({
      to: '0x...',
      value: parseEther('0.01'),
    })
  }

  return (
    <button onClick={handleSend} disabled={isLoading}>
      {isLoading ? 'Sending...' : 'Send'}
    </button>
  )
}
```

### Sign Message

```jsx
import { useSignMessage } from 'wagmi'

function SignButton() {
  const { signMessage, data: signature } = useSignMessage()

  const handleSign = () => {
    signMessage({ message: 'Hello from NextTrade!' })
  }

  return (
    <button onClick={handleSign}>
      Sign Message
    </button>
  )
}
```

### Switch Network

```jsx
import { useSwitchNetwork } from 'wagmi'

function NetworkSwitcher() {
  const { switchNetwork, chains } = useSwitchNetwork()

  return (
    <select onChange={(e) => switchNetwork(Number(e.target.value))}>
      {chains.map(chain => (
        <option key={chain.id} value={chain.id}>
          {chain.name}
        </option>
      ))}
    </select>
  )
}
```

## Auto-Reconnect

WalletConnect v2 automatically handles session persistence:

1. User connects wallet
2. Session saved to localStorage
3. User closes app
4. User reopens app
5. Session automatically restored
6. Wallet reconnects without user action

To disable auto-reconnect, edit `walletConnectConfig.js`:

```javascript
const config = createConfig({
  // ...
  autoConnect: false, // Disable auto-reconnect
})
```

## Disconnect

Disconnection is handled by Wagmi:

```jsx
import { useDisconnect } from 'wagmi'

function DisconnectButton() {
  const { disconnect } = useDisconnect()

  return (
    <button onClick={disconnect}>
      Disconnect
    </button>
  )
}
```

## Debugging

### Enable Debug Logs

The config file already logs platform info:

```javascript
// In walletConnectConfig.js
console.log('🌍 Environment:', {
  userAgent: navigator.userAgent,
  isMobile: isMobile(),
  isIOS: isIOS(),
  isAndroid: isAndroid(),
  isPWA: isPWA(),
  isDesktop: isDesktop(),
  hasInjected: typeof window.ethereum !== 'undefined',
})
```

### Check WalletConnect Session

```javascript
// In browser console
localStorage.getItem('wagmi.store')
```

### Common Issues

#### 1. "Invalid project ID"
**Solution:** Get a real Project ID from https://cloud.walletconnect.com

#### 2. "Wallet not opening on mobile"
**Causes:**
- Wallet app not installed
- Deep link blocked by OS
- Popup blocker (use deep links, not popups)

**Solution:** Ensure using latest Web3Modal which handles deep links properly

#### 3. "Session not persisting"
**Cause:** Browser clearing localStorage

**Solution:** Check browser settings, ensure localStorage is enabled

#### 4. "MetaMask not detected on desktop"
**Cause:** MetaMask extension not installed

**Solution:** Install MetaMask browser extension

## Migration from Old Implementation

### Old Way (Direct Provider Detection)
```jsx
// ❌ Old implementation
const connectMetaMask = async () => {
  if (window.ethereum) {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    })
  }
}
```

### New Way (WalletConnect v2)
```jsx
// ✅ New implementation
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'

function ConnectButton() {
  const { open } = useWeb3Modal()
  const { isConnected } = useAccount()

  return (
    <button onClick={() => open()}>
      {isConnected ? 'Connected' : 'Connect'}
    </button>
  )
}
```

## Testing Checklist

### Desktop
- [ ] Chrome with MetaMask extension
- [ ] Firefox with MetaMask extension
- [ ] Safari (macOS)
- [ ] Edge
- [ ] WalletConnect QR code works

### Mobile Browser
- [ ] Safari iOS - WalletConnect deep links work
- [ ] Chrome Android - WalletConnect deep links work
- [ ] Trust Wallet in-app browser
- [ ] MetaMask mobile browser

### PWA (Add to Home Screen)
- [ ] iOS PWA - Opens MetaMask app
- [ ] iOS PWA - Opens Trust Wallet app
- [ ] iOS PWA - Opens Coinbase Wallet app
- [ ] Android PWA - Opens MetaMask app
- [ ] Android PWA - Opens Trust Wallet app
- [ ] Session persists after app close/reopen

### Functionality
- [ ] Connect wallet
- [ ] Disconnect wallet
- [ ] Switch network
- [ ] Send transaction
- [ ] Sign message
- [ ] View balance
- [ ] Auto-reconnect on refresh
- [ ] Multiple wallet connections

## Security Best Practices

1. **Never expose private keys** - WalletConnect only requests signatures, never keys
2. **Verify addresses** - Always show full address before transactions
3. **Check network** - Verify user is on correct network before transactions
4. **Rate limiting** - Implement rate limits on wallet operations
5. **HTTPS only** - Always use HTTPS in production
6. **Verify signatures** - Validate signatures server-side

## Performance Tips

1. **Lazy load Web3Modal** - Only load when needed
2. **Cache balance queries** - Use React Query's caching (already configured)
3. **Debounce network calls** - Avoid excessive RPC calls
4. **Use multicall** - Batch multiple contract reads into one call

## Resources

- **WalletConnect Docs:** https://docs.walletconnect.com/
- **Wagmi Docs:** https://wagmi.sh/
- **Viem Docs:** https://viem.sh/
- **Web3Modal Docs:** https://docs.walletconnect.com/web3modal/about
- **Supported Wallets:** https://explorer.walletconnect.com/

## Support

For issues:
1. Check console logs for errors
2. Verify Project ID is correct
3. Test on different browsers/devices
4. Check WalletConnect status: https://status.walletconnect.com/

## License

This implementation uses:
- **Wagmi** - MIT License
- **Viem** - MIT License
- **Web3Modal** - Apache 2.0 License
- **WalletConnect** - Apache 2.0 License
