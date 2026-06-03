import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Grow, Box, Typography, Divider, Chip, useTheme, useMediaQuery } from '@mui/material';
import { CloseRounded, AutoAwesomeRounded, EmojiEventsRounded, TrendingUpRounded, GroupsRounded } from '@mui/icons-material';
import { useColorScheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AboutDialog({ open, onClose }: AboutDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { colorScheme } = useColorScheme();
  const logoSrc = colorScheme === 'dark' ? '/logo_white.png' : '/logo_dark.png';

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
      slots={{ transition: Grow }}
      slotProps={{ transition: { timeout: 300 } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <AutoAwesomeRounded sx={{ color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={700}>
            {t('main.dialogs.about.title')}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ border: 'none' }}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Hero section */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #6c63ff22 0%, #f50057111 100%)',
            borderRadius: 3,
            p: 3,
            mb: 3,
            textAlign: 'center',
          }}
        >
          <Box
            component="img"
            src={logoSrc}
            alt="AAS Studio"
            sx={{ height: 48, mb: 1, objectFit: 'contain' }}
          />
          <Typography variant="subtitle1" color="text.secondary">
            {t('main.dialogs.about.subtitle')}
          </Typography>
        </Box>

        {/* La storia */}
        <Typography variant="h6" fontWeight={700} gutterBottom>
          {t('main.dialogs.about.storyTitle')}
        </Typography>

        <Typography variant="body1" paragraph sx={{ lineHeight: 1.9 }}>
          {t('main.dialogs.about.story1')}
        </Typography>

        <Typography variant="body1" paragraph sx={{ lineHeight: 1.9 }}>
          {t('main.dialogs.about.story2')}
        </Typography>

        <Typography variant="body1" paragraph sx={{ lineHeight: 1.9 }}>
          {t('main.dialogs.about.story3')}
        </Typography>

        <Divider sx={{ my: 3 }} />

        {/* Milestone cards */}
        <Typography variant="h6" fontWeight={700} gutterBottom>
          {t('main.dialogs.about.milestonesTitle')}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: '1 1 200px', p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
            <EmojiEventsRounded color="primary" sx={{ mt: 0.3 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>{t('main.dialogs.about.milestone1Title')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('main.dialogs.about.milestone1Desc')}</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: '1 1 200px', p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
            <TrendingUpRounded color="success" sx={{ mt: 0.3 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>{t('main.dialogs.about.milestone2Title')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('main.dialogs.about.milestone2Desc')}</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: '1 1 200px', p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
            <GroupsRounded color="secondary" sx={{ mt: 0.3 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>{t('main.dialogs.about.milestone3Title')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('main.dialogs.about.milestone3Desc')}</Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Stats */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
          <Chip
            label={t('main.dialogs.about.stat1')}
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 700, fontSize: '0.85rem', px: 1 }}
          />
          <Chip
            label={t('main.dialogs.about.stat2')}
            color="success"
            variant="outlined"
            sx={{ fontWeight: 700, fontSize: '0.85rem', px: 1 }}
          />
          <Chip
            label={t('main.dialogs.about.stat3')}
            color="secondary"
            variant="outlined"
            sx={{ fontWeight: 700, fontSize: '0.85rem', px: 1 }}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          {t('common.buttons.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
