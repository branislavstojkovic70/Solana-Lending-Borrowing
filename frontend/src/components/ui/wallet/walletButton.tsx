import { Box } from "@mui/material";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useTheme } from "@mui/material/styles";

export const WalletButton = () => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        "& .wallet-adapter-button": {
          backgroundColor: `${theme.palette.secondary.main} !important`,
          borderRadius: "8px !important",
          padding: "10px 24px !important",
          fontSize: "14px !important",
          fontWeight: "600 !important",
          color: `${theme.palette.secondary.contrastText} !important`,
          height: "42px !important",
          transition: "all 0.2s !important",
          border: `1px solid ${theme.palette.divider} !important`,
        },
        "& .wallet-adapter-button:hover": {
          backgroundColor: `${theme.palette.action.hover} !important`,
          transform: "translateY(-2px) !important",
        },
      }}
    >
      <WalletMultiButton />
    </Box>
  );
};