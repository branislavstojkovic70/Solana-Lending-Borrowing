import React from "react";
import {
  Paper,
  Typography,
  Divider,
  Box,
  Button,
  CircularProgress,
} from "@mui/material";
import { LendingMarketInfo } from "./LendingMarketInfo";
import { BasicConfigSection } from "./BasicConfigSection";
import { AdvancedConfigSection } from "./AdvancedConfigSection";

interface ReserveUIConfig {
  optimalUtilizationRate: number;
  loanToValueRatio: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  minBorrowRate: number;
  optimalBorrowRate: number;
  maxBorrowRate: number;
  borrowFee: number;
  flashLoanFee: number;
  hostFeePercentage: number;
}

interface ReserveFormProps {
  lendingMarket: string;
  loadingMarket: boolean;
  liquidityMint: string;
  liquidityAmount: string;
  pythPriceFeedId: string;
  config: ReserveUIConfig;
  loading: boolean;
  onLiquidityMintChange: (value: string) => void;
  onLiquidityAmountChange: (value: string) => void;
  onPythFeedIdChange: (value: string) => void;
  onConfigChange: (field: keyof ReserveUIConfig, value: any) => void;
  onSubmit: () => void;
}

export const ReserveForm: React.FC<ReserveFormProps> = ({
  lendingMarket,
  loadingMarket,
  liquidityMint,
  liquidityAmount,
  pythPriceFeedId,
  config,
  loading,
  onLiquidityMintChange,
  onLiquidityAmountChange,
  onPythFeedIdChange,
  onConfigChange,
  onSubmit,
}) => {
  return (
    <Paper elevation={3} sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        🏦 Initialize Reserve
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Create a new lending pool for a token
      </Typography>

      <Divider sx={{ my: 3 }} />

      <LendingMarketInfo lendingMarket={lendingMarket} loading={loadingMarket} />

      <BasicConfigSection
        liquidityMint={liquidityMint}
        liquidityAmount={liquidityAmount}
        pythPriceFeedId={pythPriceFeedId}
        onLiquidityMintChange={onLiquidityMintChange}
        onLiquidityAmountChange={onLiquidityAmountChange}
        onPythFeedIdChange={onPythFeedIdChange}
      />
    
      <AdvancedConfigSection config={config} onConfigChange={onConfigChange} />

      <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="large"
          onClick={onSubmit}
          disabled={loading || !lendingMarket || loadingMarket}
          sx={{ px: 6 }}
        >
          {loading ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            "Initialize Reserve"
          )}
        </Button>
      </Box>
    </Paper>
  );
};