import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Box, Button, Checkbox, CssBaseline, FormControlLabel, FormLabel, FormControl, Link, TextField, Typography, Stack, Card as MuiCard, InputAdornment, IconButton } from '@mui/material';
import { VisibilityRounded, VisibilityOffRounded } from '@mui/icons-material';
import { styled, useColorScheme } from '@mui/material/styles';

import ColorModeSelect from '@/pages/public/SignIn/components/ColorModeSelect';
import ForgotPassword from '@/pages/public/SignIn/components/ForgotPassword';

import { useSessionContext } from '@/context/SessionContext';
import { useCustomSnackbar } from '@/context/SnackbarContext';

import { useApiWrapper } from '@/api/apiWrapper';
import AppTheme from '@/theme/AppTheme';

const Card = styled(MuiCard)(({ theme }: { theme: any }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignSelf: 'center',
  width: '100%',
  padding: theme.spacing(4),
  gap: theme.spacing(2),
  margin: 'auto',
  [theme.breakpoints.up('sm')]: {
    maxWidth: '450px',
  },
  borderRadius: 20,
  border: '1.5px solid transparent',
  backgroundImage: 'linear-gradient(hsl(0, 0%, 100%), hsl(0, 0%, 100%)), linear-gradient(135deg, hsl(210, 98%, 75%), hsl(265, 75%, 70%))',
  backgroundOrigin: 'padding-box, border-box',
  backgroundClip: 'padding-box, border-box',
  backgroundColor: 'transparent',
  boxShadow: 'hsla(210, 40%, 30%, 0.08) 0px 8px 32px 0px, hsla(210, 60%, 20%, 0.06) 0px 24px 56px -8px',
  ...theme.applyStyles('dark', {
    backgroundImage: 'linear-gradient(hsl(220, 30%, 9%), hsl(220, 30%, 9%)), linear-gradient(135deg, hsl(210, 70%, 40%), hsl(265, 55%, 45%))',
    backgroundOrigin: 'padding-box, border-box',
    backgroundClip: 'padding-box, border-box',
    boxShadow: 'hsla(220, 30%, 5%, 0.7) 0px 8px 32px 0px, hsla(210, 60%, 20%, 0.4) 0px 24px 56px -8px',
  }),
}));

const SignInContainer = styled(Stack)(({ theme }: { theme: any }) => ({
  height: 'calc((1 - var(--template-frame-height, 0)) * 100dvh)',
  minHeight: '100%',
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(4),
  },
  '&::before': {
    content: '""',
    display: 'block',
    position: 'absolute',
    zIndex: -1,
    inset: 0,
    backgroundImage:
      'radial-gradient(ellipse at 20% 30%, hsl(210, 100%, 93%) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, hsl(270, 80%, 93%) 0%, transparent 45%), hsl(0, 0%, 100%)',
    backgroundRepeat: 'no-repeat',
    ...theme.applyStyles('dark', {
      backgroundImage:
        'radial-gradient(ellipse at 15% 25%, hsla(210, 100%, 14%, 0.7) 0%, transparent 55%), radial-gradient(ellipse at 85% 75%, hsla(265, 60%, 12%, 0.6) 0%, transparent 50%), hsl(220, 35%, 3%)',
    }),
  },
}));

