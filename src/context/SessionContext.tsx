import { createContext, useState, useContext, ReactNode } from 'react';
import Operator from '@/models/Operator';
import { setAccessToken } from '@/api/tokenStore';

interface SessionContextProps {
  operator: Operator;
  setOperator: (operator: Operator | null) => void;
}

const SessionContext = createContext<SessionContextProps>({
  operator: {
    operator_id: -1,
    name: '', 
    surname: '', 
    picture: '',
    email: '', 
    session_id: '', 
    auth_token: ''
  },
  setOperator: () => {},
});

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [operator, setOperatorState] = useState<Operator>(() => ({
    operator_id: parseInt(localStorage.getItem('operator_id') || '-1', 10),
      name: localStorage.getItem('name') || '',
      surname: localStorage.getItem('surname') || '',
      email: localStorage.getItem('email') || '',
      picture: localStorage.getItem('picture') || '',
    session_id: localStorage.getItem('session_id') || '',
    auth_token: localStorage.getItem('auth_token') || ''
  }));

  const setOperator = (operator: Operator | null) => {
    if (operator) {
      localStorage.setItem('operator_id', operator.operator_id.toString());
      localStorage.setItem('session_id', operator.session_id || '');
      localStorage.setItem('auth_token', operator.auth_token || '');
      localStorage.setItem('name', operator.name || '');
      localStorage.setItem('surname', operator.surname || '');
      localStorage.setItem('email', operator.email || '');
      localStorage.setItem('picture', operator.picture || '/profile.png');
      setAccessToken(operator.auth_token || '');
      setOperatorState(operator);
    } else {
      ['operator_id','session_id','auth_token','name','surname','email','picture'].forEach(k => localStorage.removeItem(k));
      setAccessToken('');
      setOperatorState({
        operator_id: -1, session_id: '', auth_token: '', name: '', surname: '', email: '', picture: ''
      });
    }
  };

  return (
    <SessionContext.Provider value={{ operator, setOperator }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSessionContext = () => useContext(SessionContext);
