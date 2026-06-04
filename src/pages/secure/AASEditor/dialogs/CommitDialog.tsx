import { useState, useEffect, type ChangeEvent } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  FormLabel,
  Grow,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { CloudUploadRounded, CloseRounded } from '@mui/icons-material';
import type { CommitStatus } from '@/hooks/useAASVersioning';

function bumpVersion(v: string): string {
  const parts = v.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return v;
  parts[2] += 1;
  return parts.join('.');
}

interface CommitDialogProps {
  open: boolean;
  onClose: () => void;
  isFirstSave: boolean;
  currentVersion: string;
  currentRevision: string;
  currentStatus: CommitStatus;
  isSaving: boolean;
  onCommit: (data: { message: string; version: string; revision: string; status: CommitStatus }) => void;
}

export default function CommitDialog({
  open, onClose, isFirstSave,
  currentVersion, currentRevision, currentStatus,
  isSaving, onCommit,
}: CommitDialogProps) {
  const suggestedVersion = isFirstSave ? currentVersion : bumpVersion(currentVersion);

  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(suggestedVersion);
  const [revision, setRevision] = useState(isFirstSave ? currentRevision : 'A');
  const [status, setStatus] = useState<CommitStatus>(currentStatus);

  useEffect(() => {
    if (open) {
      setMessage('');
      setVersion(isFirstSave ? currentVersion : bumpVersion(currentVersion));
      setRevision(isFirstSave ? currentRevision : 'A');
      setStatus(currentStatus);
    }
  }, [open, isFirstSave, currentVersion, currentRevision, currentStatus]);

  const canCommit = message.trim().length > 0 && version.trim().length > 0 && revision.trim().length > 0;

  const handleConfirm = () => {
    if (!canCommit) return;
    onCommit({ message: message.trim(), version: version.trim(), revision: revision.trim(), status });
  };

  return (
    <Dialog
      open={open}
      onClose={(_: unknown, reason: string) => { if (reason !== 'backdropClick') onClose(); }}
      fullWidth
      maxWidth="sm"
      slots={{ transition: Grow }}
      slotProps={{ transition: { timeout: 250 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CloudUploadRounded />
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
            {isFirstSave ? 'Primo salvataggio sul server' : 'Nuovo commit'}
          </Typography>
          <Typography variant="caption" color="text.disabled" fontFamily="monospace">
            {isFirstSave ? 'Crea il documento nel repository' : `versione corrente: v${currentVersion} rev.${currentRevision}`}
          </Typography>
        </Box>
        <Box flexGrow={1} />
        <IconButton size="small" onClick={onClose} disabled={isSaving}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} pt={1}>
          {isFirstSave && (
            <Alert severity="info" sx={{ fontSize: 12 }}>
              L'AAS verrà salvato nel repository con un commit iniziale. Potrai creare versioni successive da History.
            </Alert>
          )}

          <Box>
            <FormLabel sx={{ fontSize: 11, mb: 0.5, display: 'block' }}>Messaggio commit *</FormLabel>
            <TextField
              size="small"
              fullWidth
              multiline
              rows={2}
              value={message}
              placeholder={isFirstSave ? 'Initial commit' : 'Descrivi le modifiche apportate…'}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
              slotProps={{ input: { style: { fontFamily: 'monospace', fontSize: 12 } } }}
            />
          </Box>

          <Stack direction="row" spacing={1.5}>
            <Box flex={1}>
              <FormLabel sx={{ fontSize: 11, mb: 0.5, display: 'block' }}>Versione *</FormLabel>
              <TextField
                size="small"
                fullWidth
                value={version}
                placeholder="1.0.0"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setVersion(e.target.value)}
                slotProps={{ input: { style: { fontFamily: 'monospace', fontSize: 12 } } }}
              />
            </Box>
            <Box width={100}>
              <FormLabel sx={{ fontSize: 11, mb: 0.5, display: 'block' }}>Revisione *</FormLabel>
              <TextField
                size="small"
                fullWidth
                value={revision}
                placeholder="A"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setRevision(e.target.value)}
                slotProps={{ input: { style: { fontFamily: 'monospace', fontSize: 12, textTransform: 'uppercase' } } }}
              />
            </Box>
          </Stack>

          <Box>
            <FormLabel sx={{ fontSize: 11, mb: 0.5, display: 'block' }}>Stato</FormLabel>
            <Select
              size="small"
              fullWidth
              value={status}
              onChange={(e) => setStatus(e.target.value as CommitStatus)}
              sx={{ fontFamily: 'monospace', fontSize: 12 }}
            >
              <MenuItem value="Draft">Draft — in lavorazione</MenuItem>
              <MenuItem value="Active">Active — approvato e in uso</MenuItem>
              <MenuItem value="Deprecated">Deprecated — superato</MenuItem>
            </Select>
          </Box>
        </Stack>
      </DialogContent>

      <Stack direction="row" justifyContent="flex-end" spacing={1} p={1.5} sx={{ borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose} disabled={isSaving}>Annulla</Button>
        <Button
          variant="contained"
          disabled={!canCommit || isSaving}
          startIcon={<CloudUploadRounded />}
          onClick={handleConfirm}
        >
          {isSaving ? 'Salvataggio…' : isFirstSave ? 'Salva sul server' : 'Commit'}
        </Button>
      </Stack>
    </Dialog>
  );
}
