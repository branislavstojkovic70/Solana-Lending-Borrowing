// src/components/DepositLiquidity/DepositLiquidity.tsx
import React, { useState, useEffect } from "react";
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  CircularProgress,
  Alert,
  InputAdornment,
  Divider,
  Card,
  CardContent,
  Grid,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { useProgram } from "../../utils/useProgram";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import { refreshReserve } from "../../services/reserves/refreshService";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import RefreshIcon from "@mui/icons-material/Refresh";
import { depositReserveLiquidity, getUserCollateralBalance, getUserLiquidityBalance } from "../../services/deposit/depositService";

const DepositLiquidity: React.FC = () => {
  const { reserveAddress } = useParams<{ reserveAddress: string }>();
  const { program } = useProgram();
  const { publicKey, connected } = useWallet();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [amount, setAmount] = useState("");
  const [reserveData, setReserveData] = useState<any>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [userCollateral, setUserCollateral] = useState<number>(0);
  const [apy, setApy] = useState<number>(0);

  useEffect(() => {
    if (program && reserveAddress && publicKey) {
      loadReserveData();
      loadUserBalances();
    }
  }, [program, reserveAddress, publicKey]);

  const loadReserveData = async () => {
    if (!program || !reserveAddress) return;

    try {
      setLoadingData(true);
      const reservePubkey = new PublicKey(reserveAddress);
      
      //@ts-ignore
      const reserve = await program.account.reserve.fetch(reservePubkey);
      setReserveData(reserve);

      const calculatedAPY = calculateAPY(reserve);
      setApy(calculatedAPY);

    } catch (error) {
      toast.error("Failed to load reserve data");
    } finally {
      setLoadingData(false);
    }
  };

  const loadUserBalances = async () => {
    if (!program || !reserveAddress || !publicKey) return;

    try {
      const reservePubkey = new PublicKey(reserveAddress);
      
      const balance = await getUserLiquidityBalance(
        //@ts-ignore
        program,
        reservePubkey,
        publicKey
      );
      setUserBalance(balance);

      const collateral = await getUserCollateralBalance(
        //@ts-ignore
        program,
        reservePubkey,
        publicKey
      );
      setUserCollateral(collateral);

    } catch (error) {
      console.error(" Error loading balances:", error);
    }
  };

  const handleRefreshReserve = async () => {
    if (!program || !reserveAddress) return;

    try {
      setRefreshing(true);
      const reservePubkey = new PublicKey(reserveAddress);
      
      await refreshReserve(program, reservePubkey);
      toast.success("Reserve refreshed successfully!");
      
      // Reload data
      await loadReserveData();
      await loadUserBalances();
    } catch (error: any) {
      console.error("❌ Error refreshing reserve:", error);
      toast.error(error.message || "Failed to refresh reserve");
    } finally {
      setRefreshing(false);
    }
  };

  const calculateAPY = (reserve: any): number => {
    try {
      const optimalBorrowRate = reserve.config?.optimalBorrowRate || 0;
      const availableAmount = reserve.liquidityAvailableAmount?.toNumber() || 0;
      const borrowedAmountWads = reserve.liquidityBorrowedAmountWads?.toString() || "0";
      
      const borrowedAmount = parseFloat(borrowedAmountWads) / Math.pow(10, 18);
      const totalAmount = availableAmount + borrowedAmount;
      
      if (totalAmount === 0) return 5.5;
      
      const utilizationRate = (borrowedAmount / totalAmount) * 100;
      const supplyAPY = (optimalBorrowRate / 100) * (utilizationRate / 100) * 0.8;
      
      return Math.max(5.5, supplyAPY * 100);
    } catch (error) {
      return 5.5;
    }
  };

  const handleDeposit = async () => {
    if (!program || !reserveAddress || !publicKey || !connected) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (parseFloat(amount) > userBalance) {
      toast.error("Insufficient balance");
      return;
    }

    setLoading(true);

    try {
      const reservePubkey = new PublicKey(reserveAddress);

      const result = await depositReserveLiquidity(program, {
        reserve: reservePubkey,
        liquidityAmount: parseFloat(amount),
        userPublicKey: publicKey,
      });

      toast.success(`Successfully deposited ${amount} tokens!`);
      console.log("✅ Deposit successful:", result);

      // Refresh balances
      await loadUserBalances();
      setAmount("");
    } catch (error: any) {
      console.error("❌ Deposit failed:", error);
      toast.error(error.message || "Failed to deposit liquidity");
    } finally {
      setLoading(false);
    }
  };

  const handleMaxClick = () => {
    setAmount(userBalance.toString());
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!connected) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: "center" }}>
          <AccountBalanceWalletIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Wallet Not Connected
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Please connect your wallet to deposit liquidity
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (loadingData) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              Loading reserve data...
            </Typography>
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/market/overview")}
        sx={{ mb: 3 }}
      >
        Back to Markets
      </Button>

      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h4" fontWeight="bold">
            💰 Supply Liquidity
          </Typography>
          <Button
            startIcon={<RefreshIcon />}
            onClick={handleRefreshReserve}
            disabled={refreshing}
            size="small"
            variant="outlined"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </Box>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Reserve: {formatAddress(reserveAddress || "")}
        </Typography>

        <Divider sx={{ my: 3 }} />

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Your Balance
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {userBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Your Supplied
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {userCollateral.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ bgcolor: "success.light" }}>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                  <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5 }} />
                  <Typography variant="body2" color="text.secondary">
                    Supply APY
                  </Typography>
                </Box>
                <Typography variant="h5" fontWeight="bold" color="success.dark">
                  {apy.toFixed(2)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Deposit Form */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom fontWeight="500">
            Amount to Supply
          </Typography>
          <TextField
            fullWidth
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Button size="small" onClick={handleMaxClick}>
                    MAX
                  </Button>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 1 }}
          />
          <Typography variant="caption" color="text.secondary">
            Available: {userBalance.toFixed(2)} tokens
          </Typography>
        </Box>

        {/* Expected Returns */}
        {amount && parseFloat(amount) > 0 && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Expected yearly earnings:</strong>{" "}
              {(parseFloat(amount) * (apy / 100)).toFixed(2)} tokens
            </Typography>
            <Typography variant="caption">
              You will receive collateral tokens that represent your deposit + earned interest
            </Typography>
          </Alert>
        )}

        {/* Deposit Button */}
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleDeposit}
          disabled={loading || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > userBalance}
          sx={{ py: 1.5 }}
        >
          {loading ? (
            <>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              Depositing...
            </>
          ) : (
            "Supply Liquidity"
          )}
        </Button>

        {/* Info */}
        <Box sx={{ mt: 3, p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            ℹ️ <strong>How it works:</strong> When you supply liquidity, you receive collateral
            tokens that represent your deposit. These tokens automatically earn interest based on
            the reserve's APY. You can redeem them anytime to get back your deposit + earnings.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default DepositLiquidity;