import { PublicKey } from "@solana/web3.js";
import type { Program } from "@coral-xyz/anchor";
import type { Lendborrow } from "../../utils/idltype";

export async function initObligation(
  program: Program<Lendborrow>,
  lendingMarket: PublicKey,
  userPublicKey: PublicKey
): Promise<string> {
  try {
    const [obligationAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("obligation"),
        lendingMarket.toBuffer(),
        userPublicKey.toBuffer(),
      ],
      program.programId
    );

    try {
      const existingObligation = await program.account.obligation.fetch(obligationAddress);
      if (existingObligation) {
        return obligationAddress.toBase58();
      }
    } catch (error) {
      console.error("Obligation doesn't exist, creating new one...");
    }

    const tx = await program.methods
      .initObligation()
      .accounts({
        //@ts-ignore
        obligation: obligationAddress,
        lendingMarket,
        owner: userPublicKey,
        //@ts-ignore
        systemProgram: new PublicKey("11111111111111111111111111111111"),
        //@ts-ignore
        rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
      })
      .rpc();

    return obligationAddress.toBase58();
  } catch (error: any) {
    console.error("Error initializing obligation:", error);
    throw new Error(`Failed to initialize obligation: ${error.message}`);
  }
}

export function getObligationAddress(
  program: Program<Lendborrow>,
  lendingMarket: PublicKey,
  userPublicKey: PublicKey
): PublicKey {
  const [obligationAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("obligation"),
      lendingMarket.toBuffer(),
      userPublicKey.toBuffer(),
    ],
    program.programId
  );

  return obligationAddress;
}

export async function hasObligation(
  program: Program<Lendborrow>,
  lendingMarket: PublicKey,
  userPublicKey: PublicKey
): Promise<boolean> {
  try {
    const obligationAddress = getObligationAddress(program, lendingMarket, userPublicKey);
    const obligation = await program.account.obligation.fetch(obligationAddress);
    return !!obligation;
  } catch (error) {
    return false;
  }
}

export async function getObligation(
  program: Program<Lendborrow>,
  lendingMarket: PublicKey,
  userPublicKey: PublicKey
): Promise<any> {
  try {
    const obligationAddress = getObligationAddress(program, lendingMarket, userPublicKey);
    const obligation = await program.account.obligation.fetch(obligationAddress);
    return {
      address: obligationAddress.toBase58(),
      data: obligation,
    };
  } catch (error) {
    console.error("Error fetching obligation:", error);
    return null;
  }
}