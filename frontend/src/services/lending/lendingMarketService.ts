import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import type { CreateMarketResult, LendingMarketConfig } from "./types";
import type { Lendborrow } from "../../utils/idltype";

function quoteCurrencyToBytes(currency: string): number[] {
    const bytes = new Array(32).fill(0);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(currency.toUpperCase());
    bytes.splice(0, Math.min(encoded.length, 32), ...encoded);
    return bytes;
}

export function getLendingMarketPDA(
    programId: PublicKey,
    owner: PublicKey
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("lending-market"), owner.toBuffer()],
        programId
    );
}


export async function createLendingMarket(
    program: Program<Lendborrow>,
    config: LendingMarketConfig
): Promise<CreateMarketResult> {
    const quoteCurrencyBytes = quoteCurrencyToBytes(config.quoteCurrency);

    const [lendingMarketPDA, bump] = getLendingMarketPDA(
        program.programId,
        config.owner
    );

    try {
        const tx = await program.methods
            .initLendingMarket(quoteCurrencyBytes)
            .accounts({
                owner: config.owner,
                //@ts-ignore
                lendingMarket: lendingMarketPDA,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();
        return {
            marketAddress: lendingMarketPDA.toBase58(),
            signature: tx,
        };
    } catch (error: any) {
        if (error.message?.includes("0x0")) {
            throw new Error("Market already exists for this owner");
        } else if (error.message?.includes("0x1")) {
            throw new Error("Invalid account owner");
        } else if (error.message?.includes("insufficient funds")) {
            throw new Error("Insufficient SOL for transaction");
        } else if (error.message?.includes("already in use")) {
            throw new Error("Market PDA already in use");
        }
        throw new Error(error.message || "Failed to create lending market");
    }
}

export async function getLendingMarket(
    program: Program<Lendborrow>,
    marketAddress: string
) {
    const marketPubkey = new PublicKey(marketAddress);

    try {
        const market = await program.account.lendingMarket.fetch(marketPubkey);
        return market;
    } catch (error: any) {
        throw new Error("Market not found or invalid");
    }
}

export async function getLendingMarketForOwner(
    program: Program<Lendborrow>,
    owner: PublicKey
) {
    const [marketPDA] = getLendingMarketPDA(program.programId, owner);
    try {
        const market = await program.account.lendingMarket.fetch(marketPDA);
        return {
            address: marketPDA.toBase58(),
            data: market,
        };
    } catch (error: any) {
        return null; 
    }
}

export function validateQuoteCurrency(currency: string): {
    valid: boolean;
    error?: string;
} {
    if (!currency || currency.trim().length === 0) {
        return { valid: false, error: "Quote currency is required" };
    }

    if (currency.length > 32) {
        return { valid: false, error: "Quote currency must be 32 characters or less" };
    }

    if (!/^[A-Za-z0-9]+$/.test(currency)) {
        return {
            valid: false,
            error: "Quote currency must contain only letters and numbers",
        };
    }

    return { valid: true };
}