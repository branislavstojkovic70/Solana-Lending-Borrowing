// src/components/Market/MarketOverview/MarketOverview.tsx
import React, { useState, useEffect } from "react";
import { Container } from "@mui/material";
import { useProgram } from "../../../utils/useProgram";
import { PublicKey } from "@solana/web3.js";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { ReservesList } from "./ui/reservesList";

export const MarketOverview: React.FC = () => {
  const { program } = useProgram();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [reserves, setReserves] = useState<any[]>([]);

  useEffect(() => {
    if (program) {
      loadReserves();
    }
  }, [program]);

  const loadReserves = async () => {
    if (!program) return;

    setLoading(true);
    console.log("🔄 Starting to load reserves...");

    try {
      // 1️⃣ Load all lending markets
      //@ts-ignore
      const markets = await program.account.lendingMarket.all();
      console.log("✅ Found lending markets:", markets.length);

      if (markets.length === 0) {
        toast.error("No lending markets found");
        setReserves([]);
        return;
      }

      // 2️⃣ Load ALL reserves (without filter first)
      //@ts-ignore
      const allRes = await program.account.reserve.all();
      console.log("✅ ALL RESERVES (total):", allRes.length);

      if (allRes.length === 0) {
        console.log("❌ No reserves found at all");
        toast.info("No reserves available yet");
        setReserves([]);
        return;
      }

      // 3️⃣ Map reserves data
      console.log("📊 Processing reserves data...");
      const reservesWithData = await Promise.all(
        allRes.map(async (reserve, index) => {
          try {
            console.log(`Processing reserve ${index + 1}/${allRes.length}:`, reserve.publicKey.toBase58());

            const liquidityMint = reserve.account.liquidityMint;
            const liquiditySupply = reserve.account.liquiditySupply;

            // Get mint decimals
            const mintInfo = await program.provider.connection.getParsedAccountInfo(
              liquidityMint
            );
            //@ts-ignore
            const decimals = mintInfo.value?.data?.parsed?.info?.decimals || 9;
            console.log(`  - Decimals: ${decimals}`);

            // Get token supply
            const supplyInfo = await program.provider.connection.getTokenAccountBalance(
              liquiditySupply
            );
            const totalSupply = parseFloat(supplyInfo.value.uiAmount?.toString() || "0");
            console.log(`  - Total Supply: ${totalSupply}`);

            // Calculate metrics
            const apy = calculateAPY(reserve.account);
            const utilization = calculateUtilization(reserve.account);
            console.log(`  - APY: ${apy}%, Utilization: ${utilization}%`);

            return {
              address: reserve.publicKey.toBase58(),
              data: reserve.account,
              decimals,
              totalSupply,
              apy,
              utilization,
              lendingMarket: reserve.account.lendingMarket.toBase58(),
            };
          } catch (error) {
            console.error(`❌ Error processing reserve ${index + 1}:`, error);
            // Return basic data even if enrichment fails
            return {
              address: reserve.publicKey.toBase58(),
              data: reserve.account,
              decimals: 9,
              totalSupply: 0,
              apy: 0,
              utilization: 0,
              lendingMarket: reserve.account.lendingMarket.toBase58(),
            };
          }
        })
      );

      console.log("✅ Final reserves data:", reservesWithData.length);
      console.log("📋 Reserves:", reservesWithData);
      
      setReserves(reservesWithData);
      
      if (reservesWithData.length > 0) {
        toast.success(`Loaded ${reservesWithData.length} reserve(s)`);
      } else {
        toast.info("No reserves available");
      }

    } catch (error: any) {
      console.error("❌ Fatal error loading reserves:", error);
      console.error("Error stack:", error.stack);
      toast.error(`Failed to load reserves: ${error.message}`);
      setReserves([]);
    } finally {
      console.log("🏁 Finished loading reserves");
      setLoading(false);
    }
  };

  const calculateAPY = (reserveData: any): number => {
    try {
      const optimalBorrowRate = reserveData.config?.optimalBorrowRate || 0;
      const utilizationRate = calculateUtilization(reserveData);
      const supplyAPY = (optimalBorrowRate / 100) * (utilizationRate / 100) * 0.8;
      return Math.max(0, supplyAPY * 100);
    } catch (error) {
      console.error("Error calculating APY:", error);
      return 5.5; // Default fallback
    }
  };

  const calculateUtilization = (reserveData: any): number => {
    try {
      const availableAmount = reserveData.liquidityAvailableAmount?.toNumber() || 0;
      const borrowedAmountWads = reserveData.liquidityBorrowedAmountWads?.toString() || "0";
      
      // Convert WAD to regular amount
      const borrowedAmount = parseFloat(borrowedAmountWads) / Math.pow(10, 18);
      const totalAmount = availableAmount + borrowedAmount;
      
      if (totalAmount === 0) return 0;
      
      return Math.min(100, (borrowedAmount / totalAmount) * 100);
    } catch (error) {
      console.error("Error calculating utilization:", error);
      return 65; // Default fallback
    }
  };

  const handleDepositClick = (reserveAddress: string) => {
    navigate(`/deposit/${reserveAddress}`);
  };

  const handleBorrowClick = (reserveAddress: string) => {
    navigate(`/borrow/${reserveAddress}`);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <ReservesList
        reserves={reserves}
        loading={loading}
        onDeposit={handleDepositClick}
        onBorrow={handleBorrowClick}
        onRefresh={loadReserves}
      />
    </Container>
  );
};

export default MarketOverview;