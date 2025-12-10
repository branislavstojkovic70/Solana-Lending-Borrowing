import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { Program } from "@coral-xyz/anchor";
import type {
  UserStats,
  SupplyPosition,
  BorrowPosition,
  CollateralPosition,
  UserPositions,
} from "./types";
import type { Lendborrow } from "../../utils/idltype";

const SCALE_FACTOR = 1e18;

export async function getUserStats(
  program: Program<Lendborrow>,
  userPubkey: PublicKey,
  lendingMarket: PublicKey
): Promise<UserStats> {
  try {
    const [obligationPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("obligation"),
        lendingMarket.toBuffer(),
        userPubkey.toBuffer(),
      ],
      program.programId
    );

    let obligation;
    try {
      obligation = await program.account.obligation.fetch(obligationPDA);
    } catch {
      return {
        totalSupplied: 0,
        totalBorrowed: 0,
        netAPY: 0,
        healthFactor: 0,
        availableToBorrow: 0,
        totalSuppliedUSD: 0,
        totalBorrowedUSD: 0,
      };
    }

    const totalSuppliedUSD = parseFloat(
      obligation.depositedValue.toString()
    ) / 1e6;

    const totalBorrowedUSD = parseFloat(
      obligation.borrowedValue.toString()
    ) / 1e6;

    const healthFactor = calculateHealthFactor(
      obligation.depositedValue,
      obligation.borrowedValue,
      obligation.unhealthyBorrowValue
    );

    const allowedBorrowValue = parseFloat(
      obligation.allowedBorrowValue.toString()
    ) / 1e6;
    const availableToBorrow = Math.max(0, allowedBorrowValue - totalBorrowedUSD);

    // TODO: Calculate weighted APY
    const netAPY = 0;

    return {
      totalSupplied: totalSuppliedUSD,
      totalBorrowed: totalBorrowedUSD,
      netAPY,
      healthFactor,
      availableToBorrow,
      totalSuppliedUSD,
      totalBorrowedUSD,
    };
  } catch (error) {
    console.error("Error fetching user stats:", error);
    throw error;
  }
}

export async function getUserSupplyPositions(
  program: Program<Lendborrow>,
  userPubkey: PublicKey,
  lendingMarket: PublicKey
): Promise<SupplyPosition[]> {
  try {
    const reserves = await program.account.reserve.all([
      {
        memcmp: {
          offset: 8 + 1, 
          bytes: lendingMarket.toBase58(),
        },
      },
    ]);

    const positions: SupplyPosition[] = [];

    for (const { publicKey: reserveKey, account: reserve } of reserves) {
      const [collateralMint] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("collateral-mint"),
          lendingMarket.toBuffer(),
          //@ts-ignore
          reserve.liquidity.mintPubkey.toBuffer(),
        ],
        program.programId
      );

      //@ts-ignore
      const [userCollateralATA] = PublicKey.findProgramAddressSync(
        [
          userPubkey.toBuffer(),
        //@ts-ignore
          program.provider.connection
            .getAccountInfo(collateralMint)
            .then(() => Buffer.from([0])), 
          collateralMint.toBuffer(),
        ],
        new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
      );

      try {
        const collateralAccount =
          await program.provider.connection.getAccountInfo(userCollateralATA);

        if (!collateralAccount) continue;

        //@ts-ignore
        const collateralAmount = Number(new BN(collateralAccount.data.slice(64, 72), "le")) / Math.pow(10, reserve.liquidity.mintDecimals);

        if (collateralAmount === 0) continue;

        const exchangeRate = calculateExchangeRate(reserve);

        const amount = collateralAmount * exchangeRate;

        const priceUSD = 1; 
        const amountUSD = amount * priceUSD;

        const utilization = calculateUtilization(reserve);
        const borrowRate = calculateBorrowRate(reserve, utilization);
        const apy = calculateSupplyAPY(
          borrowRate,
          utilization,
          reserve.config.protocolTakeRate
        );

        //@ts-ignore
        const assetInfo = getAssetInfo(reserve.liquidity.mintPubkey.toBase58());

        positions.push({
          reserve: reserveKey,
          asset: assetInfo.symbol,
          icon: assetInfo.icon,
          amount,
          amountUSD,
          apy,
          collateralAmount,
          exchangeRate,
        });
      } catch (err) {
        continue;
      }
    }

    return positions;
  } catch (error) {
    return [];
  }
}

export async function getUserBorrowPositions(
  program: Program<Lendborrow>,
  userPubkey: PublicKey,
  lendingMarket: PublicKey
): Promise<BorrowPosition[]> {
  try {
    const [obligationPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("obligation"),
        lendingMarket.toBuffer(),
        userPubkey.toBuffer(),
      ],
      program.programId
    );

    let obligation;
    try {
      obligation = await program.account.obligation.fetch(obligationPDA);
    } catch {
      return [];
    }

    if (obligation.borrowsLen === 0) return [];

    const positions: BorrowPosition[] = [];
    const borrowsData = obligation.dataFlat;
    const depositOffset = obligation.depositsLen * 56;

    for (let i = 0; i < obligation.borrowsLen; i++) {
      const offset = depositOffset + i * 80;

      const reserveBytes = borrowsData.slice(offset, offset + 32);
      const borrowedAmountWadsBytes = borrowsData.slice(offset + 48, offset + 64);

      const reserveKey = new PublicKey(reserveBytes);
      const borrowedAmountWads = new BN(borrowedAmountWadsBytes, "le");

      const amount = Number(borrowedAmountWads) / SCALE_FACTOR;

      if (amount === 0) continue;

      const reserve = await program.account.reserve.fetch(reserveKey);

      //@ts-ignore
      const assetInfo = getAssetInfo(reserve.liquidity.mintPubkey.toBase58());

      const utilization = calculateUtilization(reserve);
      const apy = calculateBorrowRate(reserve, utilization);

      // TODO: Calculate accrued interest
      const accruedInterest = 0;

      const priceUSD = 1; // TODO: Get real price
      const amountUSD = amount * priceUSD;

      positions.push({
        reserve: reserveKey,
        asset: assetInfo.symbol,
        icon: assetInfo.icon,
        amount,
        amountUSD,
        apy,
        accruedInterest,
      });
    }

    return positions;
  } catch (error) {
    console.error("Error fetching borrow positions:", error);
    return [];
  }
}

export async function getUserCollateralPositions(
  program: Program<Lendborrow>,
  userPubkey: PublicKey,
  lendingMarket: PublicKey
): Promise<CollateralPosition[]> {
  try {
    const [obligationPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("obligation"),
        lendingMarket.toBuffer(),
        userPubkey.toBuffer(),
      ],
      program.programId
    );

    let obligation;
    try {
      obligation = await program.account.obligation.fetch(obligationPDA);
    } catch {
      return [];
    }

    if (obligation.depositsLen === 0) return [];

    const positions: CollateralPosition[] = [];
    const depositsData = obligation.dataFlat;

    for (let i = 0; i < obligation.depositsLen; i++) {
      const offset = i * 56;

      // Parse deposit data
      const reserveBytes = depositsData.slice(offset, offset + 32);
      const depositedAmountBytes = depositsData.slice(offset + 32, offset + 40);

      const reserveKey = new PublicKey(reserveBytes);
      const depositedAmount = new BN(depositedAmountBytes, "le");

      const amount = Number(depositedAmount) / 1e9; // Assuming 9 decimals

      if (amount === 0) continue;

      const reserve = await program.account.reserve.fetch(reserveKey);
      //@ts-ignore
      const assetInfo = getAssetInfo(reserve.liquidity.mintPubkey.toBase58());

      const priceUSD = 1; // TODO: Get real price
      const amountUSD = amount * priceUSD;

      positions.push({
        reserve: reserveKey,
        asset: assetInfo.symbol,
        icon: assetInfo.icon,
        amount,
        amountUSD,
        ltv: reserve.config.loanToValueRatio,
      });
    }

    return positions;
  } catch (error) {
    console.error("Error fetching collateral positions:", error);
    return [];
  }
}

function calculateHealthFactor(
  depositedValue: BN,
  borrowedValue: BN,
  unhealthyBorrowValue: BN
): number {
  const borrowed = parseFloat(borrowedValue.toString());
  if (borrowed === 0) return Infinity;

  const unhealthy = parseFloat(unhealthyBorrowValue.toString());
  return unhealthy / borrowed;
}

function calculateExchangeRate(reserve: any): number {
  const totalCollateral = Number(reserve.collateral.mintTotalSupply);
  if (totalCollateral === 0) return 1.0;

  const borrowed = Number(reserve.liquidity.borrowedAmountSf) / SCALE_FACTOR;
  const available = Number(reserve.liquidity.availableAmount);
  const totalLiquidity = borrowed + available;

  return totalLiquidity / totalCollateral;
}

function calculateUtilization(reserve: any): number {
  const borrowed = Number(reserve.liquidity.borrowedAmountSf) / SCALE_FACTOR;
  const available = Number(reserve.liquidity.availableAmount);
  const total = borrowed + available;

  if (total === 0) return 0;
  return (borrowed / total) * 100;
}

function calculateBorrowRate(reserve: any, utilization: number): number {
  const config = reserve.config;
  const optimalUtil = config.optimalUtilizationRate;

  if (utilization <= optimalUtil) {
    const slope = (config.optimalBorrowRate - config.minBorrowRate) / optimalUtil;
    return config.minBorrowRate + slope * utilization;
  } else {
    const excessUtil = utilization - optimalUtil;
    const excessRange = 100 - optimalUtil;
    const slope = (config.maxBorrowRate - config.optimalBorrowRate) / excessRange;
    return config.optimalBorrowRate + slope * excessUtil;
  }
}

function calculateSupplyAPY(
  borrowRate: number,
  utilization: number,
  protocolFee: number
): number {
  const utilizationDecimal = utilization / 100;
  const protocolFeeDecimal = protocolFee / 100;
  return borrowRate * utilizationDecimal * (1 - protocolFeeDecimal);
}

function getAssetInfo(mintAddress: string): { symbol: string; icon: string } {
  const knownAssets: Record<string, { symbol: string; icon: string }> = {
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
      symbol: "USDC",
      icon: "/assets/usdc.png",
    },
    So11111111111111111111111111111111111111112: {
      symbol: "SOL",
      icon: "/assets/sol.png",
    },
  };

  return (
    knownAssets[mintAddress] || {
      symbol: "UNKNOWN",
      icon: "/assets/default.png",
    }
  );
}