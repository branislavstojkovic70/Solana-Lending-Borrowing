import { PublicKey } from "@solana/web3.js";

export interface LendingMarketConfig {
  quoteCurrency: string;
  owner: PublicKey;
}

export interface CreateMarketResult {
  marketAddress: string;
  signature: string;
}

export interface LendingMarketState {
  loading: boolean;
  error: string | null;
  createdMarket: CreateMarketResult | null;
}

export interface LendingMarketInfo {
  version: number;
  owner: PublicKey;
  quoteCurrency: Uint8Array;
  bumpSeed: number;
  tokenProgramId: PublicKey;
}