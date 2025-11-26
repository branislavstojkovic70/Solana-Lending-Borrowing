// src/components/supply/AddLiquidity/AddLiquidity.tsx

import React, { useState, useEffect } from "react";
import { Box, Container, Alert, CircularProgress } from "@mui/material";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";


import toast from "react-hot-toast";
import { useProgram } from "../../utils/useProgram";
import { supplyLiquidity } from "../../services/lending/supplyService";
import { ReserveSelector } from "./supply-ui/ReserveSelector";
import { SupplySuccess } from "./supply-ui/SupplySuccess";
import { AddLiquidityForm } from "./supply-ui/AddLiquidityForm";

// Mock reserves - replace with actual data fetching
const MOCK_RESERVES = [
  {
    address: "USDC_RESERVE_ADDRESS",
    asset: "USDC",
    icon: "/assets/usdc.png",
    supplyAPY: 4.5,
    totalSupply: "1.2M",
    available: "800K",
    mintAddress: "USDC_MINT_ADDRESS",
  },
  {
    address: "SOL_RESERVE_ADDRESS",
    asset: "SOL",
    icon: "/assets/sol.png",
    supplyAPY: 3.2,
    totalSupply: "50K",
    available: "30K",
    mintAddress: "SOL_MINT_ADDRESS",
  },
];

export const AddLiquidity: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const { program } = useProgram();

  const [selectedReserve, setSelectedReserve] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    signature: string;
    collateralReceived: string;
    exchangeRate: string;
  } | null>(null);

  const reserve = MOCK_RESERVES.find((r) => r.address === selectedReserve);

  // Fetch user balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!connected || !publicKey || !reserve) return;

      try {
        // TODO: Fetch actual token balance
        setBalance(1000); // Mock balance
      } catch (err) {
        console.error("Error fetching balance:", err);
      }
    };

    fetchBalance();
  }, [connected, publicKey, reserve]);

  const handleMaxClick = () => {
    setAmount(balance.toString());
  };

  const handleSubmit = async () => {
    if (!connected || !publicKey || !program || !reserve) {
      toast.error("Please connect your wallet");
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amountNum > balance) {
      toast.error("Insufficient balance");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get token accounts
      const liquidityMint = new PublicKey(reserve.mintAddress);
      const lendingMarket = new PublicKey("YOUR_LENDING_MARKET_PDA");

      const userSourceLiquidity = await getAssociatedTokenAddress(
        liquidityMint,
        publicKey
      );

      const [collateralMint] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("collateral-mint"),
          lendingMarket.toBuffer(),
          liquidityMint.toBuffer(),
        ],
        program.programId
      );

      const userDestinationCollateral = await getAssociatedTokenAddress(
        collateralMint,
        publicKey
      );

      // Supply liquidity
      const result = await supplyLiquidity(
        //@ts-ignore
        program,
        {
          reserve: new PublicKey(reserve.address),
          amount: amountNum,
          userAuthority: publicKey,
        },
        userSourceLiquidity,
        userDestinationCollateral,
        lendingMarket,
        liquidityMint
      );

      setSuccess({
        signature: result.signature,
        collateralReceived: result.collateralAmount,
        exchangeRate: result.exchangeRate,
      });

      toast.success("🎉 Liquidity supplied successfully!");
    } catch (err: any) {
      console.error("Error supplying liquidity:", err);
      const errorMessage = err.message || "Failed to supply liquidity";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSupplyMore = () => {
    setSuccess(null);
    setAmount("");
    setError(null);
  };

  const handleViewTransaction = () => {
    if (success) {
      window.open(
        `https://explorer.solana.com/tx/${success.signature}?cluster=devnet`,
        "_blank"
      );
    }
  };

  // Show wallet connection prompt
  if (!connected) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert
          severity="warning"
          sx={{ maxWidth: 600, mx: "auto", textAlign: "center" }}
        >
          <Box sx={{ mb: 2, fontSize: "18px", fontWeight: 600 }}>
            👛 Wallet Not Connected
          </Box>
          Please connect your wallet to supply liquidity
        </Alert>
      </Container>
    );
  }

  // Show reserve selector
  if (!selectedReserve) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <ReserveSelector
          reserves={MOCK_RESERVES}
          selectedReserve={selectedReserve}
          onSelectReserve={setSelectedReserve}
        />
      </Container>
    );
  }

  // Show success screen
  if (success && reserve) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <SupplySuccess
          asset={reserve.asset}
          amount={amount}
          collateralReceived={success.collateralReceived}
          exchangeRate={success.exchangeRate}
          signature={success.signature}
          supplyAPY={reserve.supplyAPY}
          onSupplyMore={handleSupplyMore}
          onViewTransaction={handleViewTransaction}
        />
      </Container>
    );
  }

  // Show supply form
  if (!reserve) return null;

  const amountNum = parseFloat(amount) || 0;
  const estimatedCollateral = (amountNum / 1.0).toFixed(6); // TODO: Use actual exchange rate

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <AddLiquidityForm
        asset={reserve.asset}
        amount={amount}
        balance={balance}
        exchangeRate="1.000000"
        estimatedCollateral={estimatedCollateral}
        supplyAPY={reserve.supplyAPY}
        loading={loading}
        error={error}
        onAmountChange={setAmount}
        onMaxClick={handleMaxClick}
        onSubmit={handleSubmit}
      />
    </Container>
  );
};

export default AddLiquidity;