import React from 'react';
import { UnifiedWalletProvider } from '@jup-ag/wallet-adapter';
// import '@jup-ag/wallet-adapter/dist/index.css';

export const WalletProvider = ({ children }) => {
  return (
    <UnifiedWalletProvider
      wallets={[]}
      endpoint="https://api.mainnet-beta.solana.com"
      config={{
        autoConnect: false,
        env: "mainnet-beta",
        metadata: {
          name: "UnifiedWallet",
          description: "UnifiedWallet",
          url: "https://jup.ag",
          iconUrls: ["https://jup.ag/favicon.ico"],
        },
        notificationCallback: {
          onConnect: () => console.log("Wallet connected"),
          onDisconnect: () => console.log("Wallet disconnected"),
          onNotInstalled: (wallet) => console.log("Wallet not installed", wallet),
        },
        walletPrecedence: ["OKX Wallet", "WalletConnect"],
        hardcodedWallets: [
          {
            id: "Phantom",
            name: "Phantom",
            url: "https://phantom.app/",
            icon: "https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/phantom.svg",
          },
          {
            id: "Solflare",
            name: "Solflare",
            url: "https://solflare.com/",
            icon: "https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/solflare.svg",
          },
          {
            id: "Backpack",
            name: "Backpack",
            url: "https://www.backpack.app/",
            icon: "https://github.com/coral-xyz/backpack/raw/master/assets/backpack.png",
          },
          {
            id: "Magic Eden",
            name: "Magic Eden",
            url: "https://wallet.magiceden.io/",
            icon: "https://avatars.githubusercontent.com/u/116665769",
          },
          {
            id: "Coinbase Wallet",
            name: "Coinbase Wallet",
            url: "https://www.coinbase.com/wallet",
            icon: "https://avatars.githubusercontent.com/u/1885080",
          },
          {
            id: "OKX Wallet",
            name: "OKX Wallet",
            url: "https://www.okx.com/web3",
            icon: "https://station.jup.ag/img/wallet/glow.png",
          },
        ],
        walletlistExplanation: {
          href: "https://station.jup.ag/docs/additional-topics/wallet-list",
        },
        theme: "dark",
        lang: "en",
      }}
    >
      {children}
    </UnifiedWalletProvider>
  );
};