import { useState, type ChangeEvent } from 'react';
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
} from '@mui/material';
import { AddRounded, CloseRounded } from '@mui/icons-material';
import type { AssetKind } from '@/context/AASContext';

interface AddEntityDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: { idShort: string; assetId: string; description: string; assetKind: AssetKind }) => void;
}

export default function AddEntityDialog({ open, onClose, onAdd }: AddEntityDialogProps) {
  const [idShort, setIdShort] = useState('');
  const [assetId, setAssetId] = useState('urn:');
  const [description, setDescription] = useState('');
  const [assetKind, setAssetKind] = useState<AssetKind>('Instance');

  const canAdd = idShort.trim().length > 0 && assetId.trim().length > 0;

  const reset = () => {
    setIdShort('');
    setAssetId('urn:');
    setDescription('');
    setAssetKind('Instance');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({ idShort: idShort.trim(), assetId: assetId.trim(), description, assetKind });
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={(_: unknown, reason: string) => { if (reason !== 'backdropClick') handleClose(); }}
      fullWidth
      maxWidth="sm"
      slots={{ transition: Grow }}
      slotProps={{ transition: { timeout: 250 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <AddRounded />
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>Nuova Entità AAS</Typography>
          <Typography variant="caption" color="text.disabled" fontFamily="monospace">Crea un nuovo oggetto AAS</Typography>
        </Box>
        <Box flexGrow={1} />
        <IconButton size="small" onClick={handleClose}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} pt={1}>
          <Box>
            <FormLabel sx={{ fontSize: 11, mb: 0.5, display: 'block' }}>idShort *</FormLabel>
            <TextField
              size="small"
              fullWidth
              value={idShort}
              placeholder="MyDevice"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setIdShort(e.target.value)}
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
            />
          </Box>

          <Box>
            <FormLabel sx={{ fontSize: 11, mb: 0.5, display: 'block' }}>globalAssetId *</FormLabel>
            <TextField
              size="small"
              fullWidth
              value={assetId}
              placeholder="urn:org:device:type:serial"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAssetId(e.target.value)}
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
            />
          </Box>

          <Box>
            <FormLabel sx={{ fontSize: 11, mb: 0.5, display: 'block' }}>description</FormLabel>
            <TextField
              size="small"
              fullWidth
              multiline
              rows={3}
              value={description}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
            />
          </Box>

          <Box>
            <FormLabel sx={{ fontSize: 11, mb: 0.5, display: 'block' }}>assetKind</FormLabel>
            <Select
              size="small"
              fullWidth
              value={assetKind}
              onChange={(e) => setAssetKind(e.target.value as AssetKind)}
              sx={{ fontFamily: 'monospace', fontSize: 12 }}
            >
              <MenuItem value="Instance">Instance</MenuItem>
              <MenuItem value="Type">Type</MenuItem>
            </Select>
          </Box>
        </Stack>
      </DialogContent>

      <Stack
        direction="row"
        justifyContent="flex-end"
        spacing={1}
        p={1.5}
        sx={{ borderTop: 1, borderColor: 'divider' }}
      >
        <Button onClick={handleClose}>Annulla</Button>
        <Button
          variant="contained"
          disabled={!canAdd}
          startIcon={<AddRounded />}
          onClick={handleAdd}
        >
          Crea
        </Button>
      </Stack>
    </Dialog>
  );
}
