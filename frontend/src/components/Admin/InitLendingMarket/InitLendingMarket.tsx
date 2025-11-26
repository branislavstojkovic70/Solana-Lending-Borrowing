import React, { useState } from "react";
import { Box, Container, Alert } from "@mui/material";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  createLendingMarket,
  validateQuoteCurrency,
} from "../../../services/lending/lendingMarketService";
import toast from "react-hot-toast";
import { useProgram } from "../../../utils/useProgram";
import type { LendingMarketState } from "../../../services/lending/types";
import { MarketCreatedSuccess } from "./ui/marketCreatedSuccess";
import { InitMarketForm } from "./ui/initMarketForm";

export const InitLendingMarket: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const { program, wallet } = useProgram();

  const [quoteCurrency, setQuoteCurrency] = useState("USD");
  const [state, setState] = useState<LendingMarketState>({
    loading: false,
    error: null,
    createdMarket: null,
  });

  const handleSubmit = async () => {
    if (!connected || !publicKey || !wallet) {
      toast.error("Please connect your wallet first");
      return;
    }

    const validation = validateQuoteCurrency(quoteCurrency);
    if (!validation.valid) {
      toast.error(validation.error || "Invalid quote currency");
      setState((prev) => ({ ...prev, error: validation.error || null }));
      return;
    }

    setState({ loading: true, error: null, createdMarket: null });

    try {
      //@ts-ignore
      const result = await createLendingMarket(program, {
        quoteCurrency: quoteCurrency.trim(),
        owner: publicKey,
      });

      setState({
        loading: false,
        error: null,
        createdMarket: result,
      });

      toast.success("🎉 Lending market created successfully!");
    } catch (error: any) {
      console.error("Error creating market:", error);
      
      const errorMessage = error.message || "Failed to create lending market";
      
      setState({
        loading: false,
        error: errorMessage,
        createdMarket: null,
      });
      
      toast.error(errorMessage);
    }
  };

  const handleCreateAnother = () => {
    setState({ loading: false, error: null, createdMarket: null });
    setQuoteCurrency("USD");
  };
  if (!connected) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert
          severity="warning"
          sx={{
            maxWidth: 600,
            mx: "auto",
            textAlign: "center",
            fontSize: "16px",
          }}
        >
          <Box sx={{ mb: 2, fontSize: "18px", fontWeight: 600 }}>
            👛 Wallet Not Connected
          </Box>
          Please connect your wallet to create a lending market
        </Alert>
      </Container>
    );
  }
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      {state.createdMarket ? (
        <MarketCreatedSuccess
          marketAddress={state.createdMarket.marketAddress}
          signature={state.createdMarket.signature}
          onCreateAnother={handleCreateAnother}
        />
      ) : (
        <InitMarketForm
          quoteCurrency={quoteCurrency}
          owner={publicKey?.toBase58() || ""}
          loading={state.loading}
          error={state.error}
          onQuoteCurrencyChange={setQuoteCurrency}
          onSubmit={handleSubmit}
          disabled={!connected}
        />
      )}
    </Container>
  );
};

export default InitLendingMarket;