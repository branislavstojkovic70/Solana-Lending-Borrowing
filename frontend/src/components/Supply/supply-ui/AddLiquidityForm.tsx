// src/components/supply/AddLiquidity/ui/AddLiquidityForm.tsx

import React from "react";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  Chip,
  Stack,
  useTheme,
} from "@mui/material";
import { AccountBalanceWallet, TrendingUp } from "@mui/icons-material";

interface AddLiquidityFormProps {
  asset: string;
  amount: string;
  balance: number;
  exchangeRate: string;
  estimatedCollateral: string;
  supplyAPY: number;
  loading: boolean;
  error: string | null;
  onAmountChange: (amount: string) => void;
  onMaxClick: () => void;
  onSubmit: () => void;
}

export const AddLiquidityForm: React.FC<AddLiquidityFormProps> = ({
  asset,
  amount,
  balance,
  exchangeRate,
  estimatedCollateral,
  supplyAPY,
  loading,
  error,
  onAmountChange,
  onMaxClick,
  onSubmit,
}) => {
  const amountNum = parseFloat(amount) || 0;
  const isValid = amountNum > 0 && amountNum <= balance;
  const theme = useTheme();

  return (
    <Card sx={{ maxWidth: 600, mx: "auto" }}>
      <CardContent sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Supply {asset}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Earn interest by supplying liquidity to the protocol
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            mb: 3,
            p: 2,
            bgcolor: theme.palette.secondary.light,
            borderRadius: 2,
          }}
        >
          <TrendingUp sx={{ color: theme.palette.text.primary }} />
          <Box>
            <Typography variant="body2" color={theme.palette.text.primary}>
              Current Supply APY
            </Typography>
            <Typography variant="h6" color={theme.palette.text.primary} fontWeight={600}>
              {supplyAPY.toFixed(2)}%
            </Typography>
          </Box>
        </Box>

        {/* Balance */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AccountBalanceWallet fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              Available Balance
            </Typography>
          </Box>
          <Typography variant="body2" fontWeight={600}>
            {balance.toFixed(6)} {asset}
          </Typography>
        </Box>

        {/* Amount Input */}
        <TextField
          fullWidth
          label="Amount"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          type="number"
          disabled={loading}
          sx={{ mb: 2 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Stack direction="row" spacing={1}>
                  <Chip
                    label="MAX"
                    size="small"
                    onClick={onMaxClick}
                    disabled={loading}
                    sx={{ cursor: "pointer" }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {asset}
                  </Typography>
                </Stack>
              </InputAdornment>
            ),
          }}
          helperText={
            amountNum > balance
              ? "Amount exceeds balance"
              : amountNum > 0
              ? `≈ ${estimatedCollateral} lp${asset}`
              : ""
          }
          error={amountNum > balance}
        />

        {/* Exchange Rate Info */}
        {amountNum > 0 && (
          <Box
            sx={{
              p: 2,
              bgcolor: "background.default",
              borderRadius: 1,
              mb: 3,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              gutterBottom
            >
              You will receive:
            </Typography>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              {estimatedCollateral} lp{asset}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Exchange Rate: 1 lp{asset} = {exchangeRate} {asset}
            </Typography>
          </Box>
        )}

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Submit Button */}
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={onSubmit}
          disabled={!isValid || loading}
          sx={{ height: 56 }}
        >
          {loading ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Supplying...
            </>
          ) : (
            `Supply ${asset}`
          )}
        </Button>

        {/* Info Box */}
        <Box
          sx={{
            mt: 3,
            p: 2,
            bgcolor: theme.palette.info,
            borderRadius: 1,
            border: 1,
            borderColor: "info.main",
          }}
        >
          <Typography variant="caption" color="info.dark">
            💡 Your lp{asset} tokens represent your share of the supply pool.
            The value increases over time as interest accrues from borrowers.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};