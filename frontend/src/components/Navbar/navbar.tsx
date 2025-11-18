import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import "@solana/wallet-adapter-react-ui/styles.css";
import { NavbarLogo } from "./Navbar-ui/navbar-logo";
import { NavigationMenu } from "./navbar-menu";
import { NavbarWallet } from "./Navbar-ui/navbar-wallet";

export const Navbar = () => {
  const theme = useTheme();

  return (
    <Box sx={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          flex: "0 1 auto",
          background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
          boxShadow: `0 2px 10px ${theme.palette.primary.dark}`,
        }}
      >
        <Box
          sx={{
            minHeight: "70px",
            px: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <NavbarLogo />
          <NavigationMenu />
          <NavbarWallet />
        </Box>
      </Box>

      <Box
        sx={{
          flex: "1 1 auto",
          width: "100%",
          overflow: "auto",
          backgroundColor: theme.palette.background.default,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Navbar;