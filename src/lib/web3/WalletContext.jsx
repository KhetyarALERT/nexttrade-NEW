import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { User } from '@/api/entities';
import { 
  saveWalletConnection, 
  disconnectWallet as disconnectWalletBackend,
  updateWalletBalance as updateWalletBalanceBackend,
  updateWalletChain,
  getUserWallets
} from '@/api/web3Wallets';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState('0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState(null);
  const [walletType, setWalletType] = useState(null); // 'ethereum', 'solana', 'tron'
  const [networkName, setNetworkName] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedWalletType, setSelectedWalletType] = useState(null); // metamask, phantom, etc.

  // Format address for display
  const formatAddress = useCallback((address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }, []);

  // Format balance
  const formatBalance = useCallback((bal) => {
    if (!bal) return '0.00';
    const num = parseFloat(bal);
    if (Number.isNaN(num)) return '0.00';
    return num.toFixed(4);
  }, []);

  // Update balance for different wallet types
  const updateBalance = useCallback(async (address, type = 'ethereum') => {
    if (!address) return;
    try {
      if (type === 'ethereum' && window.ethereum) {
        const balanceHex = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [address, 'latest']
        });
        const balanceWei = parseInt(String(balanceHex), 16);
        const balanceEth = (balanceWei / 1e18).toFixed(4);
        setBalance(balanceEth);
      } else if (type === 'solana' && window.solana) {
        const connection = new window.solanaWeb3.Connection(
          window.solanaWeb3.clusterApiUrl('mainnet-beta')
        );
        const pubKey = new window.solanaWeb3.PublicKey(address);
        const balanceLamports = await connection.getBalance(pubKey);
        const balanceSol = (balanceLamports / 1e9).toFixed(4);
        setBalance(balanceSol);
      } else if (type === 'tron' && window.tronWeb) {
        const balanceSun = await window.tronWeb.trx.getBalance(address);
        const balanceTrx = (balanceSun / 1e6).toFixed(4);
        setBalance(balanceTrx);
      }
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  }, []);

  // Connect Ethereum wallet (MetaMask, Coinbase, Trust, WalletConnect)
  const connectEthereumWallet = useCallback(async (specificWalletType = 'metamask') => {
    if (!window.ethereum) {
      throw new Error('Please install MetaMask or another Ethereum wallet');
    }

    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });

    // @ts-ignore
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const selectedAccount = accounts[0];
    setAccount(selectedAccount);
    setProvider(window.ethereum);
    setWalletType('ethereum');
    setSelectedWalletType(specificWalletType);

    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
    const chainIdDecimal = parseInt(String(chainIdHex), 16);
    setChainId(chainIdDecimal);
    
    // Set network name
    if (chainIdDecimal === 1) setNetworkName('Ethereum');
    else if (chainIdDecimal === 137) setNetworkName('Polygon');
    else if (chainIdDecimal === 56) setNetworkName('BSC');
    else setNetworkName('Unknown');

    await updateBalance(selectedAccount, 'ethereum');

    localStorage.setItem('walletConnected', 'true');
    localStorage.setItem('walletAccount', selectedAccount);
    localStorage.setItem('walletType', 'ethereum');
    localStorage.setItem('specificWalletType', specificWalletType);

    // Save to backend if user is authenticated
    if (currentUser) {
      try {
        const balanceWei = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [selectedAccount, 'latest']
        });
        const balanceBigInt = BigInt(String(balanceWei)).toString();

        await saveWalletConnection({
          userId: currentUser.id,
          walletType: specificWalletType,
          network: 'ethereum',
          address: selectedAccount,
          chainId: chainIdDecimal.toString(),
          balance: balanceBigInt
        });
      } catch (err) {
        console.error('Failed to save wallet to backend:', err);
      }
    }

    return selectedAccount;
  }, [updateBalance, currentUser]);

  // Connect Solana wallet (Phantom, Solflare)
  const connectSolanaWallet = useCallback(async (specificWalletType = 'phantom') => {
    const solana = window.solana || window.solflare;
    if (!solana) {
      throw new Error('Please install Phantom or Solflare wallet');
    }

    const response = await solana.connect();
    const publicKey = response.publicKey.toString();

    setAccount(publicKey);
    setProvider(solana);
    setWalletType('solana');
    setSelectedWalletType(specificWalletType);
    setNetworkName('Solana');
    setChainId(null);

    await updateBalance(publicKey, 'solana');

    localStorage.setItem('walletConnected', 'true');
    localStorage.setItem('walletAccount', publicKey);
    localStorage.setItem('walletType', 'solana');
    localStorage.setItem('specificWalletType', specificWalletType);

    // Save to backend if user is authenticated
    if (currentUser) {
      try {
        await saveWalletConnection({
          userId: currentUser.id,
          walletType: specificWalletType,
          network: 'solana',
          address: publicKey,
          chainId: 'mainnet-beta'
        });
      } catch (err) {
        console.error('Failed to save wallet to backend:', err);
      }
    }

    return publicKey;
  }, [updateBalance, currentUser]);

  // Connect Tron wallet (TronLink)
  const connectTronWallet = useCallback(async (specificWalletType = 'tronlink') => {
    if (!window.tronWeb || !window.tronWeb.ready) {
      throw new Error('Please install TronLink wallet');
    }

    const address = window.tronWeb.defaultAddress.base58;
    if (!address) {
      throw new Error('No Tron address found');
    }

    setAccount(address);
    setProvider(window.tronWeb);
    setWalletType('tron');
    setSelectedWalletType(specificWalletType);
    setNetworkName('Tron');
    setChainId(null);

    await updateBalance(address, 'tron');

    localStorage.setItem('walletConnected', 'true');
    localStorage.setItem('walletAccount', address);
    localStorage.setItem('walletType', 'tron');
    localStorage.setItem('specificWalletType', specificWalletType);

    // Save to backend if user is authenticated
    if (currentUser) {
      try {
        const balanceSun = await window.tronWeb.trx.getBalance(address);
        
        await saveWalletConnection({
          userId: currentUser.id,
          walletType: specificWalletType,
          network: 'tron',
          address: address,
          chainId: 'mainnet',
          balance: balanceSun.toString()
        });
      } catch (err) {
        console.error('Failed to save wallet to backend:', err);
      }
    }

    return address;
  }, [updateBalance, currentUser]);

  // Generic connect wallet
  const connectWallet = useCallback(async (type = 'ethereum', specificWalletType = 'metamask') => {
    setIsConnecting(true);
    setError(null);

    try {
      if (type === 'ethereum') {
        await connectEthereumWallet(specificWalletType);
      } else if (type === 'solana') {
        await connectSolanaWallet(specificWalletType);
      } else if (type === 'tron') {
        await connectTronWallet(specificWalletType);
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [connectEthereumWallet, connectSolanaWallet, connectTronWallet]);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    // Save to backend before disconnecting
    if (currentUser && account && walletType) {
      try {
        await disconnectWalletBackend(currentUser.id, walletType, account);
      } catch (err) {
        console.error('Failed to save disconnect to backend:', err);
      }
    }

    // Disconnect based on wallet type
    if (walletType === 'solana' && window.solana) {
      window.solana.disconnect();
    }
    
    setAccount(null);
    setChainId(null);
    setBalance('0');
    setProvider(null);
    setError(null);
    setWalletType(null);
    setSelectedWalletType(null);
    setNetworkName(null);
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('walletAccount');
    localStorage.removeItem('walletType');
    localStorage.removeItem('specificWalletType');
  }, [walletType, account, currentUser]);

  // Handle account changes for Ethereum
  useEffect(() => {
    if (walletType !== 'ethereum' || !window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== account) {
        setAccount(accounts[0]);
        updateBalance(accounts[0], 'ethereum');
      }
    };

    const handleChainChanged = (chainIdHex) => {
      const chainIdDecimal = parseInt(chainIdHex, 16);
      setChainId(chainIdDecimal);
      window.location.reload();
    };

    const handleDisconnect = () => {
      disconnectWallet();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [account, walletType, updateBalance, disconnectWallet]);

  // Handle account changes for Solana
  useEffect(() => {
    if (walletType !== 'solana') return;
    
    const solana = window.solana || window.solflare;
    if (!solana) return;

    const handleAccountChanged = (publicKey) => {
      if (publicKey) {
        const newAddress = publicKey.toString();
        setAccount(newAddress);
        updateBalance(newAddress, 'solana');
      } else {
        disconnectWallet();
      }
    };

    const handleDisconnect = () => {
      disconnectWallet();
    };

    solana.on('accountChanged', handleAccountChanged);
    solana.on('disconnect', handleDisconnect);

    return () => {
      if (solana.removeListener) {
        solana.removeListener('accountChanged', handleAccountChanged);
        solana.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [walletType, updateBalance, disconnectWallet]);

  // Handle account changes for Tron
  useEffect(() => {
    if (walletType !== 'tron' || !window.tronWeb) return;

    const checkTronAccount = setInterval(() => {
      if (window.tronWeb.ready) {
        const address = window.tronWeb.defaultAddress.base58;
        if (address && address !== account) {
          setAccount(address);
          updateBalance(address, 'tron');
        } else if (!address) {
          disconnectWallet();
        }
      }
    }, 1000);

    return () => clearInterval(checkTronAccount);
  }, [account, walletType, updateBalance, disconnectWallet]);

  // Auto-connect on mount if previously connected
  useEffect(() => {
    const wasConnected = localStorage.getItem('walletConnected');
    const savedAccount = localStorage.getItem('walletAccount');
    const savedType = localStorage.getItem('walletType') || 'ethereum';
    const savedSpecificType = localStorage.getItem('specificWalletType');

    if (wasConnected === 'true' && savedAccount) {
      if (savedType === 'ethereum' && window.ethereum) {
        window.ethereum.request({ method: 'eth_accounts' })
          .then(accounts => {
            // @ts-ignore
            if (accounts && accounts.length > 0 && accounts.includes(savedAccount)) {
              connectWallet('ethereum', savedSpecificType || 'metamask');
            } else {
              localStorage.removeItem('walletConnected');
              localStorage.removeItem('walletAccount');
              localStorage.removeItem('walletType');
              localStorage.removeItem('specificWalletType');
            }
          })
          .catch(err => {
            console.error('Auto-connect failed:', err);
          });
      } else if (savedType === 'solana') {
        const solana = window.solana || window.solflare;
        if (solana && solana.isConnected) {
          connectWallet('solana', savedSpecificType || 'phantom');
        }
      } else if (savedType === 'tron' && window.tronWeb && window.tronWeb.ready) {
        connectWallet('tron', savedSpecificType || 'tronlink');
      }
    }
  }, [connectWallet]);

  // Get current authenticated user
  useEffect(() => {
    async function getCurrentUser() {
      try {
        // TODO: Replace with actual user auth check
        // For now, wallet connections will work but won't be persisted to backend
        // until user authentication is properly implemented
        setCurrentUser(null);
      } catch (err) {
        console.log('No authenticated user');
      }
    }
    getCurrentUser();
  }, []);

  const value = {
    account,
    chainId,
    balance,
    isConnecting,
    error,
    provider,
    walletType,
    selectedWalletType,
    networkName,
    connectWallet,
    disconnectWallet,
    formatAddress,
    formatBalance,
    isConnected: !!account
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

WalletProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
