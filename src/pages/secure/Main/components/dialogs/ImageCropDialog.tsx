import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, IconButton, Typography, Slider } from '@mui/material';
import { CloseRounded, CropRounded, RotateRightRounded } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import Cropper, { Area } from 'react-easy-crop';

interface ImageCropDialogProps {
    open: boolean;
    aspectRatio?: number;
    onClose: () => void;
    imageSrc: string;
    onCropComplete: (croppedImage: Blob) => void;
}

// Funzione per scaricare l'immagine e creare un blob URL locale
const downloadImageAsBlob = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error('Errore nel download dell\'immagine:', error);
        // Fallback: usa l'URL originale
        return url;
    }
};

const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.src = url;
    });

const getCroppedImg = async (imageSrc: string, pixelCrop: Area, rotation = 0): Promise<Blob> => {
    const image = await createImage(imageSrc);

    // Crea un canvas temporaneo per l'immagine originale ruotata
    const rotatedCanvas = document.createElement('canvas');
    const rotatedCtx = rotatedCanvas.getContext('2d');

    if (!rotatedCtx) {
        throw new Error('Could not get canvas context');
    }

    if (rotation === 0) {
        // Nessuna rotazione: crop diretto
        rotatedCanvas.width = pixelCrop.width;
        rotatedCanvas.height = pixelCrop.height;

        rotatedCtx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );
    } else {
        // Con rotazione: ruota prima l'intera immagine
        const rotRad = (rotation * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rotRad));
        const sin = Math.abs(Math.sin(rotRad));

        const newWidth = image.width * cos + image.height * sin;
        const newHeight = image.width * sin + image.height * cos;

        rotatedCanvas.width = newWidth;
        rotatedCanvas.height = newHeight;

        rotatedCtx.translate(newWidth / 2, newHeight / 2);
        rotatedCtx.rotate(rotRad);
        rotatedCtx.drawImage(image, -image.width / 2, -image.height / 2);

        // Ora croppa dall'immagine ruotata
        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d');

        if (!finalCtx) {
            throw new Error('Could not get final canvas context');
        }

        finalCanvas.width = pixelCrop.width;
        finalCanvas.height = pixelCrop.height;

        finalCtx.drawImage(
            rotatedCanvas,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );

        return new Promise((resolve) => {
            finalCanvas.toBlob((blob) => {
                if (!blob) {
                    throw new Error('Canvas toBlob failed');
                }
                resolve(blob);
            }, 'image/jpeg', 0.95);
        });
    }

    return new Promise((resolve) => {
        rotatedCanvas.toBlob((blob) => {
            if (!blob) {
                throw new Error('Canvas toBlob failed');
            }
            resolve(blob);
        }, 'image/jpeg', 0.95);
    });
};

export default function ImageCropDialog({ open, aspectRatio = 4 / 3, onClose, imageSrc, onCropComplete }: ImageCropDialogProps) {
    const { t } = useTranslation();
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [localImageSrc, setLocalImageSrc] = useState<string>('');
    const [isLoadingImage, setIsLoadingImage] = useState(false);

    const onCropCompleteHandler = useCallback(
        (_croppedArea: Area, croppedAreaPixels: Area) => {
            setCroppedAreaPixels(croppedAreaPixels);
        },
        []
    );

    const handleSaveCrop = async () => {
        if (!croppedAreaPixels || !localImageSrc) return;
        try {
            const croppedImage = await getCroppedImg(localImageSrc, croppedAreaPixels, rotation);
            onCropComplete(croppedImage);
        } catch (e) {
            console.error('❌ Errore nel crop dell\'immagine:', e);
            alert(t('common.dialogs.cropImage.error'));
        }
    };

    const handleRotate = () => {
        setRotation((prev) => (prev + 90) % 360);
    };

    // Reset degli stati quando si apre il dialog
    const handleReset = () => {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
        setCroppedAreaPixels(null);
    };

    // Reset quando il dialog si apre e scarica l'immagine
    useEffect(() => {
        if (open && imageSrc) {
            handleReset();
            setIsLoadingImage(true);

            downloadImageAsBlob(imageSrc)
                .then((localUrl) => {
                    setLocalImageSrc(localUrl);
                    setIsLoadingImage(false);
                })
                .catch((error) => {
                    console.error('Errore nel download dell\'immagine:', error);
                    setLocalImageSrc(imageSrc); // Fallback all'URL originale
                    setIsLoadingImage(false);
                });
        }

        // Cleanup: revoca l'URL del blob quando il componente si smonta o l'immagine cambia
        return () => {
            if (localImageSrc && localImageSrc.startsWith('blob:')) {
                URL.revokeObjectURL(localImageSrc);
            }
        };
    }, [open, imageSrc]);

    if (!open) return null;
    
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { height: '80vh' }
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box display="flex" alignItems="center">
                    <CropRounded sx={{ mr: 1 }} />
                    {t('common.dialogs.cropImage.title')}
                </Box>
                <IconButton size="small"
                    onClick={onClose}
                    sx={{
                        justifyContent: 'center',
                        border: 'none'
                    }}
                >
                    <CloseRounded fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0, position: 'relative', minHeight: 400 }}>
                {isLoadingImage ? (
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: 400,
                            backgroundColor: '#000'
                        }}
                    >
                        <Typography color="white">
                            {t('common.texts.loading')}...
                        </Typography>
                    </Box>
                ) : localImageSrc ? (
                    <Cropper
                        image={localImageSrc}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={aspectRatio}
                        onCropChange={setCrop}
                        onCropComplete={onCropCompleteHandler}
                        onZoomChange={setZoom}
                        onRotationChange={setRotation}
                        style={{
                            containerStyle: {
                                width: '100%',
                                height: '100%',
                                backgroundColor: '#000'
                            }
                        }}
                    />
                ) : (
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: 400,
                            backgroundColor: '#000'
                        }}
                    >
                        <Typography color="white">
                            Errore nel caricamento dell'immagine
                        </Typography>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ flexDirection: 'column', gap: 2, p: 2 }}>
                {/* Controls */}
                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Zoom */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" sx={{ minWidth: 60 }}>
                            {t('common.texts.zoom')}
                        </Typography>
                        <Slider
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            onChange={(_, value) => setZoom(value as number)}
                            sx={{ flex: 1 }}
                        />
                        <Typography variant="body2" sx={{ minWidth: 40 }}>
                            {Math.round(zoom * 100)}%
                        </Typography>
                    </Box>

                    {/* Rotation */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" sx={{ minWidth: 60 }}>
                            {t('common.texts.rotation')}
                        </Typography>
                        <Slider
                            value={rotation}
                            min={0}
                            max={360}
                            step={1}
                            onChange={(_, value) => setRotation(value as number)}
                            sx={{ flex: 1 }}
                        />
                        <IconButton size="small" onClick={handleRotate}>
                            <RotateRightRounded />
                        </IconButton>
                    </Box>
                </Box>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                    <Button onClick={onClose} fullWidth>
                        {t('common.buttons.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSaveCrop}
                        fullWidth
                        startIcon={<CropRounded />}
                        disabled={isLoadingImage || !localImageSrc}
                    >
                        {t('common.buttons.edit')}
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
};
