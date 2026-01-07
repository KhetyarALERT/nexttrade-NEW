#!/bin/bash

# WalletConnect v2 Setup Script
# This script installs dependencies and sets up WalletConnect v2 for PWA support

echo "🚀 Setting up WalletConnect v2 for PWA support..."
echo ""

# 1. Install dependencies
echo "📦 Installing WalletConnect v2 dependencies..."
npm install @wagmi/core@^2.13.4 @wagmi/connectors@^5.1.5 @web3modal/wagmi@^5.1.5 viem@^2.21.4 wagmi@^2.12.9

if [ $? -ne 0 ]; then
  echo "❌ Failed to install dependencies"
  exit 1
fi

echo "✅ Dependencies installed"
echo ""

# 2. Check if .env file exists
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cat > .env << EOF
# WalletConnect Project ID
# Get yours at: https://cloud.walletconnect.com
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here

# App Metadata
VITE_APP_NAME=NextTrade
VITE_APP_URL=https://nexttrade.app
EOF
  echo "✅ Created .env file"
  echo ""
else
  echo "ℹ️  .env file already exists"
  echo ""
fi

# 3. Check if VITE_WALLETCONNECT_PROJECT_ID is set
if ! grep -q "VITE_WALLETCONNECT_PROJECT_ID=" .env; then
  echo "⚠️  VITE_WALLETCONNECT_PROJECT_ID not found in .env"
  echo "   Adding it now..."
  echo "" >> .env
  echo "# WalletConnect Project ID" >> .env
  echo "# Get yours at: https://cloud.walletconnect.com" >> .env
  echo "VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here" >> .env
  echo ""
fi

echo "══════════════════════════════════════════════════════════"
echo "✅ WalletConnect v2 Setup Complete!"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Get a WalletConnect Project ID:"
echo "   → Visit: https://cloud.walletconnect.com"
echo "   → Sign in with GitHub"
echo "   → Create a new project"
echo "   → Copy your Project ID"
echo ""
echo "2. Add your Project ID to .env file:"
echo "   → Open .env file"
echo "   → Replace 'your_project_id_here' with your actual Project ID"
echo ""
echo "3. Start the development server:"
echo "   → npm run dev"
echo ""
echo "4. Test wallet connection:"
echo "   → Desktop: Should show injected wallets (MetaMask, etc.)"
echo "   → Mobile: Should show WalletConnect QR + deep links"
echo "   → PWA: Should open wallet apps via deep links"
echo ""
echo "══════════════════════════════════════════════════════════"
echo ""
echo "📱 Platform Support:"
echo "   ✅ Desktop browsers (Chrome, Firefox, Safari, Edge)"
echo "   ✅ Mobile browsers (Safari iOS, Chrome Android)"
echo "   ✅ iOS PWA (Add to Home Screen from Safari)"
echo "   ✅ Android PWA (Add to Home Screen from Chrome)"
echo ""
echo "🔗 Supported Wallets:"
echo "   • MetaMask"
echo "   • Trust Wallet"
echo "   • Coinbase Wallet"
echo "   • Rainbow"
echo "   • Uniswap Wallet"
echo "   • 100+ more via WalletConnect"
echo ""
echo "══════════════════════════════════════════════════════════"
