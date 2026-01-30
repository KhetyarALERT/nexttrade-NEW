import React, { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Loader2 } from 'lucide-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

const JUPITER_SCRIPT_URL = "https://terminal.jup.ag/main-v3.js";
// Using public mainnet endpoint - in production this should be a paid RPC
const RPC_ENDPOINT = "https://api.mainnet-beta.solana.com";

export default function JupiterSwapEmbed({ open, outputMint, inputMint = "So11111111111111111111111111111111111111112", referralAccount }) {
  const wallet = useWallet();
  // Safe destructuring in case context is missing
  let setVisible = () => console.warn("Wallet modal context missing");
  try {
    const modal = useWalletModal();
    if (modal) setVisible = modal.setVisible;
  } catch (e) {
    // Ignore context error if using custom adapter without modal context
  }

  const [isLoaded, setIsLoaded] = useState(false);
  const initializedRef = useRef(false);

  // Main Init Effect
  useEffect(() => {
    if (!open) return;

    const initJupiter = async () => {
      try {
        const el = document.getElementById("jupiter-swap-container");
        if (!el) return;

        // Cleanup previous instance if exists
        if (window.Jupiter && window.Jupiter.close) {
          try { window.Jupiter.close(); } catch (e) { console.warn("Jup close error", e); }
        }
        
        // Reset container and state
        el.innerHTML = ""; 
        initializedRef.current = false;
        setIsLoaded(false);

        // Load script if not present
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
        if (!jupiter) throw new Error("Jupiter plugin failed to load");

        // Initialize with robust settings
        jupiter.init({
          displayMode: "integrated",
          integratedTargetId: "jupiter-swap-container",
          endpoint: RPC_ENDPOINT,
          formProps: {
            initialInputMint: inputMint,
            initialOutputMint: outputMint,
            fixedOutputMint: true, // Lock output token
            swapMode: "ExactIn",
            ...(referralAccount ? {
              referralAccount,
              referralFee: 255,
            } : {}),
          },
          enableWalletPassthrough: true,
          passthroughWalletContextState: wallet.connected ? wallet : undefined,
          onRequestConnectWallet: () => setVisible(true),
          containerStyles: { 
            width: "100%", 
            height: "520px", 
            borderRadius: "16px", 
            overflow: "hidden",
            background: "transparent",
            minHeight: "520px",
          },
          branding: {
            name: "NextTrade",
            logoUri: "https://i.postimg.cc/QxX1dBnR/nexttrade-logo2.png",
          },
        });

        initializedRef.current = true;
        setIsLoaded(true);

      } catch (err) {
        console.error("Jupiter Init Error:", err);
      }
    };

    initJupiter();

    // Cleanup on unmount or prop change
    return () => {
      const el = document.getElementById("jupiter-swap-container");
      if (window.Jupiter && window.Jupiter.close) {
        try { window.Jupiter.close(); } catch (e) {}
      }
      if (el) el.innerHTML = "";
      initializedRef.current = false;
    };
  }, [open, outputMint, inputMint, referralAccount]);

  // Sync Props Effect (Separate)
  useEffect(() => {
    if (open && initializedRef.current && window.Jupiter && window.Jupiter.syncProps) {
      window.Jupiter.syncProps({ passthroughWalletContextState: wallet });
    }
  }, [open, wallet.connected, wallet.publicKey]);

  return (
    <div className="w-full relative min-h-[520px] bg-gray-900/50 rounded-2xl border border-gray-800">
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      )}
      <div id="jupiter-swap-container" className="w-full h-full min-h-[520px]" />
    </div>
  );
}