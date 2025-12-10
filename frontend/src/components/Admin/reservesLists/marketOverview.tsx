import React, { useState, useEffect } from "react";
import { Container } from "@mui/material";
import { useProgram } from "../../../utils/useProgram";
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

    try {
      //@ts-ignore
      const markets = await program.account.lendingMarket.all();

      if (markets.length === 0) {
        toast.error("No lending markets found");
        setReserves([]);
        return;
      }

      //@ts-ignore
      const allRes = await program.account.reserve.all();

      if (allRes.length === 0) {
        //@ts-ignore
        toast.info("No reserves available yet");
        setReserves([]);
        return;
      }

      const reservesWithData = await Promise.all(
        //@ts-ignore
        allRes.map(async (reserve, index) => {
          try {

            const liquidityMint = reserve.account.liquidityMint;
            const liquiditySupply = reserve.account.liquiditySupply;

            const mintInfo = await program.provider.connection.getParsedAccountInfo(
              liquidityMint
            );
            //@ts-ignore
            const decimals = mintInfo.value?.data?.parsed?.info?.decimals || 9;

            const supplyInfo = await program.provider.connection.getTokenAccountBalance(
              liquiditySupply
            );
            const totalSupply = parseFloat(supplyInfo.value.uiAmount?.toString() || "0");

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
            console.error(`Error processing reserve ${index + 1}:`, error);
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
      setReserves(reservesWithData);

      if (reservesWithData.length > 0) {
        toast.success(`Loaded ${reservesWithData.length} reserve(s)`);
      } else {
        //@ts-ignore
        toast.info("No reserves available");
      }

    } catch (error: any) {
      toast.error(`Failed to load reserves: ${error.message}`);
      setReserves([]);
    } finally {
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
      return 5.5; 
    }
  };

  const calculateUtilization = (reserveData: any): number => {
    try {
      const availableAmount = reserveData.liquidityAvailableAmount?.toNumber() || 0;
      const borrowedAmountWads = reserveData.liquidityBorrowedAmountWads?.toString() || "0";

      const borrowedAmount = parseFloat(borrowedAmountWads) / Math.pow(10, 18);
      const totalAmount = availableAmount + borrowedAmount;

      if (totalAmount === 0) return 0;

      return Math.min(100, (borrowedAmount / totalAmount) * 100);
    } catch (error) {
      return 65; 
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