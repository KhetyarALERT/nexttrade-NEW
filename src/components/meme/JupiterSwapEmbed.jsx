import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { init } from '@jup-ag/plugin';
import '@jup-ag/plugin/css';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export default function JupiterSwapEmbed({ open, outputMint, inputMint = "So11111111111111111111111111111111111111112", referralAccount, initialAmount, onSwapSuccess, onSwapError }) {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastSwapStatus, setLastSwapStatus] = useState(null); // 'success' | 'error' | null
  const instanceRef = useRef(null);
  const lastMintRef = useRef(null);
  const lastAmountRef = useRef(null);

  // Environment variable for referral account (placeholder)
  const ENV_REFERRAL_ACCOUNT = import.meta.env.VITE_JUP_REFERRAL_ACCOUNT;
  const activeReferralAccount = referralAccount || ENV_REFERRAL_ACCOUNT;

  // Swap success handler with confetti celebration
  const handleSwapSuccess = useCallback(({ txid, swapResult, quoteResponseMeta }) => {
    setLastSwapStatus('success');
    
    // Fire confetti celebration
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#22c55e', '#10b981', '#3b82f6', '#f59e0b']
    });
    
    // Show success toast with transaction link
    toast.success(
      <div className="flex flex-col gap-1">
        <span className="font-semibold">Swap Successful! 🎉</span>
        <a 
          href={`https://solscan.io/tx/${txid}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline"
        >
          View on Solscan →
        </a>
      </div>,
      { duration: 6000 }
    );
    
    // Call parent callback if provided
    onSwapSuccess?.({ txid, swapResult, quoteResponseMeta });
    
    // Reset status after animation
    setTimeout(() => setLastSwapStatus(null), 3000);
  }, [onSwapSuccess]);

  // Swap error handler
  const handleSwapError = useCallback(({ error, quoteResponseMeta }) => {
    setLastSwapStatus('error');
    
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    
    // Show error toast
    toast.error(
      <div className="flex flex-col gap-1">
        <span className="font-semibold">Swap Failed</span>
        <span className="text-xs text-red-300">{errorMessage.slice(0, 100)}</span>
      </div>,
      { duration: 5000 }
    );
    
    // Call parent callback if provided
    onSwapError?.({ error, quoteResponseMeta });
    
    // Reset status after animation
    setTimeout(() => setLastSwapStatus(null), 3000);
  }, [onSwapError]);

  // Main Init Effect
  useEffect(() => {
    // 1. Cleanup if not open or if mint changed
    if (!open || !outputMint) {
      if (window.Jupiter && window.Jupiter.close) {
        try { window.Jupiter.close(); } catch (e) { console.warn(e); }
      }
      instanceRef.current = null;
      return;
    }

    // Avoid re-init if same mint/amount and already running
    if (instanceRef.current && lastMintRef.current === outputMint && lastAmountRef.current === initialAmount) {
      return;
    }

    const launchJupiter = async () => {
      try {
        setIsLoaded(false);
        
        // Explicitly clear container
        const el = document.getElementById("jupiter-swap-container");
        if (el) el.innerHTML = "";
        
        // Close any existing instance
        if (window.Jupiter && window.Jupiter.close) {
            try { window.Jupiter.close(); } catch (e) {}
        }

        // Initialize Jupiter Plugin (Ultra) - RPC-less
        await init({
          displayMode: "integrated",
          integratedTargetId: "jupiter-swap-container",
          // RPC-less: No endpoint property here
          
          formProps: {
            initialInputMint: inputMint,
            initialOutputMint: outputMint,
            initialAmount: initialAmount ? (initialAmount * 1000000000).toString() : undefined,
            fixedMint: true, // As per Plugin docs for locking output
            swapMode: "ExactIn",
            ...(activeReferralAccount ? {
              referralAccount: activeReferralAccount,
              referralFee: 255,
              feeBps: 100, // 1% fee
            } : {}),
          },
          strictTokenList: false, // Critical for pump.fun / new meme coins
          defaultExplorer: "SolanaFM",
          
          // Wallet Passthrough
          enableWalletPassthrough: true,
          passthroughWalletContextState: wallet,
          onRequestConnectWallet: () => setVisible(true),
          
          // Swap callbacks for success/error handling
          onSuccess: handleSwapSuccess,
          onSwapError: handleSwapError,
          
          // Branding
          branding: {
            name: "NextTrade",
            logoUri: "https://i.postimg.cc/QxX1dBnR/nexttrade-logo2.png",
          },
          
          containerStyles: { 
            width: "100%", 
            height: "520px", 
            borderRadius: "16px", 
            overflow: "hidden",
            background: "#0f172a" 
          }
        });

        instanceRef.current = true;
        lastMintRef.current = outputMint;
        lastAmountRef.current = initialAmount;
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
  }, [open, outputMint, inputMint, activeReferralAccount, setVisible, initialAmount, handleSwapSuccess, handleSwapError]);

  // Sync Props Effect - Only on meaningful wallet changes
  useEffect(() => {
    if (!open || !instanceRef.current || !window.Jupiter?.syncProps) return;
    
    // Sync wallet state to plugin
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
      <div id="jupiter-swap-container" className="w-full h-full min-h-[520px]" />
    </div>
  );
}