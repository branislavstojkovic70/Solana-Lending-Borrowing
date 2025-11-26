// src/components/supply/AddLiquidity/ui/ReserveSelector.tsx

import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Avatar,
} from "@mui/material";
import { TrendingUp } from "@mui/icons-material";

interface Reserve {
  address: string;
  asset: string;
  icon: string;
  supplyAPY: number;
  totalSupply: string;
  available: string;
}

interface ReserveSelectorProps {
  reserves: Reserve[];
  selectedReserve: string | null;
  onSelectReserve: (address: string) => void;
}

export const ReserveSelector: React.FC<ReserveSelectorProps> = ({
  reserves,
  selectedReserve,
  onSelectReserve,
}) => {
  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mb: 4 }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Select Asset to Supply
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose which asset you'd like to supply and earn interest
      </Typography>

      <Grid container spacing={2}>
        {reserves.map((reserve) => (
        //@ts-ignore
          <Grid item xs={12} sm={6} md={4} key={reserve.address}>
            <Card
              sx={{
                cursor: "pointer",
                border: 2,
                borderColor:
                  selectedReserve === reserve.address
                    ? "primary.main"
                    : "transparent",
                transition: "all 0.2s",
                "&:hover": {
                  borderColor: "primary.light",
                  transform: "translateY(-4px)",
                },
              }}
              onClick={() => onSelectReserve(reserve.address)}
            >
              <CardContent>
                {/* Asset Header */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    mb: 2,
                  }}
                >
                  <Avatar
                    src={reserve.icon}
                    alt={reserve.asset}
                    sx={{ width: 40, height: 40 }}
                  />
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      {reserve.asset}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Supply & Earn
                    </Typography>
                  </Box>
                </Box>

                {/* APY */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 2,
                    p: 1.5,
                    bgcolor: "success.light",
                    borderRadius: 1,
                  }}
                >
                  <TrendingUp fontSize="small" color="success" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Supply APY
                    </Typography>
                    <Typography
                      variant="h6"
                      color="success.main"
                      fontWeight={600}
                    >
                      {reserve.supplyAPY.toFixed(2)}%
                    </Typography>
                  </Box>
                </Box>

                {/* Stats */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Total Supply
                    </Typography>
                    <Typography variant="caption" fontWeight={600}>
                      {reserve.totalSupply}
                    </Typography>
                  </Box>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Available
                    </Typography>
                    <Typography variant="caption" fontWeight={600}>
                      {reserve.available}
                    </Typography>
                  </Box>
                </Box>

                {/* Selected Badge */}
                {selectedReserve === reserve.address && (
                  <Chip
                    label="Selected"
                    color="primary"
                    size="small"
                    sx={{ mt: 2 }}
                  />
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};