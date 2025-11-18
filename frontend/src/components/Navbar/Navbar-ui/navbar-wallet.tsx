import { Box, Typography, Button } from "@mui/material";
import { useWallet } from "@solana/wallet-adapter-react";
import { useTheme } from "@mui/material/styles";
import { WalletButton } from "../../ui/wallet/walletButton";
import { NavbarIcon } from "./navbar-icon";

export const NavbarWallet = () => {
  const { publicKey, disconnect, wallet, connected } = useWallet();
  const theme = useTheme();

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!connected) {
    return <WalletButton />;
  }

  if (!publicKey) return null;

  const walletIcon = wallet?.adapter?.icon || "/logo.png";
  const walletName = wallet?.adapter?.name || "Wallet";

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          backgroundColor: theme.palette.action.hover,
          borderRadius: "12px",
          px: 2,
          py: 1,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <NavbarIcon 
          iconUrl={walletIcon} 
          alt={walletName} 
          size={32}
        />
        <Typography
          sx={{
            fontSize: "14px",
            fontWeight: 600,
            color: theme.palette.primary.contrastText,
            fontFamily: "monospace",
          }}
        >
          {shortenAddress(publicKey.toBase58())}
        </Typography>
      </Box>

      <Button
        onClick={disconnect}
        variant="outlined"
        sx={{
          textTransform: "none",
          color: theme.palette.error.main,
          borderColor: theme.palette.error.main,
          borderRadius: "8px",
          px: 2,
          py: 0.75,
          fontSize: "14px",
          fontWeight: 500,
          transition: "all 0.2s",
          "&:hover": {
            borderColor: theme.palette.error.dark,
            backgroundColor: theme.palette.error.light,
            color: theme.palette.error.dark,
          },
        }}
      >
        Disconnect
      </Button>
    </Box>
  );
};