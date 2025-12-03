import React from "react";
import { Grid, TextField, InputAdornment, Typography } from "@mui/material";

interface BasicConfigSectionProps {
  liquidityMint: string;
  liquidityAmount: string;
  pythPriceFeedId: string;
  onLiquidityMintChange: (value: string) => void;
  onLiquidityAmountChange: (value: string) => void;
  onPythFeedIdChange: (value: string) => void;
}

export const BasicConfigSection: React.FC<BasicConfigSectionProps> = ({
  liquidityMint,
  liquidityAmount,
  pythPriceFeedId,
  onLiquidityMintChange,
  onLiquidityAmountChange,
  onPythFeedIdChange,
}) => {
  return (
    <>
      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        Basic Configuration
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Liquidity Mint Address"
            value={liquidityMint}
            onChange={(e) => onLiquidityMintChange(e.target.value)}
            placeholder="Enter SPL token mint address"
            required
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Initial Liquidity Amount"
            type="number"
            value={liquidityAmount}
            onChange={(e) => onLiquidityAmountChange(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">tokens</InputAdornment>
              ),
            }}
            required
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Pyth Price Feed ID (32 bytes hex)"
            value={pythPriceFeedId}
            onChange={(e) => onPythFeedIdChange(e.target.value)}
            placeholder="0x..."
            helperText="64 character hex string (32 bytes). Example: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
            required
          />
        </Grid>
      </Grid>
    </>
  );
};