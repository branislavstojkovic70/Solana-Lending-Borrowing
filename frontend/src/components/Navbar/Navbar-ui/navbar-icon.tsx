import { Box } from "@mui/material";

interface NavbarIconProps {
  iconUrl: string;  
  alt: string;
  size?: number;
  borderRadius?: string | number;
  backgroundColor?: string;
  onClick?: () => void;
}

export const NavbarIcon: React.FC<NavbarIconProps> = ({ 
  iconUrl,
  alt, 
  size = 32,
  borderRadius = "50%",
  backgroundColor = "background.paper",
  onClick
}) => {
  return (
    <Box
      onClick={onClick}
      sx={{
        width: size,
        height: size,
        borderRadius,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <img
        src={iconUrl}  
        alt={alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: "contain",
        }}
      />
    </Box>
  );
};