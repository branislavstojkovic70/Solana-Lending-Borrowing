// src/components/Market/MarketOverview/ui/ReservesList.tsx
import React from "react";
import {
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";

interface Reserve {
  address: string;
  data: any;
  totalSupply?: number;
  apy?: number;
  utilization?: number;
}

interface ReservesListProps {
  reserves: Reserve[];
  loading: boolean;
  onDeposit: (address: string) => void;
  onBorrow: (address: string) => void;
  onRefresh: () => void;
}

export const ReservesList: React.FC<ReservesListProps> = ({
  reserves,
  loading,
  onDeposit,
  onBorrow,
  onRefresh,
}) => {
  console.log("🎨 ReservesList render - loading:", loading, "reserves:", reserves.length);

  const formatAddress = (address: string) => {
    if (!address) return "Unknown";
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ ml: 2 }}>
            Loading reserves...
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 4 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" gutterBottom fontWeight="bold">
            📊 Markets Overview
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Available lending and borrowing markets ({reserves.length} reserve{reserves.length !== 1 ? 's' : ''})
          </Typography>
        </Box>
        <Tooltip title="Refresh data">
          <IconButton onClick={onRefresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {reserves.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <AccountBalanceIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No reserves available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Be the first to create a lending market!
          </Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <strong>Asset</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>Total Supply</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>Supply APY</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>Utilization</strong>
                </TableCell>
                <TableCell align="center">
                  <strong>Actions</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reserves.map((reserve) => {
                console.log("Rendering reserve row:", reserve.address);
                return (
                  <TableRow
                    key={reserve.address}
                    sx={{
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            bgcolor: "primary.main",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mr: 2,
                          }}
                        >
                          <Typography variant="body2" color="white" fontWeight="bold">
                            {formatAddress(reserve.address)[0].toUpperCase()}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body1" fontWeight="500">
                            Reserve {formatAddress(reserve.address)}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{ 
                              display: "block",
                              maxWidth: "200px",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}
                          >
                            {reserve.address}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body1">
                        {(reserve.totalSupply || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                        <TrendingUpIcon
                          sx={{ fontSize: 16, color: "success.main", mr: 0.5 }}
                        />
                        <Typography variant="body1" color="success.main" fontWeight="500">
                          {(reserve.apy || 0).toFixed(2)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${(reserve.utilization || 0).toFixed(0)}%`}
                        size="small"
                        color={
                          (reserve.utilization || 0) > 80
                            ? "error"
                            : (reserve.utilization || 0) > 60
                            ? "warning"
                            : "success"
                        }
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => onDeposit(reserve.address)}
                        >
                          Supply
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => onBorrow(reserve.address)}
                        >
                          Borrow
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};