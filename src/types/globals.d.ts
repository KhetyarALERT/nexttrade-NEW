/* Global type augmentations for the NextTrade app */

// Product Fruits onboarding SDK (loaded via script tag)
interface ProductFruitsAPI {
  tours?: {
    tryStartTour: (tourKey: string) => void;
  };
  [key: string]: any;
}

interface ProductFruits {
  init: (workspaceCode: string, language: string, userInfo: Record<string, any>) => void;
  api?: ProductFruitsAPI;
  services?: {
    destroy?: () => void;
    [key: string]: any;
  };
  [key: string]: any;
}

interface Window {
  productFruits?: ProductFruits;
}
