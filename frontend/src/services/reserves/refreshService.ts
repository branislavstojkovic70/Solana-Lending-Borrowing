import { PublicKey } from "@solana/web3.js";
import type { Program } from "@coral-xyz/anchor";
import type { Lendborrow } from "../../utils/idltype";


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


async function getPythOracleFromReserve(
    program: Program<Lendborrow>,
    reserveAddress: PublicKey
): Promise<PublicKey> {
    try {
        const reserve = await program.account.reserve.fetch(reserveAddress);
        //@ts-ignore
        return reserve.liquidityOracle;
    } catch (error) {
        console.error("Error fetching reserve:", error);
        throw new Error("Failed to fetch reserve data");
    }
}

export async function refreshReserve(
    program: Program<Lendborrow>,
    reserveAddress: PublicKey
): Promise<string> {
    try {

        const lendingMarket = await getLendingMarketFromReserve(program, reserveAddress);
        const pythPrice = await getPythOracleFromReserve(program, reserveAddress);



        const tx = await program.methods
            .refreshReserve()
            .accounts({
                reserve: reserveAddress,
                //@ts-ignore
                lendingMarket,
                pythPrice,
            })
            .rpc();


        return tx;
    } catch (error: any) {
        throw new Error(`Failed to refresh reserve: ${error.message}`);
    }
}

export async function refreshMultipleReserves(
    program: Program<Lendborrow>,
    reserveAddresses: PublicKey[]
): Promise<string[]> {
    try {

        const results = await Promise.all(
            reserveAddresses.map(async (reserveAddress, index) => {
                try {
                    console.log(`   [${index + 1}/${reserveAddresses.length}] Refreshing ${reserveAddress.toBase58()}`);
                    return await refreshReserve(program, reserveAddress);
                } catch (error: any) {
                    console.error(`   ❌ Failed to refresh reserve ${reserveAddress.toBase58()}:`, error.message);
                    return null;
                }
            })
        );

        const successful = results.filter(tx => tx !== null) as string[];

        return successful;
    } catch (error: any) {
        console.error("❌ Error refreshing multiple reserves:", error);
        throw new Error(`Failed to refresh reserves: ${error.message}`);
    }
}

export async function refreshAllReservesInMarket(
    program: Program<Lendborrow>,
    lendingMarket: PublicKey
): Promise<string[]> {
    try {

        //@ts-ignore
        const reserves = await program.account.reserve.all([
            {
                memcmp: {
                    offset: 9,
                    bytes: lendingMarket.toBase58(),
                },
            },
        ]);


        if (reserves.length === 0) {
            console.log("No reserves to refresh");
            return [];
        }

        const reserveAddresses = reserves.map(r => r.publicKey);
        return await refreshMultipleReserves(program, reserveAddresses);
    } catch (error: any) {
        throw new Error(`Failed to refresh all reserves: ${error.message}`);
    }
}

export async function getReserveLastUpdateSlot(
    program: Program<Lendborrow>,
    reserveAddress: PublicKey
): Promise<number> {
    try {
        const reserve = await program.account.reserve.fetch(reserveAddress);
        //@ts-ignore
        return reserve.lastUpdateSlot.toNumber();
    } catch (error) {
        console.error("Error fetching reserve last update slot:", error);
        throw new Error("Failed to fetch reserve data");
    }
}

export async function isReserveStale(
    program: Program<Lendborrow>,
    reserveAddress: PublicKey,
    maxAgeSlots: number = 10
): Promise<boolean> {
    try {
        const currentSlot = await program.provider.connection.getSlot();
        const lastUpdateSlot = await getReserveLastUpdateSlot(program, reserveAddress);

        const age = currentSlot - lastUpdateSlot;
        const isStale = age > maxAgeSlots;
        return isStale;
    } catch (error) {
        console.error("Error checking if reserve is stale:", error);
        return true;
    }
}

export async function refreshReserveIfStale(
    program: Program<Lendborrow>,
    reserveAddress: PublicKey,
    maxAgeSlots: number = 10
): Promise<string | null> {
    try {
        const stale = await isReserveStale(program, reserveAddress, maxAgeSlots);

        if (stale) {
            return await refreshReserve(program, reserveAddress);
        } else {
            return null;
        }
    } catch (error: any) {
        throw new Error(`Failed to refresh reserve: ${error.message}`);
    }
}