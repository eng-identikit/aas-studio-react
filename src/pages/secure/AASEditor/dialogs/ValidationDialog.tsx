import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grow,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
  Stack,
  Paper,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  CloseRounded,
  CloudUploadRounded,
  ErrorOutlineRounded,
  CheckCircleOutlineRounded,
  ExpandMoreRounded,
  InsertDriveFileRounded,
} from '@mui/icons-material';

import * as AasJsonization from "@aas-core-works/aas-core3.1-typescript/jsonization";
import * as AasVerification from "@aas-core-works/aas-core3.1-typescript/verification";
import JSZip from 'jszip';
import { parseAasXml } from '@/utils/aas-xml-utils';

interface ValidationDialogProps {
  open: boolean;
  onClose: () => void;
  initialValidationData?: Record<string, unknown> | null;
  onImport?: (data: Record<string, unknown>) => void;
}

type ValidationResultData = {
  status: 'success' | 'failed' | 'error';
  compliant: boolean;
  errors: Array<{
    constraint: string;
    occurrences: number;
    locations: string[];
    message?: string;
  }>;
};

export default function ValidationDialog({ open, onClose, initialValidationData, onImport }: ValidationDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ValidationResultData | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileSelection(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    const validExtensions = ['.aasx', '.json', '.xml'];
    const extension = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
    if (validExtensions.includes(extension)) {
      setFile(selectedFile);
      setResult(null);
      setParsedData(null);
    } else {
      alert(t('validation.unsupportedFile'));
    }
  };

  const executeValidation = useCallback((parsedJson: Record<string, unknown>): ValidationResultData => {
    setParsedData(parsedJson);
    const envResult = AasJsonization.environmentFromJsonable(parsedJson as any);

    if (envResult.error !== null) {
      return {
        status: 'failed',
        compliant: false,
        errors: [{
          constraint: "Deserialization Error",
          occurrences: 1,
          locations: [envResult.error.path ? envResult.error.path.toString() : "Root"],
          message: envResult.error.message
        }]
      };
    }

    if (!envResult.value) {
      return {
        status: 'failed',
        compliant: false,
        errors: [{
          constraint: "No Environment",
          occurrences: 1,
          locations: ["Root"],
          message: "Failed to parse AAS environment."
        }]
      };
    }

    const verificationErrors = Array.from(AasVerification.verify(envResult.value));

    if (verificationErrors.length === 0) {
      return { status: 'success', compliant: true, errors: [] };
    }

    const structuredErrors: Record<string, { count: number; locations: string[]; message: string }> = {};
    verificationErrors.forEach(err => {
      const msg = err.message;
      const loc = err.path ? err.path.toString() : "Unknown";
      if (!structuredErrors[msg]) {
        structuredErrors[msg] = { count: 0, locations: [], message: msg };
      }
      structuredErrors[msg].count++;
      if (!structuredErrors[msg].locations.includes(loc)) {
        structuredErrors[msg].locations.push(loc);
      }
    });

    return {
      status: 'failed',
      compliant: false,
      errors: Object.entries(structuredErrors).map(([msg, data]) => ({
        constraint: msg,
        occurrences: data.count,
        locations: data.locations,
        message: data.message
      }))
    };
  }, []);

  const validateObject = useCallback(async (obj: Record<string, unknown>) => {
    setIsLoading(true);
    setResult(null);
    setTimeout(() => {
      try {
        const validationResult = executeValidation(obj);
        setResult(validationResult);
      } catch (e: unknown) {
        setResult({
          status: 'error',
          compliant: false,
          errors: [{
            constraint: "JSON Format Error",
            occurrences: 1,
            locations: ["Internal Object"],
            message: e instanceof Error ? e.message : String(e)
          }]
        });
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, []);

  const handleRawContent = async (content: string, isXml = false): Promise<ValidationResultData> => {
    try {
      const parsed = isXml ? parseAasXml(content) : JSON.parse(content);
      return executeValidation(parsed);
    } catch (e: unknown) {
      return {
        status: 'error',
        compliant: false,
        errors: [{
          constraint: isXml ? "XML Format Error" : "JSON Format Error",
          occurrences: 1,
          locations: ["File Structure"],
          message: e instanceof Error ? e.message : String(e)
        }]
      };
    }
  };

  const validateFile = async () => {
    if (!file) return;
    setIsLoading(true);
    setResult(null);

    try {
      let validationResult: ValidationResultData;
      const filename = file.name.toLowerCase();

      if (filename.endsWith('.json')) {
        const text = await file.text();
        validationResult = await handleRawContent(text, false);
      } else if (filename.endsWith('.xml')) {
        const text = await file.text();
        validationResult = await handleRawContent(text, true);
      } else if (filename.endsWith('.aasx')) {
        const zip = await JSZip.loadAsync(file);
        const allFiles = Object.keys(zip.files);

        const jsonFile = allFiles.find(name => name.endsWith('.json'));
        const xmlFile = allFiles.find(name => name.endsWith('.xml') && !name.includes('[Content_Types]') && !name.includes('.rels'));

        if (jsonFile) {
          const content = await zip.file(jsonFile)?.async('string');
          validationResult = await handleRawContent(content || '', false);
        } else if (xmlFile) {
          const content = await zip.file(xmlFile)?.async('string');
          validationResult = await handleRawContent(content || '', true);
        } else {
          validationResult = {
            status: 'failed',
            compliant: false,
            errors: [{
              constraint: "No environment found in AASX",
              occurrences: 1,
              locations: ["Package root"],
              message: "AASX must contain either a .json or .xml AAS environment."
            }]
          };
        }
      } else {
        throw new Error("Unsupported file type.");
      }
      setResult(validationResult);
    } catch (error: unknown) {
      console.error("Validation error:", error);
      setResult({
        status: 'error',
        compliant: false,
        errors: [{ constraint: "Internal Error", occurrences: 1, locations: ["System"], message: error instanceof Error ? error.message : String(error) }]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetDialog = () => {
    setFile(null);
    setResult(null);
    setParsedData(null);
  };

  // If initialValidationData is provided when opened, validate it immediately
  useEffect(() => {
    if (open && initialValidationData) {
      validateObject(initialValidationData);
    } else if (!open) {
      resetDialog();
    }
  }, [open, initialValidationData, validateObject]);

  // If initialValidationData was provided, we don't show the file upload UI
  // because we are validating the in-memory state.
  const isInMemoryValidation = !!initialValidationData;

  const handleImport = () => {
    if (onImport && parsedData) {
      onImport(parsedData);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      slots={{ transition: Grow }}
      slotProps={{ transition: { timeout: 300 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CheckCircleOutlineRounded color="primary" />
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
            {t('validation.title')}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            {isInMemoryValidation ? t('validation.subtitleMemory') : t('validation.subtitleFile')}
          </Typography>
        </Box>
        <Box flexGrow={1} />
        <IconButton size="small" onClick={onClose}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        
        {/* Only show file upload area if we aren't doing in-memory validation */}
        {!isInMemoryValidation && (
          <Box sx={{ p: 3, bgcolor: 'background.default' }}>
            <Paper
              variant="outlined"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              sx={{
                p: 4,
                textAlign: 'center',
                border: '2px dashed',
                borderColor: dragOver ? 'primary.main' : 'divider',
                bgcolor: dragOver ? 'rgba(99,102,241,.04)' : 'background.paper',
                cursor: 'pointer',
                transition: 'all .2s',
              }}
              onClick={() => document.getElementById('file-upload-input')?.click()}
            >
              <input
                id="file-upload-input"
                type="file"
                accept=".aasx,.json,.xml"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              {file ? (
                <Stack alignItems="center" spacing={1}>
                  <InsertDriveFileRounded color="primary" sx={{ fontSize: 40 }} />
                  <Typography variant="body1" fontWeight={600}>{file.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(file.size / 1024).toFixed(2)} KB
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={(e) => { e.stopPropagation(); resetDialog(); }}
                    sx={{ mt: 1 }}
                  >
                    {t('validation.changeFile')}
                  </Button>
                </Stack>
              ) : (
                <Stack alignItems="center" spacing={1}>
                  <CloudUploadRounded color="primary" sx={{ fontSize: 48, opacity: 0.8 }} />
                  <Typography variant="body1" fontWeight={600}>
                    {t('validation.dropText')}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {t('validation.supports')}
                  </Typography>
                </Stack>
              )}
            </Paper>

            {file && !result && (
              <Box mt={3} textAlign="center">
                <Button
                  variant="contained"
                  color="primary"
                  onClick={validateFile}
                  disabled={isLoading}
                  startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleOutlineRounded />}
                  size="large"
                >
                  {isLoading ? t('validation.validating') : t('validation.validateBtn')}
                </Button>
              </Box>
            )}
          </Box>
        )}

        {/* Loading state for in-memory validation */}
        {isInMemoryValidation && isLoading && (
           <Box sx={{ p: 5, textAlign: 'center' }}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                {t('validation.validatingModel')}
              </Typography>
           </Box>
        )}

        {result && (
          <Box sx={{ p: 3, borderTop: isInMemoryValidation ? 0 : 1, borderColor: 'divider', flex: 1, overflowY: 'auto' }}>
            {result.compliant ? (
              <Alert severity="success" variant="outlined" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700}>{t('validation.successTitle')}</Typography>
                <Typography variant="body2">
                  {isInMemoryValidation
                    ? t('validation.successModel')
                    : t('validation.successPackage')}
                </Typography>
              </Alert>
            ) : (
              <Box>
                <Alert severity="error" variant="outlined" sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {t('validation.errorsFound', { count: result.errors.reduce((sum: number, err) => sum + err.occurrences, 0) })}
                  </Typography>
                  <Typography variant="body2">
                    {isInMemoryValidation
                      ? t('validation.notCompliantModel')
                      : t('validation.notCompliantPackage')}
                  </Typography>
                </Alert>

                <Stack spacing={1.5}>
                  {result.errors.map((error, idx) => (
                    <Paper key={idx} variant="outlined" sx={{ overflow: 'hidden' }}>
                      <Box sx={{ p: 2, bgcolor: 'error.main', color: 'error.contrastText', display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <ErrorOutlineRounded fontSize="small" />
                        <Box flex={1}>
                          <Typography variant="subtitle2" fontWeight={600} lineHeight={1.3}>
                            {error.constraint}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.8 }}>
                            {t('validation.occurrences', { count: error.occurrences })}
                          </Typography>
                          {error.message && (
                            <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                              {error.message}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Accordion disableGutters elevation={0} square sx={{ '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreRounded />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 1 } }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary">
                            {t('validation.showLocations', { count: error.locations.length })}
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ p: 0, borderTop: 1, borderColor: 'divider' }}>
                          <List sx={{ pt: 0, pb: 0 }}>
                            {error.locations.map((loc, i) => (
                              <Box key={i} sx={{ px: 2, py: 1, borderBottom: i < error.locations.length - 1 ? 1 : 0, borderColor: 'divider' }}>
                                <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                                  {loc}
                                </Typography>
                              </Box>
                            ))}
                          </List>
                        </AccordionDetails>
                      </Accordion>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t('common.buttons.close')}</Button>
        {!isInMemoryValidation && result && (
          <Button
            variant="contained"
            color="success"
            onClick={handleImport}
          >
            {t('validation.importToEditor')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// Quick component for list to avoid importing @mui/material/List above
const List = ({ children, sx }: { children: React.ReactNode; sx?: object }) => <Box sx={sx}>{children}</Box>;
