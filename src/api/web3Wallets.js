/**
 * Web3 Wallet API helpers
 * 
 * NOTE: Web3Wallet entity doesn't exist in Base44 yet.
 * These functions store wallet data locally until the entity is created.
 * To enable full persistence, create a Web3Wallet entity in Base44 dashboard.
 */

// Local storage key for wallet data (fallback when entity doesn't exist)
const STORAGE_KEY = 'nexttrade_web3_wallets';

// Get wallets from local storage
const getStoredWallets = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Save wallets to local storage
const saveWallets = (wallets) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
  } catch (e) {
    console.error('Failed to save wallets:', e);
  }
};

/**
 * Save a newly connected Web3 wallet
 */
export async function saveWalletConnection({
  userId,
  walletType,
  network,
  address,
  chainId = null,
  balance = null,
  balanceUsd = null
}) {
  try {
    const wallets = getStoredWallets();
    
    // Check if wallet already exists
    const existingIndex = wallets.findIndex(
      w => w.user_id === userId && w.network === network && w.address === address
    );
    
    const walletData = {
      id: existingIndex >= 0 ? wallets[existingIndex].id : `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      wallet_type: walletType,
      network: network,
      chain_id: chainId,
      address: address,
      balance: balance,
      balance_usd: balanceUsd,
      connected_at: existingIndex >= 0 ? wallets[existingIndex].connected_at : new Date().toISOString(),
      disconnected_at: null,
      last_used_at: new Date().toISOString(),
      is_primary: false
    };
    
    if (existingIndex >= 0) {
      wallets[existingIndex] = { ...wallets[existingIndex], ...walletData };
    } else {
      wallets.push(walletData);
    }
    
    saveWallets(wallets);
    return walletData;
  } catch (error) {
    console.error('Failed to save wallet connection:', error);
    return null;
  }
}

/**
 * Disconnect a Web3 wallet
 */
export async function disconnectWallet(userId, network, address) {
  try {
    const wallets = getStoredWallets();
    const index = wallets.findIndex(
      w => w.user_id === userId && w.network === network && w.address === address
    );
    
    if (index >= 0) {
      wallets[index].disconnected_at = new Date().toISOString();
      saveWallets(wallets);
      return wallets[index];
    }
    return null;
  } catch (error) {
    console.error('Failed to disconnect wallet:', error);
    return null;
  }
}

/**
 * Update wallet balance
 */
export async function updateWalletBalance(userId, network, address, balance, balanceUsd = null) {
  try {
    const wallets = getStoredWallets();
    const index = wallets.findIndex(
      w => w.user_id === userId && w.network === network && w.address === address
    );
    
    if (index >= 0) {
      wallets[index].balance = balance;
      wallets[index].balance_usd = balanceUsd;
      wallets[index].last_used_at = new Date().toISOString();
      saveWallets(wallets);
      return wallets[index];
    }
    return null;
  } catch (error) {
    console.error('Failed to update wallet balance:', error);
    return null;
  }
}

/**
 * Update wallet chain ID
 */
export async function updateWalletChain(userId, network, address, chainId) {
  try {
    const wallets = getStoredWallets();
    const index = wallets.findIndex(
      w => w.user_id === userId && w.network === network && w.address === address
    );
    
    if (index >= 0) {
      wallets[index].chain_id = chainId;
      wallets[index].last_used_at = new Date().toISOString();
      saveWallets(wallets);
      return wallets[index];
    }
    return null;
  } catch (error) {
    console.error('Failed to update wallet chain:', error);
    return null;
  }
}

/**
 * Get user's wallets
 */
export async function getUserWallets(userId, network = null) {
  try {
    const wallets = getStoredWallets();
    return wallets.filter(w => {
      if (w.user_id !== userId) return false;
      if (w.disconnected_at) return false;
      if (network && w.network !== network) return false;
      return true;
    });
  } catch (error) {
    console.error('Failed to get user wallets:', error);
    return [];
  }
}

/**
 * Get user's primary wallet for a network
 */
export async function getPrimaryWallet(userId, network) {
  try {
    const wallets = await getUserWallets(userId, network);
    return wallets.find(w => w.is_primary) || wallets[0] || null;
  } catch (error) {
    console.error('Failed to get primary wallet:', error);
    return null;
  }
}

/**
 * Set a wallet as primary
 */
export async function setPrimaryWallet(userId, network, address) {
  try {
    const wallets = getStoredWallets();
    
    // Unset all primary for this network
    wallets.forEach(w => {
      if (w.user_id === userId && w.network === network) {
        w.is_primary = false;
      }
    });
    
    // Set the target as primary
    const index = wallets.findIndex(
      w => w.user_id === userId && w.network === network && w.address === address
    );
    
    if (index >= 0) {
      wallets[index].is_primary = true;
      saveWallets(wallets);
      return wallets[index];
    }
    return null;
  } catch (error) {
    console.error('Failed to set primary wallet:', error);
    return null;
  }
}

/**
 * Update wallet label
 */
export async function updateWalletLabel(userId, network, address, label) {
  try {
    const wallets = getStoredWallets();
    const index = wallets.findIndex(
      w => w.user_id === userId && w.network === network && w.address === address
    );
    
    if (index >= 0) {
      wallets[index].label = label;
      saveWallets(wallets);
      return wallets[index];
    }
    return null;
  } catch (error) {
    console.error('Failed to update wallet label:', error);
    return null;
  }
}

/**
 * Get wallet history (all wallets including disconnected)
 */
export async function getWalletHistory(userId, limit = 10) {
  try {
    const wallets = getStoredWallets();
    return wallets
      .filter(w => w.user_id === userId)
      .sort((a, b) => (Date.parse(b.last_used_at) || 0) - (Date.parse(a.last_used_at) || 0))
      .slice(0, limit);
  } catch (error) {
    console.error('Failed to get wallet history:', error);
    return [];
  }
}
