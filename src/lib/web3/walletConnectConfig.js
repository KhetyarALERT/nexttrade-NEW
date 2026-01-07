import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { mainnet, polygon, arbitrum, optimism, base, bsc } from 'wagmi/chains';

// ==========================================
// WalletConnect v2 Configuration
// ==========================================
// This config works on:
// - Desktop browsers (with injected wallets)
// - Mobile browsers (WalletConnect QR/deep links)
// - iOS PWA (Add to Home Screen)
// - Android PWA
// ==========================================

// CRITICAL: Get your project ID from https://cloud.walletconnect.com
// Without a valid project ID, wallet icons won't load and connections will fail!
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

if (!projectId || projectId === 'YOUR_PROJECT_ID') {
  console.error(
    '🚨 CRITICAL: WalletConnect Project ID is missing!\n' +
    '👉 Get one FREE at: https://cloud.walletconnect.com\n' +
    '👉 Then set VITE_WALLETCONNECT_PROJECT_ID in your .env file\n' +
    '👉 Without this, wallets will NOT load properly!'
  );
}

// Metadata for your app - MUST match your WalletConnect Cloud project settings
const metadata = {
  name: 'NextTrade',
  description: 'Professional Crypto Trading Platform',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://nexttrade.app',
  icons: [
    typeof window !== 'undefined' 
      ? `${window.location.origin}/logo.png`
      : 'https://nexttrade.app/logo.png'
  ]
};

// Supported chains - must be a tuple with at least one chain
/** @type {readonly [import('wagmi/chains').Chain, ...import('wagmi/chains').Chain[]]} */
const chains = [mainnet, polygon, arbitrum, optimism, base, bsc];

// Create wagmi config with WalletConnect v2
const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  // Enable all connection methods
  enableWalletConnect: true,  // WalletConnect v2 - for mobile/PWA
  enableInjected: true,       // Injected wallets (MetaMask extension, etc.)
  enableCoinbase: true,       // Coinbase Wallet
  enableEIP6963: true,        // EIP-6963 wallet discovery (recommended)
  // Disable social/email - crypto wallets only
  auth: {
    email: false,
    socials: [],
    showWallets: true,
    walletFeatures: true,
  },
});

// Create Web3Modal instance
createWeb3Modal({
  wagmiConfig: config,
  projectId,
  
  // Theme - matches your app's clean design
  themeMode: 'light',
  themeVariables: {
    '--w3m-accent': '#2563eb',
    '--w3m-border-radius-master': '12px',
  },
  
  // Wallet display settings
  allWallets: 'SHOW',           // Show "All Wallets" button to browse all
  enableOnramp: false,          // No buy crypto option
  enableAnalytics: false,       // No tracking
  
  // Featured wallets - these appear first (by wallet registry ID)
  featuredWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
    'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase Wallet
    '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
    'c03dfee351b6fcc421b4494ea33b9d4b92a984f87aa76d1663bb28705e95034a', // Uniswap Wallet
  ],
  
  // DON'T use includeWalletIds - it RESTRICTS the list
  // Let Web3Modal show ALL wallets from the registry
});

// Export config
export { config, projectId, metadata, chains };

// ==========================================
// Platform Detection Utilities
// ==========================================

export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isIOS = () => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

export const isAndroid = () => {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
};

export const isPWA = () => {
  if (typeof window === 'undefined') return false;
  // Check if running as PWA (standalone mode)
  const isStandalone = window.navigator.standalone === true;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    isStandalone ||
    document.referrer.includes('android-app://')
  );
};

export const isDesktop = () => {
  return !isMobile();
};

// Log environment info for debugging
if (typeof window !== 'undefined') {
  console.log('🔧 Wallet Environment:', {
    isMobile: isMobile(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    isPWA: isPWA(),
    isDesktop: isDesktop(),
    hasInjectedWallet: typeof window.ethereum !== 'undefined',
    projectId: projectId === 'YOUR_PROJECT_ID' ? '❌ NOT CONFIGURED' : '✅ Configured'
  });
}
