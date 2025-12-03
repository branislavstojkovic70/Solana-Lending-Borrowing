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
import { getPriceFeedAccountForProgram, PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";

export interface ReserveConfig {
  optimalUtilizationRate: number; // 0-100
  loanToValueRatio: number; // 0-100
  liquidationThreshold: number; // 0-100
  liquidationBonus: number; // 0-100 (percentage bonus for liquidators)
  minBorrowRate: number; // 0-100
  optimalBorrowRate: number; // 0-100
  maxBorrowRate: number; // 0-100
  borrowFeeWad: BN; // Fee in WAD (1e18)
  flashLoanFeeWad: BN; // Fee in WAD
  hostFeePercentage: number; // 0-100
  pythPriceFeedId: number[]; // 32 bytes Pyth price feed ID
}

export interface InitReserveConfig {
  lendingMarket: PublicKey;
  liquidityMint: PublicKey;
  liquidityAmount: number; // UI amount (e.g., 1000 USDC)
  pythPriceAccount: PublicKey;
  owner: PublicKey;
  config: ReserveConfig;
}

export interface InitReserveResult {
  reserveAddress: string;
  collateralMintAddress: string;
  signature: string;
}

/**
 * Get Pyth price update account for Pull Oracle
 */
async function getPythPriceUpdateAccount(
  connection: any,
  feedIdHex: string
): Promise<PublicKey> {
  try {
    console.log("📊 Fetching Pyth price update...");

    // Connect to Pyth Hermes service
    const priceService = new PriceServiceConnection(
      "https://hermes.pyth.network",
      {
        priceFeedRequestConfig: {
          binary: true,
        },
      }
    );

    // Clean feed ID
    const cleanFeedId = feedIdHex.startsWith("0x")
      ? feedIdHex.slice(2)
      : feedIdHex;

    console.log("   Feed ID:", cleanFeedId);

    // Get latest VAA (price update data)
    const priceUpdateData = await priceService.getLatestVaas([cleanFeedId]);

    if (!priceUpdateData || priceUpdateData.length === 0) {
      throw new Error("No price update data available from Pyth");
    }

    console.log("✅ Price update data received");

    // For devnet, Pyth receiver program
    const receiverProgram = new PublicKey(
      "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ"
    );

    // Derive price update account from VAA data
    const vaaHash = Buffer.from(priceUpdateData[0], "base64").slice(0, 32);

    const [priceUpdateAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("price_update"), vaaHash],
      receiverProgram
    );

    console.log("✅ Price update account:", priceUpdateAccount.toBase58());

    return priceUpdateAccount;
  } catch (error: any) {
    console.error("❌ Error fetching Pyth price:", error);
    throw new Error(
      "Failed to fetch Pyth price update. Using fallback account."
    );
  }
}

/**
 * Get all PDAs needed for reserve initialization
 */
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

/**
 * Initialize a new reserve in the lending market
 */
