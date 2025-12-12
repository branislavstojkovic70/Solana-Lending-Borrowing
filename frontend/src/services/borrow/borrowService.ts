import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import type { Lendborrow } from "../../utils/idltype";
import { refreshReserve } from "../reserves/refreshService";
import { getObligationAddress } from "../obligation/obligationService";

export interface BorrowLiquidityConfig {
  reserve: PublicKey;
  lendingMarket: PublicKey;
  liquidityAmount: number; // UI amount to borrow
  userPublicKey: PublicKey;
}

export interface BorrowLiquidityResult {
  signature: string;
  borrowedAmount: string;
}

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

async function getReserveLiquidityFeeReceiver(
  program: Program<Lendborrow>,
  reserveAddress: PublicKey
): Promise<PublicKey> {
  try {
    const reserve = await program.account.reserve.fetch(reserveAddress);
    //@ts-ignore
    return reserve.liquidityFeeReceiver;
  } catch (error) {
    console.error("Error fetching reserve:", error);
    throw new Error("Failed to fetch reserve data");
  }
}

export async function borrowObligationLiquidity(
  program: Program<Lendborrow>,
  config: BorrowLiquidityConfig
): Promise<BorrowLiquidityResult> {
  try {
    await refreshReserve(program, config.reserve);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const liquidityMint = await getReserveLiquidityMint(program, config.reserve);
    const liquiditySupply = await getReserveLiquiditySupply(program, config.reserve);
    const liquidityFeeReceiver = await getReserveLiquidityFeeReceiver(program, config.reserve);
    const mintInfo = await program.provider.connection.getParsedAccountInfo(liquidityMint);
    //@ts-ignore
    const decimals = mintInfo.value?.data?.parsed?.info?.decimals || 9;

    const liquidityAmount = new BN(
      config.liquidityAmount * Math.pow(10, decimals)
    );

    const obligationAddress = getObligationAddress(
      program,
      config.lendingMarket,
      config.userPublicKey
    );


    const destinationLiquidity = await getAssociatedTokenAddress(
      liquidityMint,
      config.userPublicKey
    );

    const [lendingMarketAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority"), config.lendingMarket.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .borrowObligationLiquidity(liquidityAmount)
      .accounts({
        sourceLiquidity: liquiditySupply,
        destinationLiquidity,
        borrowReserve: config.reserve,
        borrowReserveLiquidityFeeReceiver: liquidityFeeReceiver,
        //@ts-ignore
        obligation: obligationAddress,
        lendingMarket: config.lendingMarket,
        lendingMarketAuthority,
        obligationOwner: config.userPublicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return {
      signature: tx,
      borrowedAmount: config.liquidityAmount.toString(),
    };
  } catch (error: any) {
    console.error("Error borrowing liquidity:", error);

    if (error.message?.includes("InvalidAmount")) {
      throw new Error("Invalid amount - must be greater than 0");
    } else if (error.message?.includes("ReserveStale")) {
      throw new Error("Reserve data is stale - please try again");
    } else if (error.message?.includes("InsufficientCollateral")) {
      throw new Error("Insufficient collateral - deposit more collateral first");
    } else if (error.message?.includes("BorrowExceedsLiquidity")) {
      throw new Error("Not enough liquidity available in the reserve");
    } else if (error.message?.includes("ObligationUnhealthy")) {
      throw new Error("Obligation would become unhealthy - reduce borrow amount");
    }

    throw new Error(error.message || "Failed to borrow liquidity");
  }
}

export async function getMaxBorrowAmount(
  program: Program<Lendborrow>,
  lendingMarket: PublicKey,
  userPublicKey: PublicKey
): Promise<number> {
  try {
    const obligationAddress = getObligationAddress(program, lendingMarket, userPublicKey);
    const obligation = await program.account.obligation.fetch(obligationAddress);

    //@ts-ignore
    const allowedBorrowValue = obligation.allowedBorrowValue?.toString() || "0";
    //@ts-ignore
    const borrowedValue = obligation.borrowedValue?.toString() || "0";

    const allowed = parseFloat(allowedBorrowValue) / Math.pow(10, 18);
    const borrowed = parseFloat(borrowedValue) / Math.pow(10, 18);

    const maxBorrow = Math.max(0, allowed - borrowed);

    return maxBorrow;
  } catch (error) {
    console.error("Error calculating max borrow:", error);
    return 0;
  }
}

export async function getUserBorrowBalance(
  program: Program<Lendborrow>,
  reserve: PublicKey,
  lendingMarket: PublicKey,
  userPublicKey: PublicKey
): Promise<number> {
  try {
    const obligationAddress = getObligationAddress(program, lendingMarket, userPublicKey);
    const obligation = await program.account.obligation.fetch(obligationAddress);

    //@ts-ignore
    const borrowedValue = obligation.borrowedValue?.toString() || "0";
    const borrowed = parseFloat(borrowedValue) / Math.pow(10, 18);

    return borrowed;
  } catch (error) {
    console.error("Error fetching borrow balance:", error);
    return 0;
  }
}