import { useEffect, useRef, useState } from 'react';

/**
 * Lazy loading utilities using Intersection Observer API
 * Provides hooks for lazy loading images and other content
 */

interface UseLazyLoadOptions {
  rootMargin?: string;
  threshold?: number;
}

export function useLazyLoad(options: UseLazyLoadOptions = {}) {
  const { rootMargin = '50px', threshold = 0.1 } = options;
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          setHasIntersected(true);
          // Once intersected, we can stop observing
          observer.unobserve(element);
        }
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [rootMargin, threshold]);

  return { ref, isIntersecting, hasIntersected };
}

export function useLazyImage(src: string, options: UseLazyLoadOptions = {}) {
  const { ref, hasIntersected } = useLazyLoad(options);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (hasIntersected && src) {
      setImageSrc(src);
    }
  }, [hasIntersected, src]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  return {
    ref,
    imageSrc,
    isLoaded,
    hasError,
    onLoad: handleLoad,
    onError: handleError,
  };
}
