'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/types';
import RouteBuilderPanel from './RouteBuilderPanel';
import WaypointRouteBuilder from './WaypointRouteBuilder';

export default function Sidebar() {
  const {
    searchFilters,
    setSearchFilters,
    curvatureSources,
    setCurvatureSources,
    selectedSource,
    setSelectedSource,
    sourcesError,
    setSourcesError,
  } = useAppStore();

  const [sourcesLoading, setSourcesLoading] = useState(false);

  // Load curvature sources
  const loadSources = useCallback(async () => {
    setSourcesLoading(true);
    setSourcesError(null);
    try {
      const sources = await apiClient.listCurvatureSources();
      setCurvatureSources(sources);
    } catch (error) {
      const apiError = error as ApiError;
      console.error('Failed to load curvature sources:', apiError);
      setSourcesError(apiError);
    } finally {
      setSourcesLoading(false);
    }
  }, [setCurvatureSources, setSourcesError]);

  // Load sources on mount
  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const totalSegments = curvatureSources.reduce((sum, s) => sum + s.segment_count, 0);

  return (
    <div className="w-[400px] bg-gray-50 p-5 overflow-y-auto border-r border-gray-300 shadow-lg">
      <h1 className="text-3xl font-bold text-gray-800 mb-1">Curvature</h1>
      <p className="text-sm text-gray-600 mb-5">Find the most twisty roads</p>

      {/* Curvature Data Status */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-5">
        <h3 className="text-lg font-semibold mb-2">Road Data</h3>

        {/* Source Selector */}
        <label className="block mb-1 text-sm font-semibold text-gray-700">
          Filter by State:
        </label>

        {sourcesError ? (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-700 mb-2">{sourcesError.message}</p>
            {sourcesError.retryable && (
              <button
                onClick={loadSources}
                disabled={sourcesLoading}
                className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {sourcesLoading ? 'Retrying...' : 'Retry'}
              </button>
            )}
          </div>
        ) : (
          <select
            value={selectedSource || ''}
            onChange={(e) => setSelectedSource(e.target.value || null)}
            className="w-full p-2 border border-gray-300 rounded text-sm mb-3"
            disabled={sourcesLoading}
          >
            <option value="">
              {sourcesLoading ? 'Loading states...' : 'All States'}
            </option>
            {curvatureSources.map((source) => (
              <option key={source.id} value={source.name}>
                {source.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ({source.segment_count.toLocaleString()})
              </option>
            ))}
          </select>
        )}

        {/* Stats */}
        <div className="bg-gray-50 p-3 rounded border-l-4 border-blue-500">
          <p className="text-sm text-gray-700">
            <strong>Total Segments:</strong> {totalSegments.toLocaleString()}
          </p>
          {curvatureSources.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {curvatureSources.length} state{curvatureSources.length !== 1 ? 's' : ''} available
            </p>
          )}
        </div>
      </div>

      {/* Search Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-5">
        <h3 className="text-lg font-semibold mb-2">Filters</h3>

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
        <p className="text-xs text-gray-500 mt-1">
          Filters visible roads instantly
        </p>
      </div>

      {/* Waypoint Router */}
      <WaypointRouteBuilder />

      {/* Route Builder */}
      <RouteBuilderPanel />

      {/* Color Legend */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-5">
        <h3 className="text-lg font-semibold mb-2">Curvature Legend</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-3 bg-yellow-400 rounded"></div>
            <span className="text-sm text-gray-700">300-600: Pleasant curves</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-3 bg-orange-500 rounded"></div>
            <span className="text-sm text-gray-700">600-1000: Moderately twisty</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-3 bg-red-500 rounded"></div>
            <span className="text-sm text-gray-700">1000-2000: Very curvy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-3 bg-purple-600 rounded"></div>
            <span className="text-sm text-gray-700">2000+: Extremely twisty</span>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600">
        <h4 className="text-blue-800 font-semibold mb-2">About Curvature</h4>
        <p className="text-xs text-gray-700 mb-2">
          Curvature scores represent the &quot;twistiness&quot; of a road based on turn radius and frequency.
        </p>
        <p className="text-xs text-gray-700">
          Data sourced from OpenStreetMap via the Curvature project.
        </p>
      </div>
    </div>
  );
}
