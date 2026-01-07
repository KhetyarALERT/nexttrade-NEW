import { base44 } from './base44Client';


export const Query = base44.entities.Query;

// Rewards / wallets / staking entities (may require permissions configuration in Base44)
export const VoucherClaim = base44.entities.VoucherClaim;
export const WalletTransaction = base44.entities.WalletTransaction;
export const StakingPosition = base44.entities.StakingPosition;
export const Web3Wallet = base44.entities.Web3Wallet;


// auth sdk:
export const User = base44.auth;