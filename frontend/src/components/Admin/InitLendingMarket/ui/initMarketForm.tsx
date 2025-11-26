import React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { AddCircleOutline } from "@mui/icons-material";

interface InitMarketFormProps {
  quoteCurrency: string;
  owner: string;
  loading: boolean;
  error: string | null;
  onQuoteCurrencyChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const InitMarketForm: React.FC<InitMarketFormProps> = ({
  quoteCurrency,
  owner,
  loading,
  error,
  onQuoteCurrencyChange,
  onSubmit,
  disabled = false,
}) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading && quoteCurrency && !disabled) {
      onSubmit();
    }
  };

  return (
    <Card
      sx={{
        maxWidth: 600,
        mx: "auto",
        boxShadow: 3,
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ mb: 3, textAlign: "center" }}>
          <AddCircleOutline
            sx={{ fontSize: 60, color: "primary.main", mb: 2 }}
          />
          <Typography variant="h4" gutterBottom fontWeight={700}>
            Create Lending Market
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Initialize a new lending market for your protocol
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <TextField
            label="Quote Currency"
            value={quoteCurrency}
            onChange={(e) => onQuoteCurrencyChange(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            placeholder="USD"
            helperText="Currency used for pricing (max 32 characters, alphanumeric only)"
            fullWidth
            required
            disabled={loading || disabled}
            inputProps={{ maxLength: 32 }}
            error={!!error}
          />

          <TextField
            label="Market Owner"
            value={owner || "Connect wallet"}
            disabled
            fullWidth
            helperText="Your wallet will be the market owner"
          />

          <Button
            variant="contained"
            size="large"
            onClick={onSubmit}
            disabled={loading || !quoteCurrency.trim() || disabled}
            startIcon={
              loading ? <CircularProgress size={20} /> : <AddCircleOutline />
            }
            sx={{
              py: 1.5,
              fontSize: "16px",
              fontWeight: 600,
              textTransform: "none",
            }}
          >
            {loading ? "Creating Market..." : "Create Market"}
          </Button>

          <Alert severity="info" variant="outlined">
            <Typography variant="body2" fontWeight={500}>
              ℹ️ Important Notes:
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              • This is a one-time setup operation
              <br />
              • Save the market address after creation
              <br />
              • You'll need it to create reserves
              <br />
              • Operation requires SOL for transaction fees (~0.01 SOL)
            </Typography>
          </Alert>
        </Box>
      </CardContent>
    </Card>
  );
};