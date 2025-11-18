import { Box } from "@mui/material";
import {
  Dashboard,
  TrendingUp,
  Savings,
  AccountBalance,
  Receipt,
} from "@mui/icons-material";
import { NavButton } from "../ui/navbar/navButton";

interface NavigationItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navigationItems: NavigationItem[] = [
  { path: "/dashboard", label: "Dashboard", icon: <Dashboard /> },
  { path: "/markets", label: "Markets", icon: <TrendingUp /> },
  { path: "/supply", label: "Supply", icon: <Savings /> },
  { path: "/borrow", label: "Borrow", icon: <AccountBalance /> },
  { path: "/portfolio", label: "Portfolio", icon: <Receipt /> },
];

export const NavigationMenu = () => {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      {navigationItems.map((item) => (
        <NavButton
          key={item.path}
          path={item.path}
          label={item.label}
          icon={item.icon}
        />
      ))}
    </Box>
  );
};