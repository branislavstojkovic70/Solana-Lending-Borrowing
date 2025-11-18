import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
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

interface NavigationMenuProps {
  variant?: "horizontal" | "vertical";
  onItemClick?: () => void;
}

export const NavigationMenu: React.FC<NavigationMenuProps> = ({ 
  variant = "horizontal",
  onItemClick 
}) => {
  const theme = useTheme();

  if (variant === "vertical") {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {navigationItems.map((item) => (
          <NavButton
            key={item.path}
            path={item.path}
            label={item.label}
            icon={item.icon}
            fullWidth
            onClick={onItemClick}
          />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 2 }}>
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