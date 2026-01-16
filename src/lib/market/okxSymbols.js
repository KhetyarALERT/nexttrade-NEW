export function normalizeOkxSymbol(symbol) {
  const raw = String(symbol || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw.includes('-')) {
    const base = raw.replace(/\s+/g, '');
    if (base.endsWith('-SWAP')) return base;
    if (base.includes('-USDT')) return `${base}-SWAP`;
    return base;
  }
  if (raw.endsWith('USDT')) {
    const base = raw.slice(0, -4);
    return `${base}-USDT-SWAP`;
  }
  return raw;
}

export function formatOkxSymbolDisplay(instId) {
  const normalized = normalizeOkxSymbol(instId);
  const cleaned = normalized.replace(/-SWAP$/i, '');
  return cleaned.replace('-', '/');
}

export function getOkxBaseAsset(instId) {
  const normalized = normalizeOkxSymbol(instId);
  return normalized.split('-')[0] || normalized;
}
