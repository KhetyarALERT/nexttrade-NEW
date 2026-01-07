import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { mainnet, polygon, arbitrum, optimism, base, bsc } from 'wagmi/chains';

// ==========================================
// WalletConnect v2 Configuration
// ==========================================

// Your WalletConnect Cloud Project ID
const projectId = 'a846c729635359bb2f3d8eca53cb74fe';

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
const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
});

// Initialize Web3Modal - this MUST run before any React rendering
let web3Modal = null;
if (typeof window !== 'undefined') {
  web3Modal = createWeb3Modal({
    wagmiConfig: config,
    projectId,
    enableAnalytics: false,
    themeMode: 'light',
  });
  console.log('✅ Web3Modal initialized with project:', projectId);
}

// Export
export { config, projectId, metadata, chains, web3Modal };

