import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Typography, Box, Grow } from '@mui/material';
import { CloseRounded, DeleteRounded, WarningRounded } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ConfirmDeleteReferralDialogProps {
  open: boolean;
  email: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDeleteReferralDialog({ open, email, onConfirm, onClose }: ConfirmDeleteReferralDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slots={{ transition: Grow }}
      slotProps={{ transition: { timeout: 250 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <WarningRounded sx={{ color: 'error.main' }} />
        <Typography variant="h6" fontWeight={700}>
          {t('main.dialogs.referrals.confirmDelete.title')}
        </Typography>
        <Box flexGrow={1} />
        <IconButton size="small" onClick={onClose}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {t('main.dialogs.referrals.confirmDelete.message')}
        </Typography>
        <Box
          sx={{
            mt: 2,
            px: 2,
            py: 1.5,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #ff980022 0%, #ffd54f22 100%)',
            border: '1px solid',
            borderColor: 'warning.light',
          }}
        >
          <Typography variant="body2" fontWeight={700} color="text.secondary" noWrap>
            {email}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" size="small">
          {t('common.buttons.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          size="small"
          startIcon={<DeleteRounded />}
        >
          {t('main.dialogs.referrals.confirmDelete.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
