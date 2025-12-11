import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import type { Lendborrow } from "../../utils/idltype";
import { refreshReserve } from "../reserves/refreshService";

export interface WithdrawLiquidityConfig {
  reserve: PublicKey;
  collateralAmount: number; 
  userPublicKey: PublicKey;
}

export interface WithdrawLiquidityResult {
  signature: string;
  liquidityAmount: string;
  collateralAmount: string;
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
    throw new Error("Failed to fetch reserve data");
  }
}

async function getCollateralDecimals(
  program: Program<Lendborrow>,
  collateralMint: PublicKey
): Promise<number> {
  try {
    const mintInfo = await program.provider.connection.getParsedAccountInfo(
      collateralMint
    );
    //@ts-ignore
    return mintInfo.value?.data?.parsed?.info?.decimals || 9;
  } catch (error) {
    return 9;
  }
}

export async function redeemReserveCollateral(
  program: Program<Lendborrow>,
  config: WithdrawLiquidityConfig
): Promise<WithdrawLiquidityResult> {
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

    const decimals = await getCollateralDecimals(program, collateralMint);

    const collateralAmount = new BN(
      config.collateralAmount * Math.pow(10, decimals)
    );


    const sourceCollateral = await getAssociatedTokenAddress(
      collateralMint,
      config.userPublicKey
    );

    const destinationLiquidity = await getAssociatedTokenAddress(
      liquidityMint,
      config.userPublicKey
    );


    const [lendingMarketAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority"), lendingMarket.toBuffer()],
      program.programId
    );


    const tx = await program.methods
      .redeemReserveCollateral(collateralAmount)
      .accounts({
        sourceCollateral,
        destinationLiquidity,
        reserve: config.reserve,
        reserveLiquiditySupply: liquiditySupply,
        reserveCollateralMint: collateralMint,
        //@ts-ignore
        liquidityMint,
        //@ts-ignore
        collateralMint,
        //@ts-ignore
        lendingMarket,
        lendingMarketAuthority,
        userTransferAuthority: config.userPublicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return {
      signature: tx,
      liquidityAmount: "Calculated on-chain",
      collateralAmount: config.collateralAmount.toString(),
    };
  } catch (error: any) {

    if (error.message?.includes("InvalidAmount")) {
      throw new Error("Invalid amount - must be greater than 0");
    } else if (error.message?.includes("ReserveStale")) {
      throw new Error("Reserve data is stale - please try again");
    } else if (error.message?.includes("InsufficientLiquidity")) {
      throw new Error("Insufficient liquidity in reserve - try a smaller amount");
    } else if (error.message?.includes("WithdrawTooSmall")) {
      throw new Error("Withdraw amount is too small");
    } else if (error.message?.includes("WithdrawTooLarge")) {
      throw new Error("Withdraw amount is too large");
    } else if (error.message?.includes("insufficient funds")) {
      throw new Error("Insufficient collateral balance");
    }

    throw new Error(error.message || "Failed to redeem collateral");
  }
}

export async function calculateExpectedLiquidity(
  program: Program<Lendborrow>,
  reserveAddress: PublicKey,
  collateralAmount: number
): Promise<number> {
  try {
    const reserve = await program.account.reserve.fetch(reserveAddress);
    
    //@ts-ignore
    const availableLiquidity = reserve.liquidityAvailableAmount?.toNumber() || 0;
    //@ts-ignore
    const borrowedLiquidity = reserve.liquidityBorrowedAmountWads?.toString() || "0";
    //@ts-ignore
    const collateralSupply = reserve.collateralMintTotalSupply?.toNumber() || 1;
    
    const borrowedAmount = parseFloat(borrowedLiquidity) / Math.pow(10, 18);
    const totalLiquidity = availableLiquidity + borrowedAmount;
    
    const exchangeRate = totalLiquidity / collateralSupply;
    
    const expectedLiquidity = collateralAmount * exchangeRate;
    return expectedLiquidity;
  } catch (error) {
    return collateralAmount; 
  }
}

export async function getMaxWithdrawableAmount(
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
    return 0;
  }
}