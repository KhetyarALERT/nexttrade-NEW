import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { mainnet, polygon, arbitrum, optimism, base, bsc } from 'wagmi/chains';

// ==========================================
// WalletConnect v2 Configuration
// ==========================================

const rawEnabled = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_WALLETCONNECT_ENABLED ?? import.meta.env?.WALLETCONNECT_ENABLED)
  : null;
const walletConnectEnabled = String(rawEnabled || '').toLowerCase() === 'true';
const projectId = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_WALLETCONNECT_PROJECT_ID ?? import.meta.env?.WALLETCONNECT_PROJECT_ID)
  : '';

// App metadata
const metadata = {
  name: 'NextTrade',
  description: 'Professional Crypto Trading Platform',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://nexttrade.app',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

// Supported chains
/** @type {readonly [import('wagmi/chains').Chain, ...import('wagmi/chains').Chain[]]} */
const chains = [mainnet, polygon, arbitrum, optimism, base, bsc];

// Create wagmi config
const config = walletConnectEnabled && projectId
  ? defaultWagmiConfig({
    chains,
    projectId,
    metadata,
  })
  : null;

// Initialize Web3Modal - this MUST run before any React rendering
let web3Modal = null;
let walletConnectError = null;
if (typeof window !== 'undefined' && walletConnectEnabled && projectId) {
  try {
    web3Modal = createWeb3Modal({
      wagmiConfig: config,
      projectId,
      enableAnalytics: false,
      themeMode: 'light',
    });
    console.log('✅ Web3Modal initialized with project:', projectId);
  } catch (error) {
    walletConnectError = error instanceof Error ? error : new Error(String(error));
    console.warn('⚠️ WalletConnect disabled due to init error:', walletConnectError.message);
  }
}

// Export
export { config, projectId, metadata, chains, web3Modal, walletConnectEnabled, walletConnectError };
