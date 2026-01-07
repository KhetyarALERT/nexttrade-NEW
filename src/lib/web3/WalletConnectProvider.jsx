import { createContext, useContext, useEffect } from 'react';
import PropTypes from 'prop-types';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './walletConnectConfig';

// Create a react-query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const WalletConnectContext = createContext(null);

/**
 * WalletConnect Provider - Wraps the app with WagmiProvider
 * This handles all wallet connections via WalletConnect v2
 * 
 * Works on:
 * - Desktop with injected wallets (MetaMask, etc.)
 * - Mobile browsers with WalletConnect
 * - iOS PWA (Add to Home Screen)
 * - Android PWA
 */
export function WalletConnectProvider({ children }) {
  useEffect(() => {
    console.log('✅ WalletConnect Provider initialized');
    console.log('📱 Platform:', {
      userAgent: navigator.userAgent,
      isPWA: window.matchMedia('(display-mode: standalone)').matches,
      hasInjected: typeof window.ethereum !== 'undefined'
    });

    // Cleanup on unmount
    return () => {
      console.log('🔄 WalletConnect Provider cleanup');
    };
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletConnectContext.Provider value={{}}>
          {children}
        </WalletConnectContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

WalletConnectProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useWalletConnect() {
  const context = useContext(WalletConnectContext);
  if (!context) {
    throw new Error('useWalletConnect must be used within a WalletConnectProvider');
  }
  return context;
}
