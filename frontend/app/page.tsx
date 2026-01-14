'use client';

import { useEffect, useState } from 'react';
import Map from '@/components/Map';
import Sidebar from '@/components/Sidebar';
import { useAppStore } from '@/store/useAppStore';
import { apiClient } from '@/lib/api';
import { Segment } from '@/types';

export default function Home() {
  const {
    setMapboxToken,
    setCurrentData,
    mode,
    setMode,
    searchFilters,
    selectedSegments,
    addSegment,
    setSessionId,
    setSavedRoutes,
    sessionId,
  } = useAppStore();

  const [loading, setLoading] = useState(true);

  // Initialize app on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load configuration
        const config = await apiClient.getConfig();
        setMapboxToken(config.mapbox_api_key);

        // Initialize or restore session
        const storedSessionId =
          typeof window !== 'undefined'
            ? localStorage.getItem('curvature_session_id')
            : null;

        if (storedSessionId) {
          // Validate and restore session
          setSessionId(storedSessionId);
          try {
            const routes = await apiClient.listRoutes(storedSessionId);
            setSavedRoutes(routes.routes);
          } catch (error) {
            // Session invalid, create new one
            localStorage.removeItem('curvature_session_id');
            const newSession = await apiClient.createSession();
            setSessionId(newSession.session_id);
          }
        } else {
          // Create new session
          const newSession = await apiClient.createSession();
          setSessionId(newSession.session_id);
        }

        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        alert('Failed to load configuration. Please check that the server is running.');
        setLoading(false);
      }
    };

    initializeApp();
  }, [setMapboxToken, setSessionId, setSavedRoutes]);

  // Load saved routes when session is available
  useEffect(() => {
    const loadSavedRoutes = async () => {
      if (!sessionId) return;
      try {
        const routes = await apiClient.listRoutes(sessionId);
        setSavedRoutes(routes.routes);
      } catch (error) {
        console.error('Failed to load saved routes:', error);
      }
    };

    loadSavedRoutes();
  }, [sessionId, setSavedRoutes]);

  const handleLoadData = () => {
    // Data loading is handled in the Sidebar component
    // This is just a callback to trigger any additional actions
  };

  const handleSearchRoads = async () => {
    if (mode === 'browse') {
      const data = await apiClient.searchRoads(
        searchFilters.min_curvature,
        searchFilters.surface,
        searchFilters.limit
      );
      setCurrentData(data);
    } else if (mode === 'stitch') {
      const data = await apiClient.loadSegments(searchFilters.min_curvature, 500);
      setCurrentData(data);
    }
  };

  const handleSaveRoute = () => {
    // Route saving is handled in the Sidebar component
  };

  const handleViewRoute = async (urlSlug: string) => {
    try {
      const route = await apiClient.viewRoute(urlSlug);
      setCurrentData(route.geojson);
      // Switch to browse mode to view the route
      if (mode !== 'browse') {
        if (selectedSegments.length === 0 || confirm('You have an unsaved route. Discard it?')) {
          setMode('browse');
        }
      }
    } catch (error) {
      alert('Failed to load route');
      console.error('Error viewing route:', error);
    }
  };

  const handleSegmentClick = (segment: Segment) => {
    // Validate connection
    if (selectedSegments.length > 0) {
      const lastSegment = selectedSegments[selectedSegments.length - 1];
      if (!segmentsConnect(lastSegment, segment)) {
        alert('Segments must connect! Click on an adjacent segment.');
        return;
      }
    }

    addSegment(segment);
  };

  const segmentsConnect = (seg1: Segment, seg2: Segment): boolean => {
    const tolerance = 0.00001; // ~1 meter

    // Check if seg1.end connects to seg2.start (forward-forward)
    const forwardForward =
      Math.abs(seg1.end[0] - seg2.start[0]) < tolerance &&
      Math.abs(seg1.end[1] - seg2.start[1]) < tolerance;

    // Check if seg1.end connects to seg2.end (forward-reverse)
    const forwardReverse =
      Math.abs(seg1.end[0] - seg2.end[0]) < tolerance &&
      Math.abs(seg1.end[1] - seg2.end[1]) < tolerance;

    return forwardForward || forwardReverse;
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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        onLoadData={handleLoadData}
        onSearchRoads={handleSearchRoads}
        onSaveRoute={handleSaveRoute}
        onViewRoute={handleViewRoute}
      />
      <div className="flex-1 relative">
        <Map onSegmentClick={handleSegmentClick} />
      </div>
    </div>
  );
}
