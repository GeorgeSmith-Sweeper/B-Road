'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { apiClient } from '@/lib/api';
import { SavedRoute } from '@/types';

interface SidebarProps {
  onLoadData: () => void;
  onSearchRoads: () => void;
  onSaveRoute: () => void;
  onViewRoute: (urlSlug: string) => void;
}

export default function Sidebar({
  onLoadData,
  onSearchRoads,
  onSaveRoute,
  onViewRoute,
}: SidebarProps) {
  const {
    mode,
    setMode,
    searchFilters,
    setSearchFilters,
    selectedSegments,
    clearSegments,
    removeLastSegment,
    routeStats,
    savedRoutes,
    setSavedRoutes,
    sessionId,
  } = useAppStore();

  const [filepath, setFilepath] = useState('/tmp/vermont.msgpack');
  const [loadStatus, setLoadStatus] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [routeStatus, setRouteStatus] = useState('');
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');

  const handleModeSwitch = (newMode: 'browse' | 'stitch') => {
    if (mode === 'stitch' && selectedSegments.length > 0 && newMode === 'browse') {
      if (!confirm('You have an unsaved route. Discard it?')) {
        return;
      }
    }
    setMode(newMode);
    clearSegments();
  };

  const handleLoadData = async () => {
    setLoadStatus('loading');
    try {
      const result = await apiClient.loadData(filepath);
      setLoadStatus(`success: ${result.message}`);
      onLoadData();
    } catch (error) {
      setLoadStatus(`error: ${error instanceof Error ? error.message : 'Failed to load data'}`);
    }
  };

  const handleSearch = async () => {
    setSearchStatus('loading');
    try {
      await onSearchRoads();
      setSearchStatus('success');
    } catch (error) {
      setSearchStatus(`error: ${error instanceof Error ? error.message : 'Search failed'}`);
    }
  };

  const handleSaveRoute = async () => {
    if (!routeName.trim()) {
      setRouteStatus('error: Please enter a route name');
      return;
    }
    if (selectedSegments.length === 0) {
      setRouteStatus('error: No segments selected');
      return;
    }
    if (!sessionId) {
      setRouteStatus('error: No session. Please refresh the page.');
      return;
    }

    setRouteStatus('loading');
    try {
      const result = await apiClient.saveRoute(sessionId, {
        route_name: routeName,
        description: routeDescription,
        segments: selectedSegments,
        is_public: false,
      });
      setRouteStatus(`success: Route saved! ${result.share_url}`);
      setRouteName('');
      setRouteDescription('');
      clearSegments();
      await loadSavedRoutes();
    } catch (error) {
      setRouteStatus(`error: ${error instanceof Error ? error.message : 'Failed to save route'}`);
    }
  };

  const loadSavedRoutes = async () => {
    if (!sessionId) return;
    try {
      const result = await apiClient.listRoutes(sessionId);
      setSavedRoutes(result.routes);
    } catch (error) {
      console.error('Failed to load saved routes:', error);
    }
  };

  const handleViewRoute = (urlSlug: string) => {
    onViewRoute(urlSlug);
  };

  const handleDeleteRoute = async (routeId: number) => {
    if (!confirm('Delete this route?')) return;
    if (!sessionId) return;

    try {
      await apiClient.deleteRoute(routeId, sessionId);
      await loadSavedRoutes();
    } catch (error) {
      alert('Failed to delete route');
    }
  };

  const getCurvatureClass = (curvature: number) => {
    if (curvature < 600) return 'bg-yellow-400 text-black';
    if (curvature < 1000) return 'bg-orange-500 text-white';
    return 'bg-red-500 text-white';
  };

  const getStatusClass = (status: string) => {
    if (status.startsWith('success')) return 'bg-green-100 text-green-800 border-green-300';
    if (status.startsWith('error')) return 'bg-red-100 text-red-800 border-red-300';
    if (status === 'loading') return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'hidden';
  };

  return (
    <div className="w-[400px] bg-gray-50 p-5 overflow-y-auto border-r border-gray-300 shadow-lg">
      <h1 className="text-3xl font-bold text-gray-800 mb-1">🏍️ Curvature</h1>
      <p className="text-sm text-gray-600 mb-5">Find the most twisty roads</p>

      {/* Mode Toggle */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-5">
        <div className="flex gap-2">
          <button
            onClick={() => handleModeSwitch('browse')}
            className={`flex-1 py-2 px-4 rounded font-semibold transition-colors ${
              mode === 'browse'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Browse Roads
          </button>
          <button
            onClick={() => handleModeSwitch('stitch')}
            className={`flex-1 py-2 px-4 rounded font-semibold transition-colors ${
              mode === 'stitch'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Build Route
          </button>
        </div>
      </div>

      {/* Load Data Section */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-5">
        <h3 className="text-lg font-semibold mb-2">1. Load Data</h3>
        <p className="text-xs text-gray-600 mb-2">First, load a curvature .msgpack file</p>
        <input
          type="text"
          value={filepath}
          onChange={(e) => setFilepath(e.target.value)}
          placeholder="/tmp/vermont.msgpack"
          className="w-full p-2 border border-gray-300 rounded mb-2 text-sm"
        />
        <button
          onClick={handleLoadData}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded font-semibold hover:bg-blue-700 transition-colors"
        >
          Load Data
        </button>
        {loadStatus && (
          <div className={`mt-2 p-2 rounded text-xs border ${getStatusClass(loadStatus)}`}>
            {loadStatus.replace('success: ', '✓ ').replace('error: ', '✗ ')}
          </div>
        )}
      </div>

      {/* Search Filters (Browse Mode) */}
      {mode === 'browse' && (
        <div className="bg-white p-4 rounded-lg shadow-sm mb-5">
          <h3 className="text-lg font-semibold mb-2">2. Filter Roads</h3>

          <label className="block mt-3 mb-1 text-sm font-semibold text-gray-700">
            Minimum Curvature:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="5000"
              step="100"
              value={searchFilters.min_curvature}
              onChange={(e) =>
                setSearchFilters({ min_curvature: parseInt(e.target.value) })
              }
              className="flex-1"
            />
            <span className="w-12 text-right font-semibold text-blue-600">
              {searchFilters.min_curvature}
            </span>
          </div>

          <label className="block mt-3 mb-1 text-sm font-semibold text-gray-700">
            Surface Type:
          </label>
          <select
            value={searchFilters.surface}
            onChange={(e) => setSearchFilters({ surface: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded text-sm"
          >
            <option value="">All Surfaces</option>
            <option value="paved">Paved Only</option>
            <option value="unpaved">Unpaved Only</option>
            <option value="unknown">Unknown Surface</option>
          </select>

          <label className="block mt-3 mb-1 text-sm font-semibold text-gray-700">
            Max Results:
          </label>
          <select
            value={searchFilters.limit}
            onChange={(e) => setSearchFilters({ limit: parseInt(e.target.value) })}
            className="w-full p-2 border border-gray-300 rounded text-sm"
          >
            <option value="25">25 roads</option>
            <option value="50">50 roads</option>
            <option value="100">100 roads</option>
            <option value="200">200 roads</option>
          </select>

          <button
            onClick={handleSearch}
            className="w-full mt-3 bg-blue-600 text-white py-3 px-4 rounded font-semibold hover:bg-blue-700 transition-colors"
          >
            Search Roads
          </button>
          {searchStatus && (
            <div className={`mt-2 p-2 rounded text-xs border ${getStatusClass(searchStatus)}`}>
              {searchStatus === 'loading' ? 'Searching...' : searchStatus === 'success' ? '✓ Search complete' : searchStatus}
            </div>
          )}
        </div>
      )}

      {/* Route Builder (Stitch Mode) */}
      {mode === 'stitch' && (
        <div className="bg-white p-4 rounded-lg shadow-sm mb-5">
          <h3 className="text-lg font-semibold mb-2">Route Builder</h3>
          <p className="text-xs text-gray-600 mb-3">
            Click connected road segments on the map to build your route
          </p>

          <div className="bg-gray-50 p-3 rounded border-l-4 border-green-500 mb-3">
            <p className="text-sm text-gray-700 mb-1">
              <strong>Segments:</strong> {routeStats.segmentCount}
            </p>
            <p className="text-sm text-gray-700 mb-1">
              <strong>Distance:</strong> {(routeStats.totalLength / 1609.34).toFixed(2)} mi
            </p>
            <p className="text-sm text-gray-700">
              <strong>Curvature:</strong> {Math.round(routeStats.totalCurvature)}
            </p>
          </div>

          <input
            type="text"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            placeholder="Route name"
            className="w-full p-2 border border-gray-300 rounded mb-2 text-sm"
          />
          <textarea
            value={routeDescription}
            onChange={(e) => setRouteDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full p-2 border border-gray-300 rounded mb-2 text-sm resize-vertical min-h-[60px]"
          />

          <button
            onClick={handleSaveRoute}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded font-semibold hover:bg-blue-700 transition-colors mb-2"
          >
            Save Route
          </button>
          <button
            onClick={removeLastSegment}
            className="w-full bg-gray-600 text-white py-2 px-4 rounded font-semibold hover:bg-gray-700 transition-colors mb-2"
          >
            Undo Last
          </button>
          <button
            onClick={clearSegments}
            className="w-full bg-gray-600 text-white py-2 px-4 rounded font-semibold hover:bg-gray-700 transition-colors"
          >
            Clear
          </button>

          {routeStatus && (
            <div className={`mt-2 p-2 rounded text-xs border ${getStatusClass(routeStatus)}`}>
              {routeStatus.replace('success:', '✓').replace('error:', '✗')}
            </div>
          )}
        </div>
      )}

      {/* Saved Routes */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-5">
        <h3 className="text-lg font-semibold mb-2">Saved Routes</h3>
        <div className="max-h-[300px] overflow-y-auto">
          {savedRoutes.length === 0 ? (
            <p className="text-xs text-gray-600">No saved routes yet</p>
          ) : (
            savedRoutes.map((route) => (
              <div
                key={route.route_id}
                className="p-2 mb-2 bg-gray-50 rounded border-l-4 border-blue-600 hover:bg-gray-100 transition-colors"
              >
                <div className="font-semibold text-gray-800">{route.route_name}</div>
                <div className="text-xs text-gray-600 mb-2">
                  <span className={`inline-block px-2 py-1 rounded mr-1 ${getCurvatureClass(route.total_curvature)}`}>
                    {Math.round(route.total_curvature)}
                  </span>
                  {route.total_length_mi.toFixed(1)} mi • {route.segment_count} segments
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleViewRoute(route.url_slug)}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View
                  </button>
                  <a
                    href={apiClient.getExportUrl(route.url_slug, 'kml')}
                    target="_blank"
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    KML
                  </a>
                  <a
                    href={apiClient.getExportUrl(route.url_slug, 'gpx')}
                    target="_blank"
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    GPX
                  </a>
                  <button
                    onClick={() => handleDeleteRoute(route.route_id)}
                    className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600">
        <h4 className="text-blue-800 font-semibold mb-2">About Curvature</h4>
        <p className="text-xs text-gray-700 mb-2">
          Curvature scores represent the &quot;twistiness&quot; of a road based on turn radius and frequency.
        </p>
        <ul className="text-xs text-gray-700 list-disc ml-5 space-y-1">
          <li><strong>300-600:</strong> Pleasant, flowing roads</li>
          <li><strong>600-1000:</strong> Fun, moderately twisty</li>
          <li><strong>1000+:</strong> Very curvy, technical roads</li>
          <li><strong>2000+:</strong> Extremely twisty!</li>
        </ul>
      </div>
    </div>
  );
}
