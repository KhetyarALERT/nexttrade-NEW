import PropTypes from "prop-types";

// Use CoinGecko CDN for high-quality crypto logos
const COINGECKO_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  LTC: 'litecoin',
  SHIB: 'shiba-inu',
  TRX: 'tron',
  ATOM: 'cosmos',
  UNI: 'uniswap',
  APT: 'aptos',
  ARB: 'arbitrum',
  OP: 'optimism',
  NEAR: 'near',
  USDT: 'tether',
  USDC: 'usd-coin',
  FIL: 'filecoin',
  AAVE: 'aave',
  MKR: 'maker',
  CRV: 'curve-dao-token',
  SNX: 'havven',
  COMP: 'compound-governance-token',
  SUSHI: 'sushi',
  YFI: 'yearn-finance',
  SAND: 'the-sandbox',
  MANA: 'decentraland',
  AXS: 'axie-infinity',
  ENJ: 'enjincoin',
  GALA: 'gala',
  IMX: 'immutable-x',
  LDO: 'lido-dao',
  RPL: 'rocket-pool',
  GMX: 'gmx',
  PEPE: 'pepe',
  WLD: 'worldcoin-wld',
  SEI: 'sei-network',
  SUI: 'sui',
  INJ: 'injective-protocol',
  TIA: 'celestia',
  JUP: 'jupiter-exchange-solana',
  BONK: 'bonk',
  WIF: 'dogwifcoin',
  FLOKI: 'floki'
};

export default function CryptoIcon({ currency, size = "md", className = "" }) {
  const sizeClasses = {
    xs: "w-4 h-4",
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-10 h-10",
    xl: "w-12 h-12"
  };

  const symbol = currency?.toUpperCase();
  const coinId = COINGECKO_IDS[symbol];
  
  if (coinId) {
    return (
      <img 
        src={`https://assets.coingecko.com/coins/images/1/small/${coinId === 'bitcoin' ? 'bitcoin' : ''}.png`}
        alt={symbol}
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
        onError={(e) => {
          // Fallback to CryptoCompare if CoinGecko fails
          e.target.onerror = null;
          e.target.src = `https://www.cryptocompare.com/media/37746251/${symbol?.toLowerCase()}.png`;
        }}
        // Use CryptoCompare as primary - more reliable
        src={`https://www.cryptocompare.com/media/37746251/${symbol?.toLowerCase()}.png`}
      />
    );
  }
  
  // Fallback gradient icon
  return (
    <div 
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold ${className}`}
      style={{ fontSize: size === 'xs' ? '8px' : size === 'sm' ? '10px' : '12px' }}
    >
      {symbol?.charAt(0) || "?"}
    </div>
  );
}

CryptoIcon.propTypes = {
  currency: PropTypes.string.isRequired,
  size: PropTypes.oneOf(["xs", "sm", "md", "lg", "xl"]),
  className: PropTypes.string
};