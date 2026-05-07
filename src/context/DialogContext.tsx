import { createContext, useContext, useState, ReactNode } from 'react';

interface DialogHandlers {
  // Dashboard
  onShowAbout?: () => void;
  onShowReferrals?: () => void;
  // AAS Editor
  onValidateAAS?: () => void;
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
  return (
    <DialogContext.Provider value={{ handlers, setHandlers }}>
      {children}
    </DialogContext.Provider>
  );
};

export const useDialogContext = () => {
  const context = useContext(DialogContext);
  if (context === undefined) throw new Error('useDialogContext deve essere usato dentro DialogProvider');
  return context;
};
