import { Box, Drawer, Typography } from "@mui/material";
import { Outlet } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import { useState } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";
import { NavigationMenu } from "./navbar-menu";
import { NavbarLogo } from "./Navbar-ui/navbar-logo";
import { HamburgerMenu } from "./Navbar-ui/navbar-hamburger-menu";
import { NavbarWallet } from "./Navbar-ui/navbar-wallet";

export const Navbar = () => {
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };
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
            px: { xs: 2, md: 3 },
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ display: { xs: "block", md: "none" } }}>
              <HamburgerMenu
                onClick={handleDrawerToggle}
                color={theme.palette.primary.contrastText}
              />
            </Box>

            <NavbarLogo />
          </Box>

          <NavigationMenu variant="horizontal" />

          <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 2 }}>
            <NavbarWallet />
          </Box>

          <Box sx={{ display: { xs: "flex", md: "none" } }}>
            <NavbarWallet />
          </Box>
        </Box>
      </Box>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: 280,
            background: `linear-gradient(180deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
            pl: 1, 
          }}>
            <Typography
              variant="h6"
              sx={{
                color: theme.palette.primary.contrastText,
                fontWeight: 600
              }}
            >
              Menu
            </Typography>
          </Box>

          <Box sx={{ pl: 1 }}>
            <NavigationMenu
              variant="vertical"
              onItemClick={handleDrawerToggle}
            />
          </Box>
        </Box>
      </Drawer>
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