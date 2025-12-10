import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import type { Lendborrow } from "../../utils/idltype";

export interface SupplyConfig {
  reserve: PublicKey;
  amount: number; 
  userAuthority: PublicKey;
}

export interface SupplyResult {
  signature: string;
  collateralAmount: string;
  exchangeRate: string;
}

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

export async function supplyLiquidity(
  program: Program<Lendborrow>,
  config: SupplyConfig,
  userSourceLiquidity: PublicKey,
  userDestinationCollateral: PublicKey,
  lendingMarket: PublicKey,
  liquidityMint: PublicKey
): Promise<SupplyResult> {
  try {
    const reserve = await program.account.reserve.fetch(config.reserve);
    //@ts-ignore
    const decimals = reserve.liquidity.mintDecimals;
    const amount = new BN(config.amount * Math.pow(10, decimals));
    const pdas = getSupplyPDAs(
      program.programId,
      lendingMarket,
      liquidityMint
    );

    const tx = await program.methods
      .depositReserveLiquidity(amount)
      .accounts({
        //@ts-ignore
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
    console.error("Error supplying liquidity:", error);

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

    const collateralAmount = Number(
      new BN(collateralAccount.data.slice(64, 72), "le")
    );
    //@ts-ignore
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
    return {
      collateralAmount: 0,
      liquidityValue: 0,
      exchangeRate: "1.0",
    };
  }
}