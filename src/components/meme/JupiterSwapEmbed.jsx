import React, { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Loader2 } from 'lucide-react';
import { init } from '@jup-ag/terminal';
import '@jup-ag/terminal/css';

export default function JupiterSwapEmbed({ open, outputMint, inputMint = "So11111111111111111111111111111111111111112", referralAccount }) {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef(null);
  const instanceRef = useRef(null);
  const lastMintRef = useRef(null);

  // Main Init Effect
  useEffect(() => {
    // 1. Cleanup if not open or if mint changed (we'll re-init)
    if (!open || !outputMint) {
      if (instanceRef.current) {
        // Attempt to close standard way if API supports it, otherwise just null ref
        // The library typically handles cleanup via close() or by overwriting if target ID reused
        // But explicit close is safer if available globally or on instance
        if (window.Jupiter && window.Jupiter.close) {
            try { window.Jupiter.close(); } catch (e) { console.warn(e); }
        }
        instanceRef.current = null;
      }
      return;
    }

    // Avoid re-init if same mint (unless needed)
    if (instanceRef.current && lastMintRef.current === outputMint) {
      return;
    }

    const launchJupiter = async () => {
      try {
        setIsLoaded(false);
        
        // Clear container manually to be safe
        const el = document.getElementById("integrated-terminal");
        if (el) el.innerHTML = "";

        // Initialize Jupiter Terminal (RPC-less mode via Plugin/Ultra)
        await init({
          displayMode: "integrated",
          integratedTargetId: "integrated-terminal",
          // RPC-less: Do NOT pass endpoint
          
          formProps: {
            initialInputMint: inputMint,
            initialOutputMint: outputMint,
            fixedOutputMint: true, // Lock output token (safety for specific meme coin)
            swapMode: "ExactIn",
            ...(referralAccount ? {
              referralAccount,
              referralFee: 255,
            } : {}),
          },
          strictTokenList: false, // Essential for pump.fun / new meme coins
          defaultExplorer: "SolanaFM",
          
          // Wallet Passthrough
          enableWalletPassthrough: true,
          passthroughWalletContextState: wallet,
          onRequestConnectWallet: () => setVisible(true),
          
          // Branding
          branding: {
            name: "NextTrade",
            logoUri: "https://i.postimg.cc/QxX1dBnR/nexttrade-logo2.png",
          },
        });

        instanceRef.current = true;
        lastMintRef.current = outputMint;
        setIsLoaded(true);

      } catch (err) {
        console.error("Jupiter Plugin Init Error:", err);
      }
    };

    launchJupiter();

    // Cleanup on unmount
    return () => {
      if (window.Jupiter && window.Jupiter.close) {
        try { window.Jupiter.close(); } catch (e) {}
      }
      instanceRef.current = null;
    };
  }, [open, outputMint, inputMint, referralAccount, setVisible]);

  // Sync Props Effect - To prevent spam/lag, only run on meaningful changes
  useEffect(() => {
    if (!open || !instanceRef.current || !window.Jupiter?.syncProps) return;
    
    // Sync wallet state
    window.Jupiter.syncProps({ passthroughWalletContextState: wallet });
    
  }, [open, wallet.connected, wallet.publicKey?.toBase58()]);

  if (!open) return null;

  return (
    <div className="w-full relative min-h-[520px] bg-[#0f172a] rounded-2xl border border-gray-800 overflow-hidden">
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0f172a]">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      )}
      {/* Explicit ID for the integrated target */}
      <div id="integrated-terminal" className="w-full h-full min-h-[520px]" />
    </div>
  );
}