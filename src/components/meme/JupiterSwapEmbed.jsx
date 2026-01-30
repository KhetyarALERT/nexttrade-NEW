import React, { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Loader2 } from 'lucide-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

// Fallback script URL if NPM package fails
const JUPITER_SCRIPT_URL = "https://terminal.jup.ag/main-v3.js";

export default function JupiterSwapEmbed({ isOpen, tokenMint }) {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [isLoaded, setIsLoaded] = useState(false);
  const initializedRef = useRef(false);
  const currentMintRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !tokenMint) return;

    // Prevent re-init if same mint
    if (initializedRef.current && currentMintRef.current === tokenMint) {
      return;
    }

    const initJupiter = async () => {
      try {
        setIsLoaded(false);
        
        // Load Jupiter via script tag (avoiding npm dependency issues)
        if (!window.Jupiter) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = JUPITER_SCRIPT_URL;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        
        const jupiter = window.Jupiter;

        if (!jupiter) throw new Error("Jupiter plugin could not be loaded");

        // Initialize
        jupiter.init({
          displayMode: "integrated",
          integratedTargetId: "jupiter-swap-container",
          endpoint: "https://api.mainnet-beta.solana.com", // Or use your own RPC
          formProps: {
            fixedOutputMint: false,
            initialInputMint: "So11111111111111111111111111111111111111112", // SOL
            initialOutputMint: tokenMint,
            swapMode: "ExactIn", // Or "ExactOut"
            referralAccount: import.meta.env.VITE_JUP_REFERRAL_ACCOUNT || undefined,
            referralFee: import.meta.env.VITE_JUP_REFERRAL_ACCOUNT ? 255 : undefined,
          },
          enableWalletPassthrough: true,
          passthroughWalletContextState: wallet.connected ? wallet : undefined,
          onRequestConnectWallet: () => setVisible(true),
          containerStyles: { 
            width: "100%", 
            height: "520px", 
            borderRadius: "16px", 
            overflow: "hidden",
            background: "transparent"
          },
        });

        initializedRef.current = true;
        currentMintRef.current = tokenMint;
        setIsLoaded(true);

      } catch (err) {
        console.error("Failed to init Jupiter:", err);
      }
    };

    initJupiter();

    // Cleanup on unmount or mint change? 
    // Jupiter doesn't strictly require cleanup for integrated mode if container is removed,
    // but we should reset refs if needed.
    return () => {
       // Cleanup if API supports it
       if (window.Jupiter && window.Jupiter.close) {
         // window.Jupiter.close(); // Only for modal mode usually
       }
    };

  }, [isOpen, tokenMint, wallet.connected]); 

  // Pass wallet updates
  useEffect(() => {
    if (initializedRef.current && window.Jupiter && window.Jupiter.syncProps) {
        window.Jupiter.syncProps({ passthroughWalletContextState: wallet });
    }
  }, [wallet.connected, wallet.publicKey]);

  return (
    <div className="w-full relative min-h-[520px] bg-gray-900/50 rounded-2xl border border-gray-800">
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      )}
      <div id="jupiter-swap-container" className="w-full h-full" />
    </div>
  );
}