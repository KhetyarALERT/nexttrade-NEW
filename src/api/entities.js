import { base44 } from './base44Client';

// Entities that exist in Base44 dashboard
export const Subaccount = base44.entities.Subaccount;
export const SpotAccount = base44.entities.SpotAccount;
export const FuturesAccount = base44.entities.FuturesAccount;
export const InternalTransfer = base44.entities.InternalTransfer;
export const TradingAccount = base44.entities.TradingAccount;
export const Trade = base44.entities.Trade;
export const Wallet = base44.entities.Wallet;
export const WalletTransaction = base44.entities.WalletTransaction;
export const StakingPosition = base44.entities.StakingPosition;
export const CustodyAccount = base44.entities.CustodyAccount;
export const UserPreferences = base44.entities.UserPreferences;
export const Notification = base44.entities.Notification;

// Auth SDK
export const User = base44.auth;