import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { styled, Box, CssBaseline, Divider, IconButton, Tooltip, CSSObject, Theme } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { MenuOpenRounded, MenuRounded } from '@mui/icons-material';
import { drawerClasses } from '@mui/material/Drawer';
import MuiDrawer from '@mui/material/Drawer';

import MenuContent from '@/pages/secure/Main/components/sideMenu/MenuContent';
import OptionsMenu from '@/pages/secure/Main/components/sideMenu/OptionsMenu';

const drawerWidth = 270;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(9)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(10)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme } : { theme: any }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== 'open',
})<{ open?: boolean }>(({ theme, open }) => ({
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    ...openedMixin(theme),
    '& .MuiDrawer-paper': openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    '& .MuiDrawer-paper': closedMixin(theme),
  }),
}));

export default function SideMenu() {
  const [open, setOpen] = useState(true);
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const logoSrc = colorScheme === 'dark' ? '/logo_white.png' : '/logo_dark.png';

  const toggleDrawer = () => {
    setOpen(prev => !prev);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Drawer
        variant="permanent"
        open={open}
        sx={{
          display: { xs: 'none', md: 'block' },
          [`& .${drawerClasses.paper}`]: { bgcolor: 'background.paper' },
        }}
      >
        <DrawerHeader
          sx={{
            justifyContent: 'center',
            // When collapsed, stack the expand toggle above the favicon so each
            // is horizontally centered in the narrow rail (a row would push
            // them to opposite edges).
            ...(open ? {} : {
              flexDirection: 'column-reverse',
              gap: 1.5,
              py: 2,
              height: 'auto',
              minHeight: 'auto',
            }),
          }}
        >
          {open ? (
            <Box
              sx={{
                mt: 'calc(var(--template-frame-height, 0px) + 4px)',
                width: '100%',
                p: 1.5,
                overflow: 'hidden'
              }}>
              <Box component="img" src={logoSrc} alt="Logo"
                sx={{
                  width: '10rem',
                  objectFit: 'contain',
                  transform: 'translateX(0)',
                  opacity: 1,
                  transition: 'transform 0.3s ease, opacity 0.3s ease',
                }} />
            </Box>
          ) : (
            <Box component="img" src="/favicon.png" alt="Logo"
              sx={{
                width: '2.25rem',
                height: '2.25rem',
                objectFit: 'contain',
                flexShrink: 0,
                transition: 'opacity 0.3s ease',
              }} />
          )}
          <IconButton
            onClick={toggleDrawer}
            sx={{
              justifyContent: 'center',
              border: 'none',
              transition: 'transform 0.3s ease',
              transform: open ? 'rotate(0deg)' : 'rotate(180deg)'
            }}
          >
            {open ? 
              <Tooltip title={t('sideMenu.toolTips.collapseMenu')} arrow>
                <MenuOpenRounded fontSize="small" />
              </Tooltip> : 
              <Tooltip title={t('sideMenu.toolTips.expandMenu')} arrow>
                <MenuRounded fontSize="small" />
              </Tooltip>
            }
          </IconButton>
        </DrawerHeader>


        <Divider />

        <Box
          sx={{
            overflow: 'auto',
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            // Nasconde le scrollbar
            '&::-webkit-scrollbar': {
              display: 'none',
            },
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}>
          <MenuContent collapsed={!open} />
        </Box>

        <OptionsMenu collapsed={!open} />

      </Drawer>
    </Box>
  );
}
