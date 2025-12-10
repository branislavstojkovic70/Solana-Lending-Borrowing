import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import type { Lendborrow } from "../../utils/idltype";
import { refreshReserve } from "../reserves/refreshService";

export interface DepositLiquidityConfig {
  reserve: PublicKey;
  liquidityAmount: number; 
  userPublicKey: PublicKey;
}

export interface DepositLiquidityResult {
  signature: string;
  collateralAmount: string;
  liquidityAmount: string;
}

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

export async function depositReserveLiquidity(
  program: Program<Lendborrow>,
  config: DepositLiquidityConfig
): Promise<DepositLiquidityResult> {
  try {
    await refreshReserve(program, config.reserve);
    
    await new Promise(resolve => setTimeout(resolve, 1000));

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

    const mintInfo = await program.provider.connection.getParsedAccountInfo(
      liquidityMint
    );
    const decimals =
      //@ts-ignore
      mintInfo.value?.data?.parsed?.info?.decimals || 9;

    const liquidityAmount = new BN(
      config.liquidityAmount * Math.pow(10, decimals)
    );

    const sourceLiquidity = await getAssociatedTokenAddress(
      liquidityMint,
      config.userPublicKey
    );

    const destinationCollateral = await getAssociatedTokenAddress(
      collateralMint,
      config.userPublicKey
    );

    const [lendingMarketAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority"), lendingMarket.toBuffer()],
      program.programId
    );
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

    return {
      signature: tx,
      collateralAmount: "Calculated on-chain",
      liquidityAmount: config.liquidityAmount.toString(),
    };
  } catch (error: any) {
    console.error("Error depositing liquidity:", error);

    if (error.message?.includes("InvalidAmount")) {
      throw new Error("Invalid amount - must be greater than 0");
    } else if (error.message?.includes("ReserveStale")) {
      throw new Error("Reserve data is stale - please try again");
    } else if (error.message?.includes("insufficient funds")) {
      throw new Error("Insufficient token balance");
    } else if (error.message?.includes("TokenAccountNotFound")) {
      throw new Error("Token account not found - please create it first");
    }

    throw new Error(error.message || "Failed to deposit liquidity");
  }
}

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
    return 0;
  }
}

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

export async function calculateExpectedCollateral(
  program: Program<Lendborrow>,
  reserveAddress: PublicKey,
  liquidityAmount: number
): Promise<number> {
  try {
    const reserve = await program.account.reserve.fetch(reserveAddress);
    //@ts-ignore
    const exchangeRate = reserve.collateralExchangeRate || { decimal: new BN(1), value: new BN(1) };
    
    return liquidityAmount;
  } catch (error) {
    return liquidityAmount;
  }
}