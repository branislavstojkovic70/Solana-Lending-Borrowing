import { IconButton } from "@mui/material";
import { Menu } from "@mui/icons-material";

interface HamburgerMenuProps {
  onClick: () => void;
  color?: string;
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ 
  onClick, 
  color = "inherit" 
}) => {
  return (
    <IconButton
      onClick={onClick}
      sx={{
        color,
        "&:hover": {
          backgroundColor: "rgba(255, 255, 255, 0.1)",
        },
      }}
    >
      <Menu />
    </IconButton>
  );
};