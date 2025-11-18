import { Box, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";

interface NavbarLogoProps {
  logoUrl?: string;
  appName?: string;
  logoSize?: number;
}

export const NavbarLogo: React.FC<NavbarLogoProps> = ({ 
  logoUrl = "/logo.png", 
  appName = "Lending Protocol",
  logoSize = 50
}) => {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Box
      onClick={() => navigate("/")}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        cursor: "pointer",
        transition: "transform 0.2s",
        "&:hover": { transform: "scale(1.05)" },
      }}
    >
      <img
        src={logoUrl}
        alt="Logo"
        style={{
          width: `${logoSize}px`,
          height: `${logoSize}px`,
          objectFit: "contain",
        }}
      />
      <Typography
        variant="h1"
        sx={{
          fontSize: "26px",
          fontWeight: 700,
          color: theme.palette.primary.contrastText,
          letterSpacing: "-0.5px",
        }}
      >
        {appName}
      </Typography>
    </Box>
  );
};