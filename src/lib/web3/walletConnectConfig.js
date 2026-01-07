import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { mainnet, polygon, arbitrum, optimism, base, bsc } from 'wagmi/chains';

// ==========================================
// WalletConnect v2 - Minimal Working Config
// ==========================================

// Project ID from WalletConnect Cloud (REQUIRED)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

// Debug logging
if (typeof window !== 'undefined') {
  console.log('🔗 WalletConnect:', projectId ? '✅ Project ID loaded' : '❌ NO PROJECT ID!');
}

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

// Create wagmi config - MINIMAL
const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
});

// Create Web3Modal - MINIMAL (let it use defaults)
createWeb3Modal({
  wagmiConfig: config,
  projectId,
});

// Export
export { config, projectId, metadata, chains };

