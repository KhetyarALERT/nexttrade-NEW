import { base44 } from './base44Client';

const ensureFunctionsApi = () => {
  if (typeof base44?.functions?.invoke !== 'function') {
    throw new Error('Base44 functions API is not available.');
  }
  return base44.functions.invoke.bind(base44.functions);
};

const invokeFunction = async (name, payload) => {
  const invoke = ensureFunctionsApi();
  return invoke(name, payload);
};

export const fetchMarketPrices = async (payload) => {
  return invokeFunction('fetchMarketPrices', payload);
};

export const fetchCurrentUser = async () => {
  if (typeof base44?.auth?.me !== 'function') {
    throw new Error('Base44 auth API is not available.');
  }
  return base44.auth.me();
};

export const updateCurrentUser = async (data) => {
  if (typeof base44?.auth?.updateMe !== 'function') {
    throw new Error('Base44 auth API is not available for updates.');
  }
  return base44.auth.updateMe(data);
};

export const fetchPortfolioSnapshot = async (payload) => {
  return invokeFunction('getPortfolioSnapshot', payload);
};

export const fetchWalletBalances = async (payload) => {
  return invokeFunction('getWalletBalances', payload);
};

export const createWalletTransaction = async (payload) => {
  return invokeFunction('createWalletTransaction', payload);
};

export const fetchReferralStats = async (payload) => {
  return invokeFunction('getReferralStats', payload);
};

export const fetchSubscriptionPlans = async (payload) => {
  return invokeFunction('getSubscriptionPlans', payload);
};
