import { useState } from 'react';
import { AppBar, Box, Stack, Toolbar } from '@mui/material';
import { MenuRounded } from '@mui/icons-material';
import { styled, useColorScheme } from '@mui/material/styles';

import MenuButton from '@/pages/secure/Main/components/header/MenuButton';
import SideMenuMobile from '@/pages/secure/Main/components/sideMenu/SideMenuMobile';
import ColorModeIconDropdown from '@/pages/secure/Main/components/header/ColorModeIconDropdown';
import LanguageIconDropdown from '@/pages/secure/Main/components/header/LanguageIconDropdown';

const MuiToolbar = styled(Toolbar)({
  width: '100%',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'start',
  justifyContent: 'center',
  gap: '12px',
  flexShrink: 0
});

export default function NavbarMobile() {
  const [open, setOpen] = useState(false);
  const { colorScheme } = useColorScheme();
  const logoSrc = colorScheme === 'dark' ? '/logo_white.png' : '/logo_dark.png';

  const toggleDrawer = () => {
    setOpen((prev) => !prev);
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        display: { xs: 'auto', md: 'none' },
        boxShadow: 0,
        bgcolor: 'background.paper',
        backgroundImage: 'none',
        borderBottom: '1px solid',
        borderColor: 'divider',
        top: 'var(--template-frame-height, 0px)',
      }}
    >
      <MuiToolbar variant="regular">
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            flexGrow: 1,
            width: '100%',
            gap: 1,
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: 'center', mr: 'auto' }}
          >
            <Box
              component="img"
              src={logoSrc}
              alt="Logo"
              sx={{
                width: '10rem',
                objectFit: 'contain',
              }}
            />
          </Stack>
          <LanguageIconDropdown />
          <ColorModeIconDropdown />
          <MenuButton aria-label="menu" onClick={toggleDrawer}>
            <MenuRounded />
          </MenuButton>
          <SideMenuMobile open={open} toggleDrawer={toggleDrawer} />
        </Stack>
      </MuiToolbar>
    </AppBar>
  );
}
