// src/services/oracle/pythService.ts
import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";

// Pyth Price Service endpoints
const PYTH_PRICE_SERVICE_ENDPOINTS = {
  devnet: "https://hermes.pyth.network",
  mainnet: "https://hermes.pyth.network",
};

// Pyth Receiver Program IDs
const PYTH_RECEIVER_PROGRAM_IDS = {
  devnet: new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ"),
  mainnet: new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ"),
};

export interface PythPriceUpdate {
  priceUpdateAccount: PublicKey;
  updateInstruction: TransactionInstruction;
}

/**
 * Get Pyth price update account and instruction for a price feed
 */
export async function getPythPriceUpdate(
  connection: Connection,
  feedId: string, // hex string like "0xeaa020c61..."
  network: "devnet" | "mainnet" = "devnet"
): Promise<PythPriceUpdate> {
  try {
    console.log("📊 Fetching Pyth price update...");
    console.log("   Feed ID:", feedId);

    // Connect to Pyth price service
    const priceService = new PriceServiceConnection(
      PYTH_PRICE_SERVICE_ENDPOINTS[network],
      {
        priceFeedRequestConfig: {
          binary: true,
        },
      }
    );

    // Remove 0x prefix if present
    const cleanFeedId = feedId.startsWith("0x") ? feedId.slice(2) : feedId;

    // Get latest price updates (VAA - Verified Action Approval)
    const priceUpdateData = await priceService.getLatestVaas([cleanFeedId]);

    if (!priceUpdateData || priceUpdateData.length === 0) {
      throw new Error("No price update data available");
    }

    console.log("✅ Price update data fetched");

    // Create price update account
    // This is a simplified version - you might need to use Pyth SDK to create proper instruction
    const receiverProgram = PYTH_RECEIVER_PROGRAM_IDS[network];

    // For now, we'll use a placeholder
    // In production, you'd use Pyth's SDK to properly parse and create the account
    const priceUpdateAccount = PublicKey.unique(); // Temporary

    // Create update instruction (simplified)
    const updateInstruction = new TransactionInstruction({
      programId: receiverProgram,
      keys: [],
      data: Buffer.from(priceUpdateData[0], "base64"),
    });

    return {
      priceUpdateAccount,
      updateInstruction,
    };
  } catch (error) {
    console.error("❌ Error getting Pyth price update:", error);
    throw new Error("Failed to fetch Pyth price update");
  }
}

/**
 * Check if Pyth price feed is available
 */
export async function checkPythPriceFeed(
  feedId: string,
  network: "devnet" | "mainnet" = "devnet"
): Promise<boolean> {
  try {
    const priceService = new PriceServiceConnection(
      PYTH_PRICE_SERVICE_ENDPOINTS[network]
    );

    const cleanFeedId = feedId.startsWith("0x") ? feedId.slice(2) : feedId;
    const updates = await priceService.getLatestVaas([cleanFeedId]);

    return updates && updates.length > 0;
  } catch (error) {
    console.error("Error checking price feed:", error);
    return false;
  }
}