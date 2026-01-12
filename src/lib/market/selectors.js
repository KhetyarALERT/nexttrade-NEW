export const selectBestPair = (pairs) => {
  if (!pairs?.length) return null;
  return [...pairs].sort((a, b) => {
    const liquidityDiff = (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0);
    if (liquidityDiff !== 0) return liquidityDiff;
    return (b.volume24h ?? 0) - (a.volume24h ?? 0);
  })[0];
};

export const formatCompactNumber = (value) => {
  if (!value || Number.isNaN(value)) return '—';
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
};

export const formatPrice = (price) => {
  if (!price || Number.isNaN(price)) return '$0.00';
  if (price < 0.00001) return `$${price.toExponential(2)}`;
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
};

export const formatAge = (timestamp) => {
  if (!timestamp) return '—';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
};

export const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '0.0%';
  const rounded = Math.abs(value).toFixed(2);
  return `${value >= 0 ? '+' : '-'}${rounded}%`;
};

export const formatTokenAmount = (amount, decimals = 6) => {
  if (!amount) return '0';
  const num = Number(amount) / Math.pow(10, decimals);
  if (Number.isNaN(num)) return '0';
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  if (num < 0.001) return num.toFixed(6);
  return num.toFixed(4);
};
