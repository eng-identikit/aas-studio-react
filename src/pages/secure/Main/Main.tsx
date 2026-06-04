import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { alpha } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { brand, violet } from '@/theme/themePrimitives';

import NavbarMobile from '@/pages/secure/Main/components/header/NavbarMobile';
import Header from '@/pages/secure/Main/components/header/Header';
import SideMenu from '@/pages/secure/Main/components/sideMenu/SideMenu';

import { DialogProvider } from '@/context/DialogContext';

import type { } from '@mui/x-date-pickers/themeAugmentation';
import type { } from '@mui/x-charts/themeAugmentation';
import type { } from '@mui/x-tree-view/themeAugmentation';

import AppTheme from '@/theme/AppTheme';
import { chartsCustomizations, dataGridCustomizations, datePickersCustomizations, treeViewCustomizations } from '@/pages/secure/Main/theme/customizations';

import { isMobile } from '@/utils/utils';

const xThemeComponents = {
  ...chartsCustomizations,
  ...dataGridCustomizations,
  ...datePickersCustomizations,
  ...treeViewCustomizations,
};

interface MainProps {
  children: ReactNode;
}

const Main = ({ children }: MainProps) => {
  const location = useLocation();

  // Controlla se siamo nella pagina calendar
  const isCalendarPage = location.pathname === '/calendar';
  const isEditorPage = location.pathname === '/editor';

  return (
    <DialogProvider>
      <AppTheme themeComponents={xThemeComponents}>
        <CssBaseline enableColorScheme />
        <Box
          sx={{
            display: 'flex',
            height: '100vh',
            overflow: 'hidden', // Evita overflow orizzontale
            width: '100%', // Assicura che il layout occupi tutta la larghezza disponibile
          }}
        >
          {/* SideMenu */}
          <SideMenu />
          <NavbarMobile />
          {/* Contenuto principale */}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              width: '100%',
              position: 'relative',
              backgroundColor: (theme: any) =>
                theme.vars
                  ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
                  : alpha(theme.palette.background.default, 1),
              '&::before': {
                content: '""',
                position: 'fixed',
                top: 0,
                right: 0,
                width: '55%',
                height: '45%',
                background: `radial-gradient(ellipse at 80% 10%, ${alpha(brand[300], 0.055)} 0%, transparent 65%)`,
                pointerEvents: 'none',
                zIndex: 0,
              },
              '&::after': {
                content: '""',
                position: 'fixed',
                bottom: 0,
                left: '15%',
                width: '50%',
                height: '40%',
                background: `radial-gradient(ellipse at 30% 90%, ${alpha(violet[400], 0.04)} 0%, transparent 60%)`,
                pointerEvents: 'none',
                zIndex: 0,
              },
            }}
          >
            {/* Header fisso */}
            <Box
              sx={(theme: any) => ({
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: theme.vars
                  ? `rgba(${theme.vars.palette.background.defaultChannel} / 0.88)`
                  : alpha(theme.palette.background.default, 0.88),
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderBottom: `1px solid ${alpha(brand[300], 0.1)}`,
                width: '100%',
                padding: '16px',
                [theme.breakpoints.down('md')]: {
                  pt: '64px',
                },
                boxSizing: 'border-box',
                ...theme.applyStyles('dark', {
                  borderBottom: `1px solid ${alpha(brand[400], 0.07)}`,
                }),
              })}
            >
              <Header />
            </Box>

            {/* Contenuto scrollabile */}
            <Box
              sx={{
                flexGrow: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflowY: (isCalendarPage || isEditorPage) && !isMobile() ? 'hidden' : 'auto',
                overflowX: 'hidden',
                px: isEditorPage ? 0 : 2,
                pb: isEditorPage ? 0 : 2,
                boxSizing: 'border-box',
              }}
            >
              {children}
            </Box>
          </Box>
        </Box>
      </AppTheme>
    </DialogProvider>
  );
};

export default Main;