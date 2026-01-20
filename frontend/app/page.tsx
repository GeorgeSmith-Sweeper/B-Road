'use client';

import { useEffect, useState } from 'react';
import Map from '@/components/Map';
import Sidebar from '@/components/Sidebar';
import { useAppStore } from '@/store/useAppStore';
import { apiClient } from '@/lib/api';

export default function Home() {
  const { setMapboxToken, setCurrentData, searchFilters } = useAppStore();
  const [loading, setLoading] = useState(true);

  // Initialize app on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const config = await apiClient.getConfig();
        setMapboxToken(config.mapbox_api_key);
        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        alert('Failed to load configuration. Please check that the server is running.');
        setLoading(false);
      }
    };

    initializeApp();
  }, [setMapboxToken]);

  const handleSearchRoads = async () => {
    const data = await apiClient.searchRoads(
      searchFilters.min_curvature,
      searchFilters.surface,
      searchFilters.limit
    );
    setCurrentData(data);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg">Loading B-Road...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onSearchRoads={handleSearchRoads} />
      <div className="flex-1 relative">
        <Map />
      </div>
    </div>
  );
}
