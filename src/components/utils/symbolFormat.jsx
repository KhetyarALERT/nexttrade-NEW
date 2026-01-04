// Standard internal format: BTC-USDT (dash)
// Display format: BTC/USDT (slash)
// BingX/WebSocket format: BTC-USDT (dash)

export const toInternalFormat = (symbol) => {
  if (!symbol) return '';
  return String(symbol).replace('/', '-').toUpperCase();
};

export const toDisplayFormat = (symbol) => {
  if (!symbol) return '';
  return String(symbol).replace('-', '/').toUpperCase();
};

export const toBingXFormat = (symbol) => {
  return toInternalFormat(symbol);
};