import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import PropTypes from 'prop-types';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

/**
 * Solana Wallet Provider - Provides wallet connection for Solana dApps
 * Supports: Phantom, Solflare, and other standard Solana wallets
 */
export function SolanaWalletProvider({ children }) {
  // Use a CORS-friendly RPC endpoint in browsers.
  // Can be overridden via Vite env: VITE_SOLANA_RPC_URL
  const endpoint = useMemo(() => {
    const envUrl = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SOLANA_RPC_URL : null;
    return envUrl || 'https://api.mainnet-beta.solana.com';
  }, []);
  
  // Configure supported wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

SolanaWalletProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
