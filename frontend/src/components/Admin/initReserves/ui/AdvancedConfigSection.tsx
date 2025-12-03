import React from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  TextField,
  Box,
  Grid,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

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

interface AdvancedConfigSectionProps {
  config: ReserveUIConfig;
  onConfigChange: (field: keyof ReserveUIConfig, value: any) => void;
}

export const AdvancedConfigSection: React.FC<AdvancedConfigSectionProps> = ({
  config,
  onConfigChange,
}) => {
  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6">⚙️ Advanced Configuration</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Optimal Utilization Rate"
              type="number"
              value={config.optimalUtilizationRate}
              onChange={(e) =>
                onConfigChange(
                  "optimalUtilizationRate",
                  parseInt(e.target.value) || 0
                )
              }
              helperText="Target utilization rate (0-100%)"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Loan to Value Ratio"
              type="number"
              value={config.loanToValueRatio}
              onChange={(e) =>
                onConfigChange("loanToValueRatio", parseInt(e.target.value) || 0)
              }
              helperText="LTV ratio percentage (0-100%)"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Liquidation Threshold"
              type="number"
              value={config.liquidationThreshold}
              onChange={(e) =>
                onConfigChange(
                  "liquidationThreshold",
                  parseInt(e.target.value) || 0
                )
              }
              helperText="Threshold for liquidation (0-100%)"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Liquidation Bonus"
              type="number"
              value={config.liquidationBonus}
              onChange={(e) =>
                onConfigChange("liquidationBonus", parseInt(e.target.value) || 0)
              }
              helperText="Bonus for liquidators (0-100%)"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Min Borrow Rate"
              type="number"
              value={config.minBorrowRate}
              onChange={(e) =>
                onConfigChange("minBorrowRate", parseInt(e.target.value) || 0)
              }
              helperText="Minimum borrow rate (0-100%)"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Optimal Borrow Rate"
              type="number"
              value={config.optimalBorrowRate}
              onChange={(e) =>
                onConfigChange("optimalBorrowRate", parseInt(e.target.value) || 0)
              }
              helperText="Optimal borrow rate (0-100%)"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Max Borrow Rate"
              type="number"
              value={config.maxBorrowRate}
              onChange={(e) =>
                onConfigChange("maxBorrowRate", parseInt(e.target.value) || 0)
              }
              helperText="Maximum borrow rate (0-100%)"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Borrow Fee (%)"
              type="number"
              value={config.borrowFee}
              onChange={(e) =>
                onConfigChange("borrowFee", parseFloat(e.target.value) || 0)
              }
              helperText="Fee for borrowing (e.g., 0.1 for 0.1%)"
              inputProps={{ step: "0.1" }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Flash Loan Fee (%)"
              type="number"
              value={config.flashLoanFee}
              onChange={(e) =>
                onConfigChange("flashLoanFee", parseFloat(e.target.value) || 0)
              }
              helperText="Fee for flash loans (e.g., 0.9 for 0.9%)"
              inputProps={{ step: "0.1" }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Host Fee Percentage"
              type="number"
              value={config.hostFeePercentage}
              onChange={(e) =>
                onConfigChange("hostFeePercentage", parseInt(e.target.value) || 0)
              }
              helperText="Host fee percentage (0-100%)"
            />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ p: 2, bgcolor: "info.lighter", borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                💡 Tip: Leave fields at default values unless you understand the
                implications. These settings directly affect the reserve's risk
                parameters and user experience.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};