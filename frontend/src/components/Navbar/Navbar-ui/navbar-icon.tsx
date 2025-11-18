import { Box } from "@mui/material";

interface NavbarIconProps {
  iconUrl: string;
  alt: string;
  size?: number;
}

export const NavbarIcon: React.FC<NavbarIconProps> = ({ 
  iconUrl, 
  alt, 
  size = 32 
}) => {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: "background.paper",
      }}
    >
      <img
        src={iconUrl}
        alt={alt}
        style={{
          width: size - 4,
          height: size - 4,
          objectFit: "contain",
        }}
      />
    </Box>
  );
};