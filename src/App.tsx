import { BrowserRouter } from 'react-router-dom';
import { SessionProvider } from '@/context/SessionContext';
import { CustomSnackbarProvider } from '@/context/SnackbarContext';
import { OperatorPreferencesProvider } from '@/context/OperatorPreferencesContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { AASProvider } from '@/context/AASContext';
import { GatewayProvider } from '@/context/GatewayContext';

import Router from '@/routes/Router';
import '@/i18n/config';

const App = () => {
  return (
    <SessionProvider>
      <OperatorPreferencesProvider>
        <CustomSnackbarProvider>
          <NotificationProvider>
            <AASProvider>
            <GatewayProvider>
            <BrowserRouter>
              <Router />
            </BrowserRouter>
            </GatewayProvider>
            </AASProvider>
          </NotificationProvider>
        </CustomSnackbarProvider>
      </OperatorPreferencesProvider>
    </SessionProvider>
  );
};

export default App;
