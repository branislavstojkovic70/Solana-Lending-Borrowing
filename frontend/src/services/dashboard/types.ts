// src/services/dashboard/types.ts

import { PublicKey } from "@solana/web3.js";

export interface UserStats {
  totalSupplied: number;
  totalBorrowed: number;
  netAPY: number;
  healthFactor: number;
  availableToBorrow: number;
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
}

export interface SupplyPosition {
  reserve: PublicKey;
  asset: string;
  icon: string;
  amount: number;
  amountUSD: number;
  apy: number;
  collateralAmount: number;
  exchangeRate: number;
}

export interface BorrowPosition {
  reserve: PublicKey;
  asset: string;
  icon: string;
  amount: number;
  amountUSD: number;
  apy: number;
  accruedInterest: number;
}

export interface CollateralPosition {
  reserve: PublicKey;
  asset: string;
  icon: string;
  amount: number;
  amountUSD: number;
  ltv: number;
}

export interface UserPositions {
  supplies: SupplyPosition[];
  borrows: BorrowPosition[];
  collaterals: CollateralPosition[];
}

export interface RecentTransaction {
  signature: string;
  type: "supply" | "withdraw" | "borrow" | "repay" | "deposit_collateral" | "withdraw_collateral";
  asset: string;
  amount: number;
  timestamp: number;
  status: "confirmed" | "pending" | "failed";
}

export interface DashboardData {
  stats: UserStats;
  positions: UserPositions;
  recentActivity: RecentTransaction[];
  loading: boolean;
  error: string | null;
}