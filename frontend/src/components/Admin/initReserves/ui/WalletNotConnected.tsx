import React from "react";
import { Container, Alert, Typography } from "@mui/material";

export const WalletNotConnected: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Alert severity="warning" sx={{ textAlign: "center" }}>
        <Typography variant="h6" gutterBottom>
          👛 Wallet Not Connected
        </Typography>
        Please connect your wallet to initialize a reserve
      </Alert>
    </Container>
  );
};