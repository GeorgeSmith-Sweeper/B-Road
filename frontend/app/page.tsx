'use client';

import { useEffect, useState } from 'react';
import Map from '@/components/Map';
import Sidebar from '@/components/Sidebar';
import ChatInterface from '@/components/ChatInterface';
import { useAppStore } from '@/store/useAppStore';
import { useChatStore } from '@/store/useChatStore';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/types';

export default function Home() {
  const { setMapboxToken, initError, setInitError } = useAppStore();
  const { setSearchResults } = useChatStore();
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  // Initialize app on mount or retry
  useEffect(() => {
    let cancelled = false;

    const initializeApp = async () => {
      setLoading(true);
      setInitError(null);
      try {
        const config = await apiClient.getConfig();
        if (!cancelled) {
          setMapboxToken(config.mapbox_api_key);
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          const apiError = error as ApiError;
          console.error('Failed to initialize app:', apiError);
          setInitError(apiError);
          setLoading(false);
        }
      }
    };

    initializeApp();

    return () => {
      cancelled = true;
    };
  }, [setMapboxToken, setInitError, retryCount]);

  const handleRetry = () => {
    setRetryCount((c) => c + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg">Loading Curvature...</p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            Unable to Connect
          </h1>
          <p className="text-gray-600 mb-4">
            {initError.message}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Please ensure the API server is running at{' '}
            <code className="bg-gray-100 px-1 rounded">
              {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}
            </code>
          </p>
          {initError.retryable && (
            <button
              onClick={handleRetry}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 relative">
        <Map />
      </div>
      <ChatInterface onResultsReceived={setSearchResults} />
    </div>
  );
}