export async function initReserve(
  program: Program<Lendborrow>,
  config: InitReserveConfig,
  userSourceLiquidity: PublicKey
): Promise<InitReserveResult> {
  try {
    console.log("🏦 Initializing reserve...");
    console.log("   Lending Market:", config.lendingMarket.toBase58());
    console.log("   Liquidity Mint:", config.liquidityMint.toBase58());
    console.log("   Initial Liquidity:", config.liquidityAmount);

    // Get mint info to determine decimals
    const mintInfo = await program.provider.connection.getParsedAccountInfo(
      config.liquidityMint
    );
    const decimals =
      //@ts-ignore
      mintInfo.value?.data?.parsed?.info?.decimals || 9;

    // Convert UI amount to blockchain amount
    const liquidityAmount = new BN(
      config.liquidityAmount * Math.pow(10, decimals)
    );

    console.log("   Amount (with decimals):", liquidityAmount.toString());

    // Get all PDAs
    const pdas = getReservePDAs(
      program.programId,
      config.lendingMarket,
      config.liquidityMint
    );

    // Get destination collateral account (ATA for owner)
    const destinationCollateral = await getAssociatedTokenAddress(
      pdas.collateralMint,
      config.owner
    );

    console.log("📍 PDAs:");
    console.log("   Reserve:", pdas.reserve.toBase58());
    console.log("   Collateral Mint:", pdas.collateralMint.toBase58());
    console.log("   Liquidity Supply:", pdas.liquiditySupply.toBase58());
    console.log("   Fee Receiver:", pdas.liquidityFeeReceiver.toBase58());
    console.log(
      "   Destination Collateral:",
      destinationCollateral.toBase58()
    );

    // Prepare reserve config for instruction
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

    // Get Pyth price update account (Pull Oracle model)
    let pythPriceAccount: PublicKey;
    try {
      const feedIdHex =
        "0x" + Buffer.from(config.config.pythPriceFeedId).toString("hex");
      pythPriceAccount = await getPythPriceUpdateAccount(
        program.provider.connection,
        feedIdHex
      );
      console.log("📊 Using Pyth update account:", pythPriceAccount.toBase58());
    } catch (error) {
      console.warn("⚠️ Falling back to provided Pyth account");
      pythPriceAccount = config.pythPriceAccount;
    }

    // Add compute budget instructions
    const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000, // Increase compute units significantly
    });

    const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    // Request maximum heap size (256KB)
    const heapRequest = ComputeBudgetProgram.requestHeapFrame({
      bytes: 256 * 1024, // 256KB - maximum allowed
    });

    // Execute init reserve with compute budget instructions
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

    console.log("✅ Reserve initialized successfully!");
    console.log("   Transaction:", tx);

    return {
      reserveAddress: pdas.reserve.toBase58(),
      collateralMintAddress: pdas.collateralMint.toBase58(),
      signature: tx,
    };
  } catch (error: any) {
    console.error("❌ Error initializing reserve:", error);

    // Parse common errors
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

/**
 * Validate reserve configuration
 */
export function validateReserveConfig(config: ReserveConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Utilization rate checks
  if (
    config.optimalUtilizationRate < 0 ||
    config.optimalUtilizationRate > 100
  ) {
    errors.push("Optimal utilization rate must be between 0 and 100");
  }

  // LTV checks
  if (config.loanToValueRatio < 0 || config.loanToValueRatio > 100) {
    errors.push("Loan-to-value ratio must be between 0 and 100");
  }

  // Liquidation threshold must be >= LTV
  if (config.liquidationThreshold < config.loanToValueRatio) {
    errors.push("Liquidation threshold must be >= loan-to-value ratio");
  }

  if (
    config.liquidationThreshold < 0 ||
    config.liquidationThreshold > 100
  ) {
    errors.push("Liquidation threshold must be between 0 and 100");
  }

  // Liquidation bonus checks
  if (config.liquidationBonus < 0 || config.liquidationBonus > 100) {
    errors.push("Liquidation bonus must be between 0 and 100");
  }

  // Interest rate checks
  if (config.minBorrowRate < 0 || config.minBorrowRate > 100) {
    errors.push("Min borrow rate must be between 0 and 100");
  }

  if (config.optimalBorrowRate < config.minBorrowRate) {
    errors.push("Optimal borrow rate must be >= min borrow rate");
  }

  if (config.maxBorrowRate < config.optimalBorrowRate) {
    errors.push("Max borrow rate must be >= optimal borrow rate");
  }

  // Host fee percentage
  if (config.hostFeePercentage < 0 || config.hostFeePercentage > 100) {
    errors.push("Host fee percentage must be between 0 and 100");
  }

  // Pyth price feed ID must be 32 bytes
  if (config.pythPriceFeedId.length !== 32) {
    errors.push("Pyth price feed ID must be exactly 32 bytes");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get reserve by address
 */
export async function getReserve(
  program: Program<Lendborrow>,
  reserveAddress: PublicKey
) {
  try {
    const reserve = await program.account.reserve.fetch(reserveAddress);
    return reserve;
  } catch (error: any) {
    console.error("❌ Error fetching reserve:", error);
    throw new Error("Reserve not found");
  }
}

/**
 * Get all reserves for a lending market
 */
export async function getAllReserves(
  program: Program<Lendborrow>,
  lendingMarket: PublicKey
) {
  try {
    const reserves = await program.account.reserve.all([
      {
        memcmp: {
          offset: 8 + 1 + 8, // discriminator + version + lastUpdateSlot
          bytes: lendingMarket.toBase58(),
        },
      },
    ]);

    return reserves.map((r) => ({
      address: r.publicKey.toBase58(),
      data: r.account,
    }));
  } catch (error: any) {
    console.error("❌ Error fetching reserves:", error);
    return [];
  }
}

/**
 * Helper: Convert percentage to basis points
 */
export function percentageToBps(percentage: number): number {
  return Math.round(percentage * 100);
}

/**
 * Helper: Create default reserve config
 */
export function createDefaultReserveConfig(
  pythPriceFeedId: number[]
): ReserveConfig {
  return {
    optimalUtilizationRate: 80, // 80%
    loanToValueRatio: 75, // 75%
    liquidationThreshold: 80, // 80%
    liquidationBonus: 5, // 5% bonus
    minBorrowRate: 0, // 0%
    optimalBorrowRate: 10, // 10%
    maxBorrowRate: 30, // 30%
    borrowFeeWad: new BN("1000000000000000"), // 0.1% (0.001 * 1e18)
    flashLoanFeeWad: new BN("9000000000000000"), // 0.9% (0.009 * 1e18)
    hostFeePercentage: 20, // 20% of protocol fees go to host
    pythPriceFeedId,
  };
}