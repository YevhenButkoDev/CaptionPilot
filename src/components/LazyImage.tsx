import * as React from 'react';
import { Box, Skeleton } from '@mui/material';
import { useLazyImage } from '../lib/useLazyLoad';

interface LazyImageProps {
  src: string;
  alt: string;
  sx?: object;
  onClick?: () => void;
  onLoad?: () => void;
  onError?: () => void;
  placeholder?: React.ReactNode;
  errorPlaceholder?: React.ReactNode;
}

export default function LazyImage({
  src,
  alt,
  sx = {},
  onClick,
  onLoad,
  onError,
  placeholder,
  errorPlaceholder,
}: LazyImageProps) {
  const { ref, imageSrc, isLoaded, hasError, onLoad: handleLoad, onError: handleError } = useLazyImage(src);

  const handleImageLoad = () => {
    handleLoad();
    onLoad?.();
  };

  const handleImageError = () => {
    handleError();
    onError?.();
  };

  const defaultSx = {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    ...sx,
  };

  return (
    <Box
      ref={ref}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {!imageSrc && !hasError && (
        <Skeleton
          variant="rectangular"
          width="100%"
          height="100%"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            ...defaultSx,
          }}
        />
      )}
      
      {imageSrc && !hasError && (
        <Box
          component="img"
          src={imageSrc}
          alt={alt}
          onClick={onClick}
          onLoad={handleImageLoad}
          onError={handleImageError}
          sx={{
            ...defaultSx,
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
          }}
        />
      )}
      
      {hasError && (
        <Box
          sx={{
            ...defaultSx,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default',
            color: 'text.secondary',
            fontSize: '0.875rem',
          }}
        >
          {errorPlaceholder || 'Failed to load image'}
        </Box>
      )}
    </Box>
  );
}