export default function SignIn(props: { disableCustomTheme?: boolean }) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const logoSrc = colorScheme === 'dark' ? '/logo_white.png' : '/logo_dark.png';
  const [emailError, setEmailError] = useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const { post } = useApiWrapper();
  const { showSnackbar } = useCustomSnackbar();

  const { operator, setOperator } = useSessionContext();

  useEffect(() => {
    if (operator.auth_token) {
      navigate('/dashboard', { replace: true });
    }
  }, [operator.auth_token, navigate]);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (emailError || passwordError) {
      return;
    }
    const data = new FormData(event.currentTarget);

    const formData = {
      email: data.get('email'),
      password: data.get('password'),
    };

    try {
      const response = await post('/v1/auth/login', formData);

      if (response.statusCode === 200 && response.data) {
        const d = response.data as any;
        setOperator({
          operator_id: d.operator_id,
          name: d.name,
          surname: d.surname,
          picture: d.picture || '/profile.png',
          email: d.email,
          session_id: d.session_id,
          auth_token: d.auth_token,
        });
      } else {
        showSnackbar(response.message || t('signIn.loginFailed'), 'error');
      }
    } catch (error: any) {
      console.error(error.response?.data?.message || t('common.texts.error'));
      showSnackbar(error.response?.data?.message || t('common.texts.error'), 'error');
    }
  };

  const validateInputs = () => {
    const email = document.getElementById('email') as HTMLInputElement;
    const password = document.getElementById('password') as HTMLInputElement;

    let isValid = true;

    if (!email.value || !/\S+@\S+\.\S+/.test(email.value)) {
      setEmailError(true);
      setEmailErrorMessage(t('signIn.emailInvalid'));
      isValid = false;
    } else {
      setEmailError(false);
      setEmailErrorMessage('');
    }

    if (!password.value || password.value.length < 6) {
      setPasswordError(true);
      setPasswordErrorMessage(t('signIn.passwordTooShort'));
      isValid = false;
    } else {
      setPasswordError(false);
      setPasswordErrorMessage('');
    }

    return isValid;
  };

  const handleRecover = async (data: { email: string; token: string; password: string }) => {
    try {
      const response = await post('/v1/recover', data);
      if (response.statusCode == 200) {
        showSnackbar(t('signIn.resetSuccess'), 'success');
      } else {
        showSnackbar(response.data.message || t('signIn.resetFailed'), 'error');
      }
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || t('common.texts.error'), 'error');
    } finally {
      setOpen(false);
    }
  };

  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />
      <SignInContainer direction="column" justifyContent="space-between">
        <ColorModeSelect sx={{ position: 'fixed', top: '1rem', right: '1rem' }} />
        <Card variant="outlined">
          <Box component="img" src={logoSrc} alt="Logo"
            sx={{
              display: 'flex',
              justifyContent: 'left',
              alignItems: 'center',
              width: '15rem',
              objectFit: 'contain',
            }}
          />
          <Typography
            component="h1"
            variant="h4"
            sx={{ width: '100%', fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}
          >
            {t('signIn.title')}
          </Typography>
          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              gap: 2,
            }}
          >
            <FormControl>
              <FormLabel htmlFor="email">{t('signIn.emailLabel')}</FormLabel>
              <TextField
                error={emailError}
                helperText={emailErrorMessage}
                id="email"
                type="email"
                name="email"
                placeholder="your@email.com"
                autoComplete="email"
                autoFocus
                required
                fullWidth
                variant="outlined"
                color={emailError ? 'error' : 'primary'}
              />
              <FormControl>
                <FormLabel htmlFor="password">{t('signIn.passwordLabel')}</FormLabel>
                <TextField
                  error={passwordError}
                  helperText={passwordErrorMessage}
                  name="password"
                  placeholder="••••••"
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  required
                  fullWidth
                  variant="outlined"
                  color={passwordError ? 'error' : 'primary'}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onMouseDown={() => setShowPassword(true)}
                            onMouseUp={() => setShowPassword(false)}
                            onMouseLeave={() => setShowPassword(false)}
                            onTouchStart={() => setShowPassword(true)}
                            onTouchEnd={() => setShowPassword(false)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </FormControl>
            </FormControl>
            <FormControlLabel
              control={<Checkbox value="remember" color="primary" />}
              label={t('signIn.rememberMe')}
            />
            <ForgotPassword
              open={open}
              onSubmit={handleRecover}
              onClose={handleClose}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              onClick={validateInputs}
            >
              {t('signIn.submit')}
            </Button>
            <Link
              component="button"
              type="button"
              onClick={handleClickOpen}
              variant="body2"
              sx={{ alignSelf: 'center' }}
            >
              {t('signIn.forgotPassword')}
            </Link>
          </Box>
        </Card>
      </SignInContainer>
    </AppTheme>
  );
}