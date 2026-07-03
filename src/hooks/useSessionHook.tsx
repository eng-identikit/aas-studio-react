import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useCustomSnackbar } from '@/context/SnackbarContext';
import { useSessionContext } from '@/context/SessionContext';
import { useApiWrapper } from '@/api/apiWrapper';

import Session from "@/models/Session";

export const useSessionHook = () => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mySessions, setMySessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const { showSnackbar } = useCustomSnackbar();
  const { setOperator } = useSessionContext();
  const { get, post } = useApiWrapper();

  const listSocietySessions = async () => {
    setIsLoadingSessions(true);
    try {
      const response = await get('/v1/session/list');
      if (response.status === 'Success') {
        setSessions(response.data.sessions);
      } else {
        showSnackbar(response.message || t('session.listError'), 'error');
      }
    } catch (error: any) {
      console.error(error.response?.data?.message || t('common.texts.error'));
      showSnackbar(error.response?.data?.message || t('common.texts.error'), 'error');
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const disconnectOperator = async (operator_id: number) => {
    try {
      const response = await post('/v1/session/disconnect/operator', {
        operator_id: operator_id
      });
      if (response.status === 'Success') {
        // Rimuovi le sessioni dell'operator dalla lista
        setSessions((prevSessions) =>
          prevSessions.filter((session) => session.operator_id !== operator_id)
        );
        showSnackbar(response.message, 'success');
      } else {
        showSnackbar(response.message || t('session.disconnectOperatorError'), 'error');
      }
    } catch (error: any) {
      console.error(error.response?.data?.message || t('common.texts.error'));
      showSnackbar(error.response?.data?.message || t('common.texts.error'), 'error');
    }
  };

  const disconnectDevice = async (operator_id: number, session_id: string) => {
    try {
      const response = await post('/v1/session/disconnect/device', {
        operator_id: operator_id, 
        session_id: session_id
      });
      if (response.status === 'Success') {
        // Rimuovi la sessione dalle liste
        setSessions((prevSessions) =>
          prevSessions.filter((session) => session.session_id !== session_id)
        );
        setMySessions((prevSessions) =>
          prevSessions.filter((session) => session.session_id !== session_id)
        );
        showSnackbar(response.message, 'success');
      } else {
        showSnackbar(response.message || t('session.disconnectDeviceError'), 'error');
      }
    } catch (error: any) {
      console.error(error.response?.data?.message || t('common.texts.error'));
      showSnackbar(error.response?.data?.message || t('common.texts.error'), 'error');
    }
  };

  const logout = async () => {
    try {
      const response = await get('/v1/session/logout');
      if (response.status === 'Success') {
        showSnackbar(response.message || t('session.logoutSuccess'), 'success');
        // Annulla la sessione dal SessionContext (pulisce localStorage e stato globale)
        setOperator(null);
        return true;
      } else {
        showSnackbar(response.message || t('session.logoutError'), 'error');
        return false;
      }
    } catch (error: any) {
      console.error(error.response?.data?.message || t('common.texts.error'));
      showSnackbar(error.response?.data?.message || t('common.texts.error'), 'error');
      return false;
    }
  };

  return {
    sessions,
    mySessions,
    isLoadingSessions,
    listSocietySessions,
    disconnectOperator,
    disconnectDevice,
    logout
  };
};
