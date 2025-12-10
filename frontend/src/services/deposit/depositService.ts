// src/services/reserves/depositReserveLiquidityService.ts
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import type { Lendborrow } from "../../utils/idltype";

export interface DepositLiquidityConfig {
  reserve: PublicKey;
  liquidityAmount: number; // UI amount (e.g., 100 USDC)
  userPublicKey: PublicKey;
}

export interface DepositLiquidityResult {
  signature: string;
  collateralAmount: string;
  liquidityAmount: string;
}

/**
 * Get reserve collateral mint from reserve account
 */
async function getReserveCollateralMint(
  program: Program<Lendborrow>,
  reserveAddress: PublicKey
): Promise<PublicKey> {
  try {
    const reserve = await program.account.reserve.fetch(reserveAddress);
    //@ts-ignore
    return reserve.collateralMint;
  } catch (error) {
    console.error("Error fetching reserve:", error);
    throw new Error("Failed to fetch reserve data");
  }
}

/**
 * Get reserve liquidity supply from reserve account
 */
async function getReserveLiquiditySupply(
  program: Program<Lendborrow>,
  reserveAddress: PublicKey
): Promise<PublicKey> {
  try {
    const reserve = await program.account.reserve.fetch(reserveAddress);
    //@ts-ignore
    return reserve.liquiditySupply;
  } catch (error) {
    console.error("Error fetching reserve:", error);
    throw new Error("Failed to fetch reserve data");
  }
}

/**
 * Get reserve liquidity mint from reserve account
 */
async function getReserveLiquidityMint(
  program: Program<Lendborrow>,
  reserveAddress: PublicKey
): Promise<PublicKey> {
  try {
    const reserve = await program.account.reserve.fetch(reserveAddress);
    //@ts-ignore
    return reserve.liquidityMint;
  } catch (error) {
    console.error("Error fetching reserve:", error);
    throw new Error("Failed to fetch reserve data");
  }
}

/**
 * Get lending market from reserve account
 */
async function getLendingMarketFromReserve(
  program: Program<Lendborrow>,
  reserveAddress: PublicKey
): Promise<PublicKey> {
  try {
    const reserve = await program.account.reserve.fetch(reserveAddress);
    //@ts-ignore
    return reserve.lendingMarket;
  } catch (error) {
    console.error("Error fetching reserve:", error);
    throw new Error("Failed to fetch reserve data");
  }
}

/**
 * Deposit liquidity into a reserve and receive collateral tokens
 */
export async function depositReserveLiquidity(
  program: Program<Lendborrow>,
  config: DepositLiquidityConfig
): Promise<DepositLiquidityResult> {
  try {
    console.log("💰 Depositing liquidity...");
    console.log("   Reserve:", config.reserve.toBase58());
    console.log("   Amount:", config.liquidityAmount);

    // Fetch reserve data
    const lendingMarket = await getLendingMarketFromReserve(
      program,
      config.reserve
    );
    const liquidityMint = await getReserveLiquidityMint(
      program,
      config.reserve
    );
    const collateralMint = await getReserveCollateralMint(
      program,
      config.reserve
    );
    const liquiditySupply = await getReserveLiquiditySupply(
      program,
      config.reserve
    );

    console.log("   Lending Market:", lendingMarket.toBase58());
    console.log("   Liquidity Mint:", liquidityMint.toBase58());
    console.log("   Collateral Mint:", collateralMint.toBase58());

    // Get mint info for decimals
    const mintInfo = await program.provider.connection.getParsedAccountInfo(
      liquidityMint
    );
    const decimals =
      //@ts-ignore
      mintInfo.value?.data?.parsed?.info?.decimals || 9;

    // Convert UI amount to blockchain amount
    const liquidityAmount = new BN(
      config.liquidityAmount * Math.pow(10, decimals)
    );

    console.log("   Amount (with decimals):", liquidityAmount.toString());

    // Get user's source liquidity token account (ATA)
    const sourceLiquidity = await getAssociatedTokenAddress(
      liquidityMint,
      config.userPublicKey
    );

    // Get user's destination collateral token account (ATA)
    const destinationCollateral = await getAssociatedTokenAddress(
      collateralMint,
      config.userPublicKey
    );

    console.log("   Source Liquidity:", sourceLiquidity.toBase58());
    console.log("   Destination Collateral:", destinationCollateral.toBase58());

    // Derive lending market authority PDA
    const [lendingMarketAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority"), lendingMarket.toBuffer()],
      program.programId
    );

    console.log("   Market Authority:", lendingMarketAuthority.toBase58());

    // Execute deposit
    const tx = await program.methods
      .depositReserveLiquidity(liquidityAmount)
      .accounts({
        sourceLiquidity,
        destinationCollateral,
        reserve: config.reserve,
        reserveLiquiditySupply: liquiditySupply,
        reserveCollateralMint: collateralMint,
        //@ts-ignore
        lendingMarket,
        lendingMarketAuthority,
        userTransferAuthority: config.userPublicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ Liquidity deposited successfully!");
    console.log("   Transaction:", tx);

    return {
      signature: tx,
      collateralAmount: "Calculated on-chain", // You can parse from logs if needed
      liquidityAmount: config.liquidityAmount.toString(),
    };
  } catch (error: any) {
    console.error("❌ Error depositing liquidity:", error);

    // Parse common errors
    if (error.message?.includes("0x1")) {
      throw new Error("Invalid amount - must be greater than 0");
    } else if (error.message?.includes("ReserveStale")) {
      throw new Error("Reserve data is stale - please refresh and try again");
    } else if (error.message?.includes("insufficient funds")) {
      throw new Error("Insufficient token balance");
    } else if (error.message?.includes("0x1")) {
      throw new Error("Token account not found - please create it first");
    }

    throw new Error(error.message || "Failed to deposit liquidity");
  }
}

/**
 * Get user's liquidity balance for a reserve
 */
export async function getUserLiquidityBalance(
  program: Program<Lendborrow>,
  reserveAddress: PublicKey,
  userPublicKey: PublicKey
): Promise<number> {
  try {
    const liquidityMint = await getReserveLiquidityMint(
      program,
      reserveAddress
    );

    const userTokenAccount = await getAssociatedTokenAddress(
      liquidityMint,
      userPublicKey
    );

    const accountInfo = await program.provider.connection.getTokenAccountBalance(
      userTokenAccount
    );

    return parseFloat(accountInfo.value.uiAmount?.toString() || "0");
  } catch (error) {
    console.error("Error fetching user balance:", error);
    return 0;
  }
}

/**
 * Get user's collateral balance for a reserve
 */
export async function getUserCollateralBalance(
  program: Program<Lendborrow>,
  reserveAddress: PublicKey,
  userPublicKey: PublicKey
): Promise<number> {
  try {
    const collateralMint = await getReserveCollateralMint(
      program,
      reserveAddress
    );

    const userTokenAccount = await getAssociatedTokenAddress(
      collateralMint,
      userPublicKey
    );

    const accountInfo = await program.provider.connection.getTokenAccountBalance(
      userTokenAccount
    );

    return parseFloat(accountInfo.value.uiAmount?.toString() || "0");
  } catch (error) {
    console.error("Error fetching collateral balance:", error);
    return 0;
  }
}

/**
 * Calculate expected collateral amount for a given liquidity deposit
 * This is an approximation - actual amount is calculated on-chain
 */
export async function calculateExpectedCollateral(
  program: Program<Lendborrow>,
  reserveAddress: PublicKey,
  liquidityAmount: number
): Promise<number> {
  try {
    const reserve = await program.account.reserve.fetch(reserveAddress);
    
    // This is a simplified calculation
    // The actual calculation on-chain may differ based on exchange rate
    //@ts-ignore
    const exchangeRate = reserve.collateralExchangeRate || { decimal: new BN(1), value: new BN(1) };
    
    // Simplified: 1:1 ratio (you should implement proper calculation based on your Reserve struct)
    return liquidityAmount;
  } catch (error) {
    console.error("Error calculating collateral:", error);
    return liquidityAmount; // Fallback to 1:1
  }
}