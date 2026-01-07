import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { mainnet, polygon, arbitrum, optimism, base, bsc } from 'wagmi/chains';
import { walletConnect, injected, coinbaseWallet } from 'wagmi/connectors';

// ==========================================
// WalletConnect v2 Configuration
// ==========================================
// This config works on:
// - Desktop browsers (with injected wallets)
// - Mobile browsers (WalletConnect QR/deep links)
// - iOS PWA (Add to Home Screen)
// - Android PWA
// ==========================================

// Get your project ID from https://cloud.walletconnect.com
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

if (projectId === 'YOUR_PROJECT_ID') {
  console.warn(
    '⚠️ WalletConnect Project ID not configured!\n' +
    'Get one at: https://cloud.walletconnect.com\n' +
    'Set VITE_WALLETCONNECT_PROJECT_ID in your .env file'
  );
}

// Metadata for your app
const metadata = {
  name: 'NextTrade',
  description: 'Professional Trading Platform',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://nexttrade.com',
  icons: [
    typeof window !== 'undefined' 
      ? `${window.location.origin}/nexttrade-logo.png`
      : 'https://nexttrade.com/logo.png'
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
  enableWalletConnect: true, // Enable WalletConnect v2
  enableInjected: true,      // Enable injected wallets (MetaMask on desktop)
  enableCoinbase: true,      // Enable Coinbase Wallet
  // DISABLE social/email auth - crypto wallets only
  auth: {
    email: false,
    socials: [],             // Empty array = no social logins
    showWallets: true,
    walletFeatures: true,
  },
});

// Create Web3Modal instance
// This handles the UI for connecting wallets
createWeb3Modal({
  wagmiConfig: config,
  projectId,
  
  // Theme configuration
  themeMode: 'light', // Will be controlled by your app's theme
  themeVariables: {
    '--w3m-accent': '#2563eb', // Blue accent color
    '--w3m-border-radius-master': '12px',
  },
  
  // DISABLE ALL SOCIAL LOGINS - Only show crypto wallets
  enableOnramp: false,        // Disable buy crypto
  
  // CRITICAL: Disable social/email options - wallets only mode
  allWallets: 'SHOW',         // Show all wallets option
  
  // Featured wallet IDs (these show first in the list)
  featuredWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
    'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase Wallet
    '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
    'c03dfee351b6fcc421b4494ea33b9d4b92a984f87aa76d1663bb28705e95034a', // Uniswap Wallet
  ],
  
  // Enable analytics (optional)
  enableAnalytics: false,
  
  // All wallets shown in the modal - expanded list for better detection
  includeWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
    'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase Wallet
    '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
    'c03dfee351b6fcc421b4494ea33b9d4b92a984f87aa76d1663bb28705e95034a', // Uniswap Wallet
    'e7c4d26541a7fd84dbdfa9922d3ad21e936e13a7a0e44385d44f006139e44d3b', // Argent
    '38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662', // BitKeep
    '971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709', // OKX Wallet
    '8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4', // Binance Web3 Wallet
    '0b415a746fb9ee99cce155c2ceca0c6f6061b1dbca2d722b3ba16381d0562150', // SafePal
    '20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66', // TokenPocket
    'ef333840daf915aafdc4a004525502d6d49d77bd9c65e0642dbaefb3c2893bef', // imToken
    'c286eebc742a537cd1d6818363e9dc53b21759a1e8e5d9b263f0c8e4a7e63e1f', // Crypto.com DeFi Wallet
    '19177a98252e07ddfc9af2083ba8e07ef627cb6103467ffebb3f8f4205fd7927', // Ledger Live
    'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393', // Phantom (Ethereum)
  ],
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
