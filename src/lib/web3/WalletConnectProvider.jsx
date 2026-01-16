import { createContext, useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config, walletConnectEnabled, walletConnectError } from './walletConnectConfig';

// Create a react-query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const WalletConnectContext = createContext(null);

/**
 * WalletConnect Provider - Wraps the app with WagmiProvider
 */
export function WalletConnectProvider({ children }) {
  const [isReady, setIsReady] = useState(false);
  const wagmiEnabled = Boolean(walletConnectEnabled && config && !walletConnectError);

  useEffect(() => {
    // Mark as ready after mount
    setIsReady(true);
    console.log('✅ WalletConnect Provider ready');
  }, []);

  // Don't render children until ready (prevents hydration issues)
  if (!isReady) {
    return null;
  }

  const contextValue = {
    enabled: wagmiEnabled,
    initError: walletConnectError,
  };

  if (!wagmiEnabled) {
    return (
      <WalletConnectContext.Provider value={contextValue}>
        {children}
      </WalletConnectContext.Provider>
    );
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletConnectContext.Provider value={contextValue}>
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
