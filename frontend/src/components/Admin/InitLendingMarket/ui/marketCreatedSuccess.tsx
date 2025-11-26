import React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  CheckCircle,
  ContentCopy,
  OpenInNew,
  ArrowForward,
  Refresh,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

interface MarketCreatedSuccessProps {
  marketAddress: string;
  signature: string;
  onCreateAnother: () => void;
}

export const MarketCreatedSuccess: React.FC<MarketCreatedSuccessProps> = ({
  marketAddress,
  signature,
  onCreateAnother,
}) => {
  const navigate = useNavigate();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const openInExplorer = (sig: string) => {
    const explorerUrl = `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899`;
    window.open(explorerUrl, "_blank");
  };

  return (
    <Card
      sx={{
        maxWidth: 700,
        mx: "auto",
        boxShadow: 3,
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <CheckCircle
            sx={{
              fontSize: 80,
              color: "success.main",
              mb: 2,
            }}
          />
          <Typography variant="h4" gutterBottom fontWeight={700}>
            Market Created Successfully! 🎉
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your lending market is now ready to accept reserves
          </Typography>
        </Box>

        <Alert
          severity="success"
          variant="outlined"
          sx={{
            mb: 3,
            "& .MuiAlert-message": { width: "100%" },
          }}
        >
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              📍 Market Address
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                backgroundColor: "background.paper",
                p: 2,
                borderRadius: 1,
                mt: 1,
              }}
            >
              <Typography
                sx={{
                  flex: 1,
                  fontFamily: "monospace",
                  fontSize: "14px",
                  wordBreak: "break-all",
                }}
              >
                {marketAddress}
              </Typography>
              <Tooltip title="Copy address">
                <IconButton
                  size="small"
                  onClick={() => copyToClipboard(marketAddress, "Market address")}
                >
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Alert>
        <Alert
          severity="info"
          variant="outlined"
          sx={{
            mb: 3,
            "& .MuiAlert-message": { width: "100%" },
          }}
        >
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              📝 Transaction Signature
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                backgroundColor: "background.paper",
                p: 2,
                borderRadius: 1,
                mt: 1,
              }}
            >
              <Typography
                sx={{
                  flex: 1,
                  fontFamily: "monospace",
                  fontSize: "14px",
                  wordBreak: "break-all",
                }}
              >
                {signature}
              </Typography>
              <Tooltip title="Copy signature">
                <IconButton
                  size="small"
                  onClick={() => copyToClipboard(signature, "Signature")}
                >
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="View in explorer">
                <IconButton size="small" onClick={() => openInExplorer(signature)}>
                  <OpenInNew fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Alert>

        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            ⚙️ Add to your .env file:
          </Typography>
          <Box
            sx={{
              backgroundColor: "background.paper",
              p: 2,
              borderRadius: 1,
              fontFamily: "monospace",
              fontSize: "14px",
              mt: 1,
              cursor: "pointer",
              "&:hover": { backgroundColor: "action.hover" },
            }}
            onClick={() =>
              copyToClipboard(
                `VITE_LENDING_MARKET=${marketAddress}`,
                "Environment variable"
              )
            }
          >
            <Typography sx={{ fontFamily: "monospace" }}>
              VITE_LENDING_MARKET={marketAddress}
            </Typography>
          </Box>
        </Alert>

        <Box sx={{ display: "flex", gap: 2, mt: 4 }}>
          <Button
            variant="outlined"
            fullWidth
            onClick={onCreateAnother}
            startIcon={<Refresh />}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Create Another
          </Button>
          <Button
            variant="contained"
            fullWidth
            endIcon={<ArrowForward />}
            onClick={() => navigate("/admin/create-reserve")}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Create Reserve
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};