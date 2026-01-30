export const resolveIpfsUrl = (url) => {
  if (!url) return "/placeholder-token.png";
  
  // Handle already resolved URLs or non-IPFS URLs
  if (url.startsWith('http')) {
    // Replace broken/slow gateways (cf-ipfs.com is currently down)
    if (url.includes('ipfs.io') || url.includes('cf-ipfs.com')) {
      return url.replace('ipfs.io', 'dweb.link').replace('cf-ipfs.com', 'dweb.link');
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
    return `https://dweb.link/ipfs/${hash}`;
  }

  return url;
};