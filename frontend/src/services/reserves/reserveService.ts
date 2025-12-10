// src/services/lending/reserveService.ts
import { 
  PublicKey, 
  SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import type { Lendborrow } from "../../utils/idltype";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";

export interface ReserveConfig {
  optimalUtilizationRate: number; 
  loanToValueRatio: number; 
  liquidationThreshold: number; 
  liquidationBonus: number; 
  minBorrowRate: number; 
  optimalBorrowRate: number; 
  maxBorrowRate: number;
  borrowFeeWad: BN; 
  flashLoanFeeWad: BN; 
  hostFeePercentage: number; 
  pythPriceFeedId: number[]; 
}

export interface InitReserveConfig {
  lendingMarket: PublicKey;
  liquidityMint: PublicKey;
  liquidityAmount: number; 
  pythPriceAccount: PublicKey;
  owner: PublicKey;
  config: ReserveConfig;
}

export interface InitReserveResult {
  reserveAddress: string;
  collateralMintAddress: string;
  signature: string;
}

async function getPythPriceUpdateAccount(
  connection: any,
  feedIdHex: string
): Promise<PublicKey> {
  try {

    const priceService = new PriceServiceConnection(
      "https://hermes.pyth.network",
      {
        priceFeedRequestConfig: {
          binary: true,
        },
      }
    );

    const cleanFeedId = feedIdHex.startsWith("0x")
      ? feedIdHex.slice(2)
      : feedIdHex;
    const priceUpdateData = await priceService.getLatestVaas([cleanFeedId]);

    if (!priceUpdateData || priceUpdateData.length === 0) {
      throw new Error("No price update data available from Pyth");
    }


    const receiverProgram = new PublicKey(
      "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ"
    );

    const vaaHash = Buffer.from(priceUpdateData[0], "base64").slice(0, 32);

    const [priceUpdateAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("price_update"), vaaHash],
      receiverProgram
    );
    return priceUpdateAccount;
  } catch (error: any) {
    console.error(" Error fetching Pyth price:", error);
    throw new Error(
      "Failed to fetch Pyth price update. Using fallback account."
    );
  }
}


export function getReservePDAs(
  programId: PublicKey,
  lendingMarket: PublicKey,
  liquidityMint: PublicKey
) {
  const [lendingMarketAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("authority"), lendingMarket.toBuffer()],
    programId
  );

  const [reserve] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("reserve"),
      lendingMarket.toBuffer(),
      liquidityMint.toBuffer(),
    ],
    programId
  );

  const [liquiditySupply] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("liquidity-supply"),
      lendingMarket.toBuffer(),
      liquidityMint.toBuffer(),
    ],
    programId
  );

  const [liquidityFeeReceiver] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("fee-receiver"),
      lendingMarket.toBuffer(),
      liquidityMint.toBuffer(),
    ],
    programId
  );

  const [collateralMint] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("collateral-mint"),
      lendingMarket.toBuffer(),
      liquidityMint.toBuffer(),
    ],
    programId
  );

  const [collateralSupply] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("collateral-supply"),
      lendingMarket.toBuffer(),
      liquidityMint.toBuffer(),
    ],
    programId
  );

  return {
    lendingMarketAuthority,
    reserve,
    liquiditySupply,
    liquidityFeeReceiver,
    collateralMint,
    collateralSupply,
  };
}

export async function initReserve(
  program: Program<Lendborrow>,
  config: InitReserveConfig,
  userSourceLiquidity: PublicKey
): Promise<InitReserveResult> {
  try {
    const mintInfo = await program.provider.connection.getParsedAccountInfo(
      config.liquidityMint
    );
    const decimals =
      //@ts-ignore
      mintInfo.value?.data?.parsed?.info?.decimals || 9;

    const liquidityAmount = new BN(
      config.liquidityAmount * Math.pow(10, decimals)
    );

    console.log("   Amount (with decimals):", liquidityAmount.toString());

    const pdas = getReservePDAs(
      program.programId,
      config.lendingMarket,
      config.liquidityMint
    );

    const destinationCollateral = await getAssociatedTokenAddress(
      pdas.collateralMint,
      config.owner
    );

    const reserveConfig = {
      optimalUtilizationRate: config.config.optimalUtilizationRate,
      loanToValueRatio: config.config.loanToValueRatio,
      liquidationThreshold: config.config.liquidationThreshold,
      liquidationBonus: config.config.liquidationBonus,
      minBorrowRate: config.config.minBorrowRate,
      optimalBorrowRate: config.config.optimalBorrowRate,
      maxBorrowRate: config.config.maxBorrowRate,
      fees: {
        borrowFeeWad: config.config.borrowFeeWad,
        flashLoanFeeWad: config.config.flashLoanFeeWad,
        hostFeePercentage: config.config.hostFeePercentage,
      },
      pythPriceFeedId: config.config.pythPriceFeedId,
    };

    let pythPriceAccount: PublicKey;
    try {
      const feedIdHex =
        "0x" + Buffer.from(config.config.pythPriceFeedId).toString("hex");
      pythPriceAccount = await getPythPriceUpdateAccount(
        program.provider.connection,
        feedIdHex
      );
    } catch (error) {
      console.warn("Falling back to provided Pyth account");
      pythPriceAccount = config.pythPriceAccount;
    }

    const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000, 
    });

    const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    const heapRequest = ComputeBudgetProgram.requestHeapFrame({
      bytes: 256 * 1024, 
    });

    const tx = await program.methods
      .initReserve(liquidityAmount, reserveConfig)
      .accounts({
        sourceLiquidity: userSourceLiquidity,
        liquidityMint: config.liquidityMint,
        lendingMarket: config.lendingMarket,
        //@ts-ignore
        lendingMarketAuthority: pdas.lendingMarketAuthority,
        reserve: pdas.reserve,
        liquiditySupply: pdas.liquiditySupply,
        liquidityFeeReceiver: pdas.liquidityFeeReceiver,
        pythPrice: pythPriceAccount,
        collateralMint: pdas.collateralMint,
        destinationCollateral: destinationCollateral,
        collateralSupply: pdas.collateralSupply,
        owner: config.owner,
        userTransferAuthority: config.owner,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
      })
      .preInstructions([computeUnitLimit, computeUnitPrice, heapRequest])
      .rpc();

    return {
      reserveAddress: pdas.reserve.toBase58(),
      collateralMintAddress: pdas.collateralMint.toBase58(),
      signature: tx,
    };
  } catch (error: any) {
    console.error("Error initializing reserve:", error);
    if (error.message?.includes("0x0")) {
      throw new Error("Reserve already exists for this mint");
    } else if (error.message?.includes("0x6")) {
      throw new Error("Invalid reserve configuration");
    } else if (error.message?.includes("0x7")) {
      throw new Error("Invalid liquidity amount");
    } else if (error.message?.includes("insufficient funds")) {
      throw new Error("Insufficient SOL or token balance");
    }
    throw new Error(error.message || "Failed to initialize reserve");
  }
}

export function validateReserveConfig(config: ReserveConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (
    config.optimalUtilizationRate < 0 ||
    config.optimalUtilizationRate > 100
  ) {
    errors.push("Optimal utilization rate must be between 0 and 100");
  }

  if (config.loanToValueRatio < 0 || config.loanToValueRatio > 100) {
    errors.push("Loan-to-value ratio must be between 0 and 100");
  }

  if (config.liquidationThreshold < config.loanToValueRatio) {
    errors.push("Liquidation threshold must be >= loan-to-value ratio");
  }

  if (
    config.liquidationThreshold < 0 ||
    config.liquidationThreshold > 100
  ) {
    errors.push("Liquidation threshold must be between 0 and 100");
  }

  if (config.liquidationBonus < 0 || config.liquidationBonus > 100) {
    errors.push("Liquidation bonus must be between 0 and 100");
  }

  if (config.minBorrowRate < 0 || config.minBorrowRate > 100) {
    errors.push("Min borrow rate must be between 0 and 100");
  }

  if (config.optimalBorrowRate < config.minBorrowRate) {
    errors.push("Optimal borrow rate must be >= min borrow rate");
  }

  if (config.maxBorrowRate < config.optimalBorrowRate) {
    errors.push("Max borrow rate must be >= optimal borrow rate");
  }

  if (config.hostFeePercentage < 0 || config.hostFeePercentage > 100) {
    errors.push("Host fee percentage must be between 0 and 100");
  }

  if (config.pythPriceFeedId.length !== 32) {
    errors.push("Pyth price feed ID must be exactly 32 bytes");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function getReserve(
  program: Program<Lendborrow>,
  reserveAddress: PublicKey
) {
  try {
    const reserve = await program.account.reserve.fetch(reserveAddress);
    return reserve;
  } catch (error: any) {
    throw new Error("Reserve not found");
  }
}

export async function getAllReserves(
  program: Program<Lendborrow>,
  lendingMarket: PublicKey
) {
  try {
    const reserves = await program.account.reserve.all([
      {
        memcmp: {
          offset: 8 + 1 + 8, 
          bytes: lendingMarket.toBase58(),
        },
      },
    ]);

    return reserves.map((r) => ({
      address: r.publicKey.toBase58(),
      data: r.account,
    }));
  } catch (error: any) {
    return [];
  }
}

export function percentageToBps(percentage: number): number {
  return Math.round(percentage * 100);
}

export function createDefaultReserveConfig(
  pythPriceFeedId: number[]
): ReserveConfig {
  return {
    optimalUtilizationRate: 80, 
    loanToValueRatio: 75, 
    liquidationThreshold: 80, 
    liquidationBonus: 5, 
    minBorrowRate: 0,
    optimalBorrowRate: 10, 
    maxBorrowRate: 30, 
    borrowFeeWad: new BN("1000000000000000"), 
    flashLoanFeeWad: new BN("9000000000000000"), 
    hostFeePercentage: 20, 
    pythPriceFeedId,
  };
}