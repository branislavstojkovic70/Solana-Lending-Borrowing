import React from "react";
import { Box, Typography, CircularProgress, Alert } from "@mui/material";

interface LendingMarketInfoProps {
  lendingMarket: string;
  loading: boolean;
}

export const LendingMarketInfo: React.FC<LendingMarketInfoProps> = ({
  lendingMarket,
  loading,
}) => {
  return (
    <Box sx={{ mb: 4, p: 2, bgcolor: "background.default", borderRadius: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Your Lending Market
      </Typography>
      {loading ? (
        <CircularProgress size={20} />
      ) : lendingMarket ? (
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
          {lendingMarket}
        </Typography>
      ) : (
        <Alert severity="warning" sx={{ mt: 1 }}>
          No lending market found. Please create one first.
        </Alert>
      )}
    </Box>
  );
};