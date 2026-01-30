export const resolveIpfsUrl = (url) => {
  if (!url) return "/placeholder-token.png";
  
  // Handle already resolved URLs or non-IPFS URLs
  if (url.startsWith('http')) {
    if (url.includes('ipfs.io')) {
      return url.replace('ipfs.io', 'cf-ipfs.com');
    }
    return url;
  }

  // Handle "ipfs://" protocol
  let hash = url;
  if (url.startsWith('ipfs://')) {
    hash = url.replace('ipfs://', '');
  }

  // Check if it's just a hash (simple regex for CID)
  // CIDv0 is 46 chars starting with Qm, CIDv1 is 59+ starting with bafy
  if (hash.match(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[0-9a-z]{50,})/)) {
    return `https://cf-ipfs.com/ipfs/${hash}`;
  }

  return url;
};