// src/components/supply/AddLiquidity/ui/SupplySuccess.tsx

import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Divider,
  Stack,
  Chip,
} from "@mui/material";
import {
  CheckCircle,
  OpenInNew,
  AccountBalance,
  TrendingUp,
} from "@mui/icons-material";

interface SupplySuccessProps {
  asset: string;
  amount: string;
  collateralReceived: string;
  exchangeRate: string;
  signature: string;
  supplyAPY: number;
  onSupplyMore: () => void;
  onViewTransaction: () => void;
}

export const SupplySuccess: React.FC<SupplySuccessProps> = ({
  asset,
  amount,
  collateralReceived,
  exchangeRate,
  signature,
  supplyAPY,
  onSupplyMore,
  onViewTransaction,
}) => {
  return (
    <Card sx={{ maxWidth: 600, mx: "auto" }}>
      <CardContent sx={{ p: 4 }}>
        {/* Success Icon */}
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <CheckCircle
            sx={{ fontSize: 80, color: "success.main", mb: 2 }}
          />
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Supply Successful!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your liquidity has been added to the protocol
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Supply Details */}
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">
              Supplied
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {amount} {asset}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">
              Received
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {collateralReceived} lp{asset}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">
              Exchange Rate
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              1 lp{asset} = {exchangeRate} {asset}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">
              Current APY
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <TrendingUp fontSize="small" color="success" />
              <Typography
                variant="body1"
                fontWeight={600}
                color="success.main"
              >
                {supplyAPY.toFixed(2)}%
              </Typography>
            </Box>
          </Box>
        </Stack>

        <Divider sx={{ my: 3 }} />

        {/* Transaction */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Transaction Signature
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              p: 1.5,
              bgcolor: "background.default",
              borderRadius: 1,
              cursor: "pointer",
              "&:hover": { bgcolor: "action.hover" },
            }}
            onClick={onViewTransaction}
          >
            <Typography
              variant="caption"
              sx={{
                fontFamily: "monospace",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {signature}
            </Typography>
            <OpenInNew fontSize="small" color="action" />
          </Box>
        </Box>

        {/* Info Box */}
        <Box
          sx={{
            p: 2,
            bgcolor: "success.light",
            borderRadius: 1,
            mb: 3,
          }}
        >
          <Typography variant="caption" color="success.dark">
            🎉 Your lp{asset} tokens are now earning {supplyAPY.toFixed(2)}%
            APY! You can withdraw your funds at any time.
          </Typography>
        </Box>

        {/* Actions */}
        <Stack spacing={2}>
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={onSupplyMore}
            sx={{ height: 56 }}
          >
            Supply More {asset}
          </Button>

          <Button
            fullWidth
            variant="outlined"
            size="large"
            onClick={onViewTransaction}
            startIcon={<OpenInNew />}
          >
            View on Explorer
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};