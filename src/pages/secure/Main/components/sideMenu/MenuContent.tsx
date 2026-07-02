import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
  Box, Divider, List, ListItem, ListItemText,
  ListItemButton, ListItemIcon, Stack, Tooltip,
} from '@mui/material';
import {
  SpaceDashboardRounded,
  AccountTreeRounded,
  TimelineRounded,
  DnsRounded,
  InfoRounded,
  HelpRounded,
  CheckCircleOutlineRounded,
  AddBoxRounded,
  AutoFixHighRounded,
  CodeRounded,
  HistoryRounded,
  SettingsRounded,
  LanRounded,
  FileDownloadRounded,
} from '@mui/icons-material';

import { useDialogContext } from '@/context/DialogContext';

export default function MenuContent({ collapsed, onItemClick }: { collapsed: boolean; onItemClick?: () => void }) {
  const [selected, setSelected] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { handlers } = useDialogContext();

  const mainListItems = [
    {
      text: 'dashboard',
      icon: (
        <Tooltip title={t('sideMenu.menuContent.toolTips.dashboard', 'Dashboard')} arrow>
          <SpaceDashboardRounded />
        </Tooltip>
      ),
      path: '/dashboard',
    },
    {
      text: 'aasEditor',
      icon: (
        <Tooltip title={t('sideMenu.menuContent.toolTips.aasEditor', 'AAS Editor')} arrow>
          <AccountTreeRounded />
        </Tooltip>
      ),
      path: '/editor',
    },
    {
      text: 'aasLifecycle',
      icon: (
        <Tooltip title={t('sideMenu.menuContent.toolTips.aasLifecycle', 'AAS Lifecycle')} arrow>
          <TimelineRounded />
        </Tooltip>
      ),
      path: '/lifecycle',
    },
    {
      text: 'aasServer',
      icon: (
        <Tooltip title={t('sideMenu.menuContent.toolTips.aasServer', 'Server Generator')} arrow>
          <DnsRounded />
        </Tooltip>
      ),
      path: '/server',
    },
  ];

  const secondaryListItems = useMemo(() => {
    const currentPath = location.pathname;

    if (currentPath === '/dashboard') {
      return [
        {
          text: 'about',
          icon: (
            <Tooltip title={t('sideMenu.menuContent.toolTips.about', 'About')} arrow>
              <InfoRounded />
            </Tooltip>
          ),
          path: null,
          action: () => handlers.onShowAbout?.(),
        },
        {
          text: 'feedback',
          icon: (
            <Tooltip title={t('sideMenu.menuContent.toolTips.feedback', 'Feedback')} arrow>
              <HelpRounded />
            </Tooltip>
          ),
          path: null,
          action: () => {},
        },
      ];
    }

    if (currentPath === '/editor') {
      return [
        {
          text: 'connectServer',
          icon: (
            <Tooltip title={t('sideMenu.menuContent.toolTips.connectServer', 'Connetti AASX')} arrow>
              <LanRounded />
            </Tooltip>
          ),
          path: null,
          action: () => handlers.onConnectServer?.(),
        },
        {
          text: 'validateAAS',
          icon: (
            <Tooltip title={t('sideMenu.menuContent.toolTips.validateAAS', 'Valida AAS')} arrow>
              <CheckCircleOutlineRounded />
            </Tooltip>
          ),
          path: null,
          action: () => handlers.onValidateAAS?.(),
        },
        {
          text: 'exportAASX',
          icon: (
            <Tooltip title={t('sideMenu.menuContent.toolTips.exportAASX', 'Esporta AASX')} arrow>
              <FileDownloadRounded />
            </Tooltip>
          ),
          path: null,
          action: () => handlers.onExportAASX?.(),
        },
        {
          text: 'addEntity',
          icon: (
            <Tooltip title={t('sideMenu.menuContent.toolTips.addEntity', 'Nuovo modello AAS')} arrow>
              <AddBoxRounded />
            </Tooltip>
          ),
          path: null,
          action: () => handlers.onAddEntity?.(),
        },
      ];
    }

    if (currentPath === '/lifecycle') {
      return [
        {
          text: 'exportChangelog',
          icon: (
            <Tooltip title={t('sideMenu.menuContent.toolTips.exportChangelog', 'Esporta Changelog')} arrow>
              <HistoryRounded />
            </Tooltip>
          ),
          path: null,
          action: () => handlers.onExportChangelog?.(),
        },
      ];
    }

    if (currentPath === '/server') {
      return [
        {
          text: 'generateServer',
          icon: (
            <Tooltip title={t('sideMenu.menuContent.toolTips.generateServer', 'Genera Server')} arrow>
              <AutoFixHighRounded />
            </Tooltip>
          ),
          path: null,
          action: () => handlers.onGenerateServer?.(),
        },
        {
          text: 'downloadCode',
          icon: (
            <Tooltip title={t('sideMenu.menuContent.toolTips.downloadCode', 'Scarica Codice')} arrow>
              <CodeRounded />
            </Tooltip>
          ),
          path: null,
          action: () => handlers.onDownloadServer?.(),
        },
      ];
    }

    if (currentPath === '/profile') {
      return [
        {
          text: 'settings',
          icon: (
            <Tooltip title={t('sideMenu.menuContent.toolTips.settings', 'Impostazioni')} arrow>
              <SettingsRounded />
            </Tooltip>
          ),
          path: null,
          action: () => handlers.onShowSettings?.(),
        },
      ];
    }

    return [];
  }, [location.pathname, t, handlers]);

  interface MenuItem {
    text: string;
    icon: React.ReactNode;
    path: string | null;
    action?: () => void;
  }

  useEffect(() => {
    const currentPath = location.pathname;
    const mi = mainListItems.findIndex(item => item.path === currentPath);
    if (mi > -1) {
      setSelected(`main-${mi}`);
    }
  }, [location.pathname]);

  const renderGroup = (items: MenuItem[], group: string) => (
    <List dense>
      {items.map((item, index) => {
        const key = `${group}-${index}`;
        const isSelected = selected === key;

        const handleItemClick = () => {
          if (group === 'main') {
            setSelected(key);
            if (item.path) {
              navigate(item.path);
            }
          } else if (group === 'secondary') {
            item.action?.();
          }
          onItemClick?.();
        };

        return (
          <ListItem
            key={key}
            disablePadding
            sx={{
              // Collapsed: center the fixed-width button in the rail (the global
              // MuiListItemButton `margin: 2px 6px` left-shifts it in a block).
              display: collapsed ? 'flex' : 'block',
              ...(collapsed && { justifyContent: 'center' }),
              ...(!collapsed && {
                '&:hover': { transform: 'scale(1.05)' },
                transition: 'transform 0.2s ease',
              }),
            }}
          >
            {!collapsed ? (
              <ListItemButton onClick={handleItemClick} selected={isSelected}>
                <ListItemIcon
                  sx={{
                    transition: 'transform 0.2s ease',
                    '.MuiListItemButton-root:hover &': { transform: 'scale(1.3)' },
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={t(`sideMenu.menuContent.${item.text}`, item.text)}
                  primaryTypographyProps={{ noWrap: true }}
                  sx={{ pt: '5px' }}
                />
              </ListItemButton>
            ) : (
              <ListItemButton
                onClick={handleItemClick}
                selected={isSelected}
                sx={{
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  mx: 0,             // override global MuiListItemButton margin
                  my: '2px',
                  p: 0,
                  '& .MuiSvgIcon-root': { width: '1.5rem', height: '1.5rem' },
                  transition: 'transform 0.2s ease',
                  '&:hover': { transform: 'scale(1.05)' },
                }}
              >
                {item.icon}
              </ListItemButton>
            )}
          </ListItem>
        );
      })}
    </List>
  );

  return (
    <Stack sx={{ flexGrow: 1, p: 1 }}>
      {renderGroup(mainListItems, 'main')}
      <Box sx={{ flexGrow: 1 }} />
      {secondaryListItems.length > 0 && <Divider />}
      {renderGroup(secondaryListItems, 'secondary')}
    </Stack>
  );
}
