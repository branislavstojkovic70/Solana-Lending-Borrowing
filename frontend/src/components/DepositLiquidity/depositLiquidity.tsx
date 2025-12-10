// src/components/Reserves/DepositLiquidity/DepositLiquidity.tsx
import React, { useState, useEffect } from "react";
import { CircularProgress, Container } from "@mui/material";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useProgram } from "../../utils/useProgram";
import { getReserve } from "../../services/reserves/reserveService";
import { calculateExpectedCollateral, depositReserveLiquidity, getUserCollateralBalance, getUserLiquidityBalance } from "../../services/deposit/depositService";
import { WalletNotConnected } from "../Admin/initReserves/ui/WalletNotConnected";
import { DepositForm } from "./ui/depositForm";

export const DepositLiquidity: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const { program } = useProgram();
  const { reserveAddress } = useParams<{ reserveAddress: string }>(); // Get from URL
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [loadingReserve, setLoadingReserve] = useState(false);
  const [reserveData, setReserveData] = useState<any>(null);
  
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [userBalance, setUserBalance] = useState<number>(0);
  const [collateralBalance, setCollateralBalance] = useState<number>(0);
  const [expectedCollateral, setExpectedCollateral] = useState<number>(0);

  useEffect(() => {
    if (program && reserveAddress) {
      loadReserve();
    }
  }, [program, reserveAddress]);

  useEffect(() => {
    if (reserveAddress && publicKey && program) {
      loadUserBalances();
    }
  }, [reserveAddress, publicKey, program]);

  useEffect(() => {
    if (reserveAddress && depositAmount && program) {
      calculateCollateral();
    }
  }, [reserveAddress, depositAmount, program]);

  const loadReserve = async () => {
    if (!program || !reserveAddress) return;

    setLoadingReserve(true);
    try {
      const reserve = await getReserve(
        //@ts-ignore
        program,
        new PublicKey(reserveAddress)
      );
      setReserveData(reserve);
    } catch (error: any) {
      console.error("Error loading reserve:", error);
      toast.error("Failed to load reserve data");
      navigate("/markets"); // Redirect back to markets
    } finally {
      setLoadingReserve(false);
    }
  };

  const loadUserBalances = async () => {
    if (!reserveAddress || !publicKey || !program) return;

    try {
      const reservePubkey = new PublicKey(reserveAddress);
      
      const [liquidity, collateral] = await Promise.all([
        getUserLiquidityBalance(
          //@ts-ignore
          program,
          reservePubkey,
          publicKey
        ),
        getUserCollateralBalance(
          //@ts-ignore
          program,
          reservePubkey,
          publicKey
        ),
      ]);

      setUserBalance(liquidity);
      setCollateralBalance(collateral);
    } catch (error: any) {
      console.error("Error loading balances:", error);
    }
  };

  const calculateCollateral = async () => {
    if (!reserveAddress || !depositAmount || !program) return;

    try {
      const amount = parseFloat(depositAmount);
      if (isNaN(amount) || amount <= 0) {
        setExpectedCollateral(0);
        return;
      }

      const reservePubkey = new PublicKey(reserveAddress);
      const collateral = await calculateExpectedCollateral(
        //@ts-ignore
        program,
        reservePubkey,
        amount
      );

      setExpectedCollateral(collateral);
    } catch (error: any) {
      console.error("Error calculating collateral:", error);
      setExpectedCollateral(0);
    }
  };

  const handleDeposit = async () => {
    if (!connected || !publicKey || !program || !reserveAddress) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const amount = parseFloat(depositAmount);
    if (amount > userBalance) {
      toast.error("Insufficient balance");
      return;
    }

    setLoading(true);

    try {
      const reservePubkey = new PublicKey(reserveAddress);

      const result = await depositReserveLiquidity(
        //@ts-ignore
        program,
        {
          reserve: reservePubkey,
          liquidityAmount: amount,
          userPublicKey: publicKey,
        }
      );

      toast.success("🎉 Liquidity deposited successfully!");
      console.log("Deposit result:", result);

      // Reset form and reload balances
      setDepositAmount("");
      await loadUserBalances();
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to deposit liquidity");
    } finally {
      setLoading(false);
    }
  };

  const handleMaxClick = () => {
    setDepositAmount(userBalance.toString());
  };

  if (!connected) {
    return <WalletNotConnected />;
  }

  if (loadingReserve) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: "center" }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <DepositForm
      //@ts-ignore
        reserveAddress={reserveAddress || ""}
        reserveData={reserveData}
        depositAmount={depositAmount}
        userBalance={userBalance}
        collateralBalance={collateralBalance}
        expectedCollateral={expectedCollateral}
        loading={loading}
        onAmountChange={setDepositAmount}
        onMaxClick={handleMaxClick}
        onDeposit={handleDeposit}
        onBack={() => navigate("/markets")}
      />
    </Container>
  );
};

export default DepositLiquidity;