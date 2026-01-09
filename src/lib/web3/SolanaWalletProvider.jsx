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
  // Use mainnet for production
  const endpoint = useMemo(() => clusterApiUrl('mainnet-beta'), []);
  
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
