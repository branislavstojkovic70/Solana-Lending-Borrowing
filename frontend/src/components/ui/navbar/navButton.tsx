import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";

interface NavButtonProps {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export const NavButton: React.FC<NavButtonProps> = ({ path, label, icon }) => {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Button
      onClick={() => navigate(path)}
      startIcon={icon}
      sx={{
        textTransform: "none",
        color: theme.palette.primary.contrastText,
        fontSize: "16px",
        fontWeight: 500,
        px: 2,
        py: 1,
        borderRadius: "8px",
        transition: "all 0.2s",
        "&:hover": {
          backgroundColor: theme.palette.action.hover,
          transform: "translateY(-2px)",
        },
      }}
    >
      {label}
    </Button>
  );
};