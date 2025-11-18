import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";

interface NavButtonProps {
  path: string;
  label: string;
  icon: React.ReactNode;
  fullWidth?: boolean;
  onClick?: () => void;
}

export const NavButton: React.FC<NavButtonProps> = ({ 
  path, 
  label, 
  icon,
  fullWidth = false,
  onClick 
}) => {
  const navigate = useNavigate();
  const theme = useTheme();

  const handleClick = () => {
    navigate(path);
    onClick?.();
  };

  return (
    <Button
      onClick={handleClick}
      startIcon={icon}
      fullWidth={fullWidth}
      sx={{
        textTransform: "none",
        color: theme.palette.primary.contrastText,
        fontSize: "16px",
        fontWeight: 500,
        px: 2,
        py: 1,
        borderRadius: "8px",
        transition: "all 0.2s",
        justifyContent: fullWidth ? "flex-start" : "center", // 👈 Levo poravnanje za fullWidth
        textAlign: "left", // 👈 Tekst poravnat na levo
        "&:hover": {
          backgroundColor: theme.palette.action.hover,
          transform: fullWidth ? "translateX(4px)" : "translateY(-2px)", // 👈 Horizontalni hover za mobile
        },
        // 👇 Dodaj margin za bolji spacing u mobile meniju
        ...(fullWidth && {
          my: 0.5,
        })
      }}
    >
      {label}
    </Button>
  );
};