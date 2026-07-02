import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

interface DialogHandlers {
  // Dashboard
  onShowAbout?: () => void;
  onShowReferrals?: () => void;
  // AAS Editor
  onValidateAAS?: () => void;
  onConnectServer?: () => void;
  onAddSubmodel?: () => void;
  onAddEntity?: () => void;
  onExportAASX?: () => void;
  // AAS Lifecycle
  onExportChangelog?: () => void;
  // AAS Server
  onGenerateServer?: () => void;
  onDownloadServer?: () => void;
  // Profile / settings
  onShowCreateOperator?: () => void;
  onShowSettings?: () => void;
}

interface DialogContextProps {
  handlers: DialogHandlers;
  setHandlers: (handlers: DialogHandlers) => void;
}

const DialogContext = createContext<DialogContextProps | undefined>(undefined);

export const DialogProvider = ({ children }: { children: ReactNode }) => {
  const [handlers, setHandlers] = useState<DialogHandlers>({});
  const value = useMemo(() => ({ handlers, setHandlers }), [handlers]);
  return (
    <DialogContext.Provider value={value}>
      {children}
    </DialogContext.Provider>
  );
};

export const useDialogContext = () => {
  const context = useContext(DialogContext);
  if (context === undefined) throw new Error('useDialogContext deve essere usato dentro DialogProvider');
  return context;
};
