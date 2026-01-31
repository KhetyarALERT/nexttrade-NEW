export const resolveIpfsUrl = (url) => {
  if (!url) return "/placeholder-token.png";
  
  // Handle already resolved URLs or non-IPFS URLs
  if (url.startsWith('http')) {
    // Replace broken/slow gateways
    // dweb.link is unstable. cf-ipfs.com is often rate limited.
    // ipfs.io is the public gateway, usually slower but standard.
    // gateway.pinata.cloud is often reliable.
    if (url.includes('ipfs.io') || url.includes('cf-ipfs.com') || url.includes('dweb.link')) {
      // Rotate gateways or stick to a reliable one
      return url.replace('ipfs.io', 'gateway.pinata.cloud')
                .replace('cf-ipfs.com', 'gateway.pinata.cloud')
                .replace('dweb.link', 'gateway.pinata.cloud');
    }
    return url;
  }

  // Handle "ipfs://" protocol
  let hash = url;
  if (url.startsWith('ipfs://')) {
    hash = url.replace('ipfs://', '');
  }

  // Check if it's just a hash (simple regex for CID)
  if (hash.match(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[0-9a-z]{50,})/)) {
    return `https://gateway.pinata.cloud/ipfs/${hash}`;
  }

  return url;
};