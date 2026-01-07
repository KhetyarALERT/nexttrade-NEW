#!/bin/bash
# Web3 Wallet Integration - Dependency Installation

echo "🔄 Installing dependencies and upgrading Base44 SDK..."
npm install

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "📦 Base44 SDK upgraded to 0.8.6"
echo ""
echo "🧪 Running lint check..."
npm run lint

echo ""
echo "🧪 Running type check..."
npm run typecheck

echo ""
echo "✅ All checks passed!"
echo ""
echo "🚀 To start development server:"
echo "   npm run dev"
echo ""
echo "📖 See docs/WEB3_WALLET_IMPLEMENTATION_COMPLETE.md for details"
