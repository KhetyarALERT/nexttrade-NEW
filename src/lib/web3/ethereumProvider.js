export const getEthereumProvider = (ethereum, specificWalletType = "metamask") => {
  if (!ethereum) return null;

  const providers = Array.isArray(ethereum.providers) ? ethereum.providers : null;
  const matchers = {
    metamask: (provider) => Boolean(provider?.isMetaMask),
    coinbase: (provider) => Boolean(provider?.isCoinbaseWallet),
    trust: (provider) => Boolean(provider?.isTrust || provider?.isTrustWallet),
    walletconnect: (provider) => Boolean(provider?.isWalletConnect),
  };
  const matcher = matchers[specificWalletType];

  if (providers?.length) {
    const matched = matcher ? providers.find(matcher) : null;
    return matched || providers[0];
  }

  if (matcher && !matcher(ethereum)) return null;
  return ethereum;
};
