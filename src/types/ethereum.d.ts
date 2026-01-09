interface Window {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    isMetaMask?: boolean;
  };
  // Jupiter Terminal (loaded dynamically)
  Jupiter?: {
    init: (config: {
      displayMode?: string;
      integratedTargetId?: string;
      endpoint?: string;
      strictTokenList?: boolean;
      defaultExplorer?: string;
      formProps?: {
        initialOutputMint?: string;
        fixedOutputMint?: boolean;
        initialInputMint?: string;
      };
      platformFeeAndAccounts?: {
        feeBps?: number;
        feeAccounts?: Map<string, string>;
      };
    }) => void;
    close?: () => void;
  };
  // IE-specific
  MSStream?: unknown;
}

interface Navigator {
  // iOS Safari PWA detection
  standalone?: boolean;
}
