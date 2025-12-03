import React, { useState, useEffect } from "react";
import { Container } from "@mui/material";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import toast from "react-hot-toast";
import { useProgram } from "../../../utils/useProgram";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { getLendingMarketForOwner } from "../../../services/lending/lendingMarketService";
import {
  initReserve,
  validateReserveConfig,
  type ReserveConfig,
  type InitReserveConfig,
} from "../../../services/reserves/reserveService";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { WalletNotConnected } from "./ui/WalletNotConnected";
import { ReserveForm } from "./ui/ReserveForm";

// UI Model - za lakše upravljanje formom
interface ReserveUIConfig {
  optimalUtilizationRate: number;
  loanToValueRatio: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  minBorrowRate: number;
  optimalBorrowRate: number;
  maxBorrowRate: number;
  borrowFee: number; // percentage (e.g., 0.1 for 0.1%)
  flashLoanFee: number; // percentage
  hostFeePercentage: number;
}

export const InitReserve: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const { program, connection, wallet } = useProgram();

  const [loading, setLoading] = useState(false);
  const [lendingMarket, setLendingMarket] = useState<string>("");
  const [loadingMarket, setLoadingMarket] = useState(false);

  const [liquidityMint, setLiquidityMint] = useState("");
  const [liquidityAmount, setLiquidityAmount] = useState("1000");
  const [pythPriceFeedId, setPythPriceFeedId] = useState("");

  // UI config state
  const [uiConfig, setUiConfig] = useState<ReserveUIConfig>({
    optimalUtilizationRate: 80,
    loanToValueRatio: 75,
    liquidationThreshold: 80,
    liquidationBonus: 5,
    minBorrowRate: 0,
    optimalBorrowRate: 10,
    maxBorrowRate: 30,
    borrowFee: 0.1,
    flashLoanFee: 0.9,
    hostFeePercentage: 20,
  });

  const [pythPriceFeedIdBytes, setPythPriceFeedIdBytes] = useState<number[]>(
    new Array(32).fill(0)
  );

  useEffect(() => {
    if (publicKey && program) {
      loadUserMarket();
    }
  }, [publicKey, program]);

  const loadUserMarket = async () => {
    if (!publicKey || !program) return;

    setLoadingMarket(true);
    try {
      //@ts-ignore
      const market = await getLendingMarketForOwner(program, publicKey);
      if (market) {
        setLendingMarket(market.address);
        toast.success("Found your lending market");
      } else {
        toast.error("No lending market found. Please create one first.");
      }
    } catch (error: any) {
      console.error("Error loading market:", error);
      toast.error("Failed to load lending market");
    } finally {
      setLoadingMarket(false);
    }
  };

  const handleConfigChange = (field: keyof ReserveUIConfig, value: any) => {
    setUiConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handlePythFeedIdChange = (hexString: string) => {
    setPythPriceFeedId(hexString);
    try {
      const cleanHex = hexString.replace("0x", "");
      if (cleanHex.length === 64) {
        const bytes = [];
        for (let i = 0; i < cleanHex.length; i += 2) {
          bytes.push(parseInt(cleanHex.substr(i, 2), 16));
        }
        setPythPriceFeedIdBytes(bytes);
      }
    } catch (error) {
      console.error("Invalid hex string:", error);
    }
  };

  // Convert UI config to ReserveConfig
  const convertToReserveConfig = (): ReserveConfig => {
    return {
      optimalUtilizationRate: uiConfig.optimalUtilizationRate,
      loanToValueRatio: uiConfig.loanToValueRatio,
      liquidationThreshold: uiConfig.liquidationThreshold,
      liquidationBonus: uiConfig.liquidationBonus,
      minBorrowRate: uiConfig.minBorrowRate,
      optimalBorrowRate: uiConfig.optimalBorrowRate,
      maxBorrowRate: uiConfig.maxBorrowRate,
      borrowFeeWad: new BN(Math.round(uiConfig.borrowFee * 1e16)), // 0.1% = 0.001 * 1e18
      flashLoanFeeWad: new BN(Math.round(uiConfig.flashLoanFee * 1e16)), // 0.9% = 0.009 * 1e18
      hostFeePercentage: uiConfig.hostFeePercentage,
      pythPriceFeedId: pythPriceFeedIdBytes,
    };
  };

  const handleSubmit = async () => {
    if (!connected || !publicKey || !program) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!lendingMarket) {
      toast.error("Lending market not found");
      return;
    }

    if (!liquidityMint || !pythPriceFeedId) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!wallet) {
      toast.error("Wallet not available");
      return;
    }

    const reserveConfig = convertToReserveConfig();
    const validation = validateReserveConfig(reserveConfig);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    setLoading(true);

    try {
      const liquidityMintPubkey = new PublicKey(liquidityMint);
      const lendingMarketPubkey = new PublicKey(lendingMarket);

      const pythSolanaReceiver = new PythSolanaReceiver({
        connection,
        //@ts-ignore
        wallet,
      });

      const cleanHex = pythPriceFeedId.replace("0x", "");
      const feedIdBytes = Buffer.from(cleanHex, "hex");

      const pythPriceAccountPubkey =
        pythSolanaReceiver.getPriceFeedAccountAddress(0, feedIdBytes);

      console.log("Pyth Price Account:", pythPriceAccountPubkey.toBase58());

      const userSourceLiquidity = await getAssociatedTokenAddress(
        liquidityMintPubkey,
        publicKey
      );

      const initConfig: InitReserveConfig = {
        lendingMarket: lendingMarketPubkey,
        liquidityMint: liquidityMintPubkey,
        liquidityAmount: parseFloat(liquidityAmount),
        pythPriceAccount: pythPriceAccountPubkey,
        owner: publicKey,
        config: reserveConfig,
      };

      const result = await initReserve(
        //@ts-ignore
        program,
        initConfig,
        userSourceLiquidity
      );

      toast.success("🎉 Reserve initialized successfully!");
      console.log("Reserve created:", result);

      // Reset form
      setLiquidityMint("");
      setLiquidityAmount("1000");
      setPythPriceFeedId("");
      setPythPriceFeedIdBytes(new Array(32).fill(0));
      setUiConfig({
        optimalUtilizationRate: 80,
        loanToValueRatio: 75,
        liquidationThreshold: 80,
        liquidationBonus: 5,
        minBorrowRate: 0,
        optimalBorrowRate: 10,
        maxBorrowRate: 30,
        borrowFee: 0.1,
        flashLoanFee: 0.9,
        hostFeePercentage: 20,
      });
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to initialize reserve");
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return <WalletNotConnected />;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <ReserveForm
        lendingMarket={lendingMarket}
        loadingMarket={loadingMarket}
        liquidityMint={liquidityMint}
        liquidityAmount={liquidityAmount}
        pythPriceFeedId={pythPriceFeedId}
        //@ts-ignore
        config={uiConfig}
        loading={loading}
        onLiquidityMintChange={setLiquidityMint}
        onLiquidityAmountChange={setLiquidityAmount}
        onPythFeedIdChange={handlePythFeedIdChange}
        onConfigChange={handleConfigChange}
        onSubmit={handleSubmit}
      />
    </Container>
  );
};

export default InitReserve;