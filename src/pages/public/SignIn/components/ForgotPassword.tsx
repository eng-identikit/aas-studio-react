import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormHelperText, Grow, IconButton, OutlinedInput, useMediaQuery, useTheme } from '@mui/material';
import { CloseRounded, MedicalServicesRounded } from '@mui/icons-material';

import { useApiWrapper } from '@/api/apiWrapper';
import { useCustomSnackbar } from '@/context/SnackbarContext';

interface ForgotPasswordProps {
  open: boolean;
  onSubmit: (data: { email: string; token: string; password: string }) => void;
  onClose: () => void;
}

export default function ForgotPassword({ open, onSubmit, onClose }: ForgotPasswordProps) {
  const { t } = useTranslation();
  const { post } = useApiWrapper();
  const { showSnackbar } = useCustomSnackbar();

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [step, setStep] = useState<'email' | 'recovery'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    // Reset dello stato quando si chiude il dialog
    setStep('email');
    setEmail('');
    setToken('');
    setPassword('');
    setConfirmPassword('');
    setErrors({});
    setIsLoading(false);
    onClose();
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (step === 'email') {
      // Validazione email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim()) {
        errs.email = t('forgotPassword.emailRequired');
      } else if (!emailRegex.test(email.trim())) {
        errs.email = t('forgotPassword.emailInvalid');
      }
    } else {
      // Validazione token
      const tokenRegex = /^[a-zA-Z0-9]{10}$/;
      if (!token.trim()) {
        errs.token = t('forgotPassword.tokenRequired');
      } else if (!tokenRegex.test(token.trim())) {
        errs.token = t('forgotPassword.tokenFormat');
      }

      // Validazione password
      const passwordRegex = /^[a-zA-Z0-9_?!@#$%^&]*$/;
      const hasNumberOrSpecial = /[0-9_?!@#$%^&]/.test(password);

      if (!password.trim()) {
        errs.password = t('forgotPassword.passwordRequired');
      } else if (!passwordRegex.test(password.trim())) {
        errs.password = t('forgotPassword.passwordCharset');
      } else if (!hasNumberOrSpecial) {
        errs.password = t('forgotPassword.passwordStrength');
      }

      // Validazione conferma password
      if (!confirmPassword.trim()) {
        errs.confirmPassword = t('forgotPassword.confirmRequired');
      } else if (password !== confirmPassword) {
        errs.confirmPassword = t('forgotPassword.passwordsMismatch');
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStep = async () => {
    if (!validate()) {
      return;
    }

    if (step === 'email') {
      setIsLoading(true);
      try {
        const response = await post('/v1/forget', {
          email: email
        });
        if (response.statusCode == 200) {
          // Passa al secondo step
          showSnackbar(t('forgotPassword.emailSent'), 'success');
          setStep('recovery');
          setErrors({}); // Reset errori quando si passa al secondo step
        } else {
          // Mostra un messaggio di errore
          console.error(response.data.message);
          showSnackbar(response.data.message || t('common.texts.error'), 'error');
        }
      } catch (error: any) {
        // Gestione degli errori
        console.error(error.response?.data?.message || t('common.texts.error'));
        showSnackbar(error.response?.data?.message || t('common.texts.error'), 'error');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Invia i dati per il recupero
      onSubmit({
        email,
        token,
        password
      });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={(_: any, reason: string) => {
        if (reason !== 'backdropClick') {
          handleClose();
        }
      }}
      maxWidth="xs"
      slots={{
        transition: Grow,
      }}
      slotProps={{
        transition: {
          timeout: 300,
        },
      }}
    >
      <DialogTitle
        id="alert-dialog-title"
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Box display="flex" alignItems="center">
          <MedicalServicesRounded sx={{ mr: 1 }} />
          {t('forgotPassword.title')}
        </Box>
        <IconButton
          size="small"
          onClick={handleClose}
          sx={{
            justifyContent: 'center',
            border: 'none'
          }}
        >
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {step === 'email' ? (
          <>
            <DialogContentText>
              {t('forgotPassword.emailIntro')}
            </DialogContentText>
            <Box>
              <OutlinedInput
                autoFocus
                required
                margin="dense"
                id="email"
                name="email"
                placeholder={t('forgotPassword.emailPlaceholder')}
                type="email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!errors.email}
              />
              {errors.email && (
                <FormHelperText error sx={{ ml: 0 }}>
                  {errors.email}
                </FormHelperText>
              )}
            </Box>
          </>
        ) : (
          <>
            <DialogContentText>
              {t('forgotPassword.recoveryIntro')}
            </DialogContentText>
            <OutlinedInput
              disabled
              margin="dense"
              id="email-disabled"
              name="email"
              placeholder={t('forgotPassword.emailPlaceholder')}
              type="email"
              fullWidth
              value={email}
              sx={{ mb: 2 }}
            />
            <Box sx={{ mb: 2 }}>
              <OutlinedInput
                autoFocus
                required
                margin="dense"
                id="token"
                name="token"
                placeholder={t('forgotPassword.tokenPlaceholder')}
                type="text"
                fullWidth
                value={token}
                onChange={(e) => setToken(e.target.value)}
                error={!!errors.token}
              />
              {errors.token && (
                <FormHelperText error sx={{ ml: 0 }}>
                  {errors.token}
                </FormHelperText>
              )}
            </Box>
            <Box sx={{ mb: 2 }}>
              <OutlinedInput
                required
                margin="dense"
                id="password"
                name="password"
                placeholder={t('forgotPassword.newPasswordPlaceholder')}
                type="password"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={!!errors.password}
              />
              {errors.password && (
                <FormHelperText error sx={{ ml: 0 }}>
                  {errors.password}
                </FormHelperText>
              )}
            </Box>
            <Box>
              <OutlinedInput
                required
                margin="dense"
                id="confirm-password"
                name="confirmPassword"
                placeholder={t('forgotPassword.confirmPasswordPlaceholder')}
                type="password"
                fullWidth
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={!!errors.confirmPassword}
              />
              {errors.confirmPassword && (
                <FormHelperText error sx={{ ml: 0 }}>
                  {errors.confirmPassword}
                </FormHelperText>
              )}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={fullScreen ? { flexDirection: 'column', gap: 1 } : undefined}>
        <Button
          onClick={handleClose}
          fullWidth={fullScreen}
          disabled={isLoading}
        >
          {t('common.buttons.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleStep}
          fullWidth={fullScreen}
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {isLoading ? t('forgotPassword.loading') : (step === 'email' ? t('common.buttons.continue') : t('forgotPassword.recover'))}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
