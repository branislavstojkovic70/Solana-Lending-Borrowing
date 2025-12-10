// src/components/DepositLiquidity/DepositForm.tsx
import React from "react";
import {
  Box,
  TextField,
  Button,
  CircularProgress,
  Alert,
  InputAdornment,
  Typography,
} from "@mui/material";

interface DepositFormProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  userBalance: number;
  apy: number;
  loading: boolean;
  onSubmit: () => void;
  onMaxClick: () => void;
}

export const DepositForm: React.FC<DepositFormProps> = ({
  amount,
  onAmountChange,
  userBalance,
  apy,
  loading,
  onSubmit,
  onMaxClick,
}) => {
  const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= userBalance;

  return (
    <>
      {/* Amount Input */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" gutterBottom fontWeight="500">
          Amount to Supply
        </Typography>
        <TextField
          fullWidth
          type="number"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
          inputProps={{
            step: "0.01",
            min: "0",
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Button size="small" onClick={onMaxClick} disabled={loading}>
                  MAX
                </Button>
              </InputAdornment>
            ),
          }}
          sx={{ mb: 1 }}
          disabled={loading}
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
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
            You will receive collateral tokens that represent your deposit + earned interest
          </Typography>
        </Alert>
      )}

      {/* Validation Messages */}
      {amount && parseFloat(amount) > userBalance && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Insufficient balance. You only have {userBalance.toFixed(2)} tokens available.
        </Alert>
      )}

      {/* Submit Button */}
      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={onSubmit}
        disabled={loading || !isValidAmount}
        sx={{ py: 1.5 }}
      >
        {loading ? (
          <>
            <CircularProgress size={24} sx={{ mr: 1, color: "white" }} />
            Depositing...
          </>
        ) : (
          "Supply Liquidity"
        )}
      </Button>
    </>
  );
};