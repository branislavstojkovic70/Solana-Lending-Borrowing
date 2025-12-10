// src/components/Reserves/DepositLiquidity/ui/DepositForm.tsx
import React from "react";
import {
  Paper,
  Typography,
  Divider,
  Box,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
  MenuItem,
  Alert,
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

interface Reserve {
  address: string;
  data: any;
}

interface DepositFormProps {
  reserves: Reserve[];
  selectedReserve: string;
  depositAmount: string;
  userBalance: number;
  collateralBalance: number;
  expectedCollateral: number;
  loading: boolean;
  loadingReserves: boolean;
  onReserveChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onMaxClick: () => void;
  onDeposit: () => void;
}

export const DepositForm: React.FC<DepositFormProps> = ({
  reserves,
  selectedReserve,
  depositAmount,
  userBalance,
  collateralBalance,
  expectedCollateral,
  loading,
  loadingReserves,
  onReserveChange,
  onAmountChange,
  onMaxClick,
  onDeposit,
}) => {
  return (
    <Paper elevation={3} sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        💰 Deposit Liquidity
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Supply liquidity to earn interest and receive collateral tokens
      </Typography>

      <Divider sx={{ my: 3 }} />

      {/* Reserve Selection */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Select Reserve
        </Typography>
        {loadingReserves ? (
          <CircularProgress size={24} />
        ) : reserves.length === 0 ? (
          <Alert severity="warning">
            No reserves available. Please create a reserve first.
          </Alert>
        ) : (
          <TextField
            select
            fullWidth
            value={selectedReserve}
            onChange={(e) => onReserveChange(e.target.value)}
            label="Reserve"
          >
            {reserves.map((reserve) => (
              <MenuItem key={reserve.address} value={reserve.address}>
                {reserve.address.slice(0, 8)}...{reserve.address.slice(-8)}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Box>

      {/* Balance Info */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <AccountBalanceWalletIcon
                  sx={{ mr: 1, color: "primary.main" }}
                />
                <Typography variant="subtitle2" color="text.secondary">
                  Available Balance
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight="bold">
                {userBalance.toLocaleString()} tokens
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <TrendingUpIcon sx={{ mr: 1, color: "success.main" }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Your Collateral
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight="bold">
                {collateralBalance.toLocaleString()} cTokens
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Deposit Amount Input */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Deposit Amount
        </Typography>
        <TextField
          fullWidth
          type="number"
          value={depositAmount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Button size="small" onClick={onMaxClick}>
                  MAX
                </Button>
              </InputAdornment>
            ),
          }}
          helperText={`Available: ${userBalance.toLocaleString()} tokens`}
        />
      </Box>

      {/* Expected Collateral */}
      {expectedCollateral > 0 && (
        <Box
          sx={{
            mb: 4,
            p: 2,
            bgcolor: "success.lighter",
            borderRadius: 2,
          }}
        >
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            You will receive (estimated)
          </Typography>
          <Typography variant="h5" fontWeight="bold" color="success.main">
            {expectedCollateral.toLocaleString()} cTokens
          </Typography>
        </Box>
      )}

      {/* Submit Button */}
      <Button
        variant="contained"
        size="large"
        fullWidth
        onClick={onDeposit}
        disabled={loading || loadingReserves || !selectedReserve || !depositAmount}
        sx={{ py: 1.5 }}
      >
        {loading ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          "Deposit Liquidity"
        )}
      </Button>

      {/* Info Box */}
      <Box sx={{ mt: 3, p: 2, bgcolor: "info.lighter", borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          💡 Collateral tokens (cTokens) represent your share of the reserve.
          They automatically earn interest and can be redeemed for the underlying
          asset at any time.
        </Typography>
      </Box>
    </Paper>
  );
};