import { useRef, useCallback } from 'react';
import { forwardGeocode } from '@/lib/geocoding-api';
import { useGeocoderStore } from '@/store/useGeocoderStore';
import { useAppStore } from '@/store/useAppStore';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

export function useGeocode() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    const { setIsLoading, setSuggestions } = useGeocoderStore.getState();

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    timerRef.current = setTimeout(async () => {
      try {
        const token = useAppStore.getState().mapboxToken;
        const mapCenter = useAppStore.getState().mapCenter;

        const results = await forwardGeocode(query, token, {
          proximity: mapCenter,
          limit: 5,
          country: 'us',
        });

        // Only update if query hasn't changed during the request
        if (useGeocoderStore.getState().query === query) {
          setSuggestions(results);
          setIsLoading(false);
        }
      } catch {
        setIsLoading(false);
        setSuggestions([]);
      }
    }, DEBOUNCE_MS);
  }, []);

  return { search };
}
