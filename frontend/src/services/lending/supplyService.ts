
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import type { Lendborrow } from "../../utils/idltype";

export interface SupplyConfig {
  reserve: PublicKey;
  amount: number; // In UI units (e.g., 100.5 USDC)
  userAuthority: PublicKey;
}

export interface SupplyResult {
  signature: string;
  collateralAmount: string;
  exchangeRate: string;
}

/**
 * Get all necessary PDAs for supply operation
 */
export function getSupplyPDAs(
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

  const [collateralMint] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("collateral-mint"),
      lendingMarket.toBuffer(),
      liquidityMint.toBuffer(),
    ],
    programId
  );

  return {
    lendingMarketAuthority,
    reserve,
    liquiditySupply,
    collateralMint,
  };
}

/**
 * Supply liquidity to a reserve
 */
export async function supplyLiquidity(
  program: Program<Lendborrow>,
  config: SupplyConfig,
  userSourceLiquidity: PublicKey,
  userDestinationCollateral: PublicKey,
  lendingMarket: PublicKey,
  liquidityMint: PublicKey
): Promise<SupplyResult> {
  try {
    console.log("🏦 Supplying liquidity...");
    console.log("   Amount:", config.amount);
    console.log("   Reserve:", config.reserve.toBase58());

    // Get reserve info for decimals
    const reserve = await program.account.reserve.fetch(config.reserve);
    //@ts-ignore
    const decimals = reserve.liquidity.mintDecimals;

    // Convert UI amount to blockchain amount
    const amount = new BN(config.amount * Math.pow(10, decimals));

    console.log("   Amount (with decimals):", amount.toString());

    // Get PDAs
    const pdas = getSupplyPDAs(
      program.programId,
      lendingMarket,
      liquidityMint
    );

    // Execute supply
    const tx = await program.methods
      .depositReserveLiquidity(amount)
      .accounts({
        userAuthority: config.userAuthority,
        reserve: config.reserve,
        userSourceLiquidity: userSourceLiquidity,
        reserveLiquidityVault: pdas.liquiditySupply,
        userDestinationCollateral: userDestinationCollateral,
        reserveCollateralMint: pdas.collateralMint,
        lendingMarket: lendingMarket,
        lendingMarketAuthority: pdas.lendingMarketAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ Supply successful!");
    console.log("   Transaction:", tx);

    // Get updated reserve for exchange rate
    const updatedReserve = await program.account.reserve.fetch(config.reserve);
    const exchangeRate = calculateExchangeRate(updatedReserve);
    const collateralAmount = (
      config.amount / parseFloat(exchangeRate)
    ).toFixed(6);

    return {
      signature: tx,
      collateralAmount,
      exchangeRate,
    };
  } catch (error: any) {
    console.error("❌ Error supplying liquidity:", error);

    // Parse common errors
    if (error.message?.includes("0x1")) {
      throw new Error("Insufficient balance");
    } else if (error.message?.includes("0x3")) {
      throw new Error("Invalid amount");
    } else if (error.message?.includes("insufficient funds")) {
      throw new Error("Insufficient SOL for transaction fee");
    }

    throw new Error(error.message || "Failed to supply liquidity");
  }
}

/**
 * Calculate exchange rate from reserve data
 */
function calculateExchangeRate(reserve: any): string {
  const totalLiquidity =
    Number(reserve.liquidity.availableAmount) +
    Number(reserve.liquidity.borrowedAmountSf) / 1e18;

  const totalCollateral = Number(reserve.collateral.mintTotalSupply);

  if (totalCollateral === 0) {
    return "1.0";
  }

  const rate = totalLiquidity / totalCollateral;
  return rate.toFixed(6);
}

/**
 * Get user's supply position
 */
export async function getUserSupplyPosition(
  program: Program<Lendborrow>,
  reserve: PublicKey,
  userCollateralAccount: PublicKey
): Promise<{
  collateralAmount: number;
  liquidityValue: number;
  exchangeRate: string;
}> {
  try {
    const [reserveData, collateralAccount] = await Promise.all([
      program.account.reserve.fetch(reserve),
      program.provider.connection.getAccountInfo(userCollateralAccount),
    ]);

    if (!collateralAccount) {
      return {
        collateralAmount: 0,
        liquidityValue: 0,
        exchangeRate: "1.0",
      };
    }

    // Parse token account data
    const collateralAmount = Number(
      new BN(collateralAccount.data.slice(64, 72), "le")
    );
    const decimals = reserveData.liquidity.mintDecimals;
    const collateralUI = collateralAmount / Math.pow(10, decimals);

    const exchangeRate = calculateExchangeRate(reserveData);
    const liquidityValue = collateralUI * parseFloat(exchangeRate);

    return {
      collateralAmount: collateralUI,
      liquidityValue,
      exchangeRate,
    };
  } catch (error) {
    console.error("Error fetching supply position:", error);
    return {
      collateralAmount: 0,
      liquidityValue: 0,
      exchangeRate: "1.0",
    };
  }
}