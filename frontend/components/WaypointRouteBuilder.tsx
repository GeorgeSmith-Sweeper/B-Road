'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';
import { createSession, saveRoute, getGpxExportUrl, getKmlExportUrl } from '@/lib/routes-api';
import { getGoogleMapsUrl, getStreetViewUrl, getDirectionsUrl } from '@/lib/google-maps';
import type { Waypoint } from '@/types/routing';

export default function WaypointRouteBuilder() {
  const {
    waypoints,
    calculatedRoute,
    isCalculating,
    error,
    removeWaypoint,
    clearWaypoints,
    getTotalDistance,
    getTotalDuration,
    getWaypointCount,
    getTotalCurvature,
    sessionId,
    setSessionId,
  } = useWaypointRouteStore();

  const [saving, setSaving] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  const totalDistance = getTotalDistance();
  const totalDuration = getTotalDuration();
  const waypointCount = getWaypointCount();

  const handleSave = async () => {
    if (!routeName.trim() || !calculatedRoute) return;

    setSaving(true);
    try {
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const session = await createSession();
        currentSessionId = session.session_id;
        setSessionId(currentSessionId);
      }

      const result = await saveRoute(currentSessionId, {
        route_name: routeName.trim(),
        description: description.trim() || undefined,
        route_type: 'waypoint',
        waypoints: waypoints.map((wp) => ({
          lng: wp.lng,
          lat: wp.lat,
          order: wp.order,
          segment_id: wp.segmentId || null,
          is_user_modified: wp.isUserModified,
        })),
        connecting_geometry: calculatedRoute.geometry,
        is_public: isPublic,
        total_distance: calculatedRoute.distance,
        total_curvature: getTotalCurvature(),
      });

      toast.success(`Route "${routeName}" saved!`);
      setSavedSlug(result.url_slug);
      setShowSaveForm(false);
      setRouteName('');
      setDescription('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save route';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Waypoint Router</h3>
        {isCalculating && (
          <span className="text-xs text-blue-600 animate-pulse">Calculating...</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats Bar */}
      {waypointCount > 0 && (
        <div className="flex gap-3 mb-3 text-xs">
          <div className="bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-medium">
            {waypointCount} point{waypointCount !== 1 ? 's' : ''}
          </div>
          {calculatedRoute && (
            <>
              <div className="bg-blue-50 px-2 py-1 rounded text-blue-700 font-medium">
                {totalDistance.toFixed(1)} mi
              </div>
              <div className="bg-teal-50 px-2 py-1 rounded text-teal-700 font-medium">
                {totalDuration.toFixed(0)} min
              </div>
            </>
          )}
        </div>
      )}

      {/* Save Route (quick access) */}
      {waypointCount >= 2 && calculatedRoute && !showSaveForm && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => {
              setSavedSlug(null);
              setShowSaveForm(true);
            }}
            className="flex-1 px-2 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition-colors"
          >
            Save Route
          </button>
        </div>
      )}

      {/* Waypoint List */}
      {waypointCount === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <svg
            className="w-10 h-10 mx-auto mb-2 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-sm">
            Click road segments to add waypoints and build a connected route
          </p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[300px] overflow-y-auto mb-3">
          {waypoints.map((waypoint: Waypoint, index: number) => (
            <WaypointItem
              key={waypoint.id}
              waypoint={waypoint}
              index={index}
              onRemove={() => removeWaypoint(waypoint.id)}
            />
          ))}
        </div>
      )}

      {/* Save Form */}
      {showSaveForm && (
        <div className="mb-3 p-3 bg-gray-50 rounded border space-y-2">
          <input
            type="text"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            placeholder="Route name *"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
            maxLength={255}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
            rows={2}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-3.5 h-3.5 text-emerald-600 rounded"
            />
            <span className="text-xs text-gray-600">Make public (shareable)</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!routeName.trim() || saving}
              className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setShowSaveForm(false)}
              className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded text-sm hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Export buttons for saved routes */}
      {savedSlug && (
        <div className="mb-3 flex gap-2">
          <a
            href={getGpxExportUrl(savedSlug)}
            download
            className="flex-1 text-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-xs font-medium hover:bg-blue-100 transition-colors"
          >
            Export GPX
          </a>
          <a
            href={getKmlExportUrl(savedSlug)}
            download
            className="flex-1 text-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-xs font-medium hover:bg-blue-100 transition-colors"
          >
            Export KML
          </a>
        </div>
      )}

      {/* Actions */}
      {waypointCount > 0 && (
        <div className="space-y-2">
          {calculatedRoute && waypointCount >= 2 && (
            <a
              href={getDirectionsUrl(waypoints.map((wp) => [wp.lat, wp.lng]))}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center px-3 py-2 bg-blue-50 text-blue-700 rounded text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              Get Directions
            </a>
          )}
          <button
            onClick={() => {
              clearWaypoints();
              setSavedSlug(null);
              setShowSaveForm(false);
            }}
            className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded text-sm hover:bg-gray-50 transition-colors"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}

function WaypointItem({
  waypoint,
  index,
  onRemove,
}: {
  waypoint: Waypoint;
  index: number;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 group">
      {/* Waypoint number */}
      <div className="w-6 h-6 rounded-full bg-[#1FDDE0] text-gray-900 text-xs flex items-center justify-center font-bold flex-shrink-0">
        {index + 1}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {waypoint.segmentName || 'Waypoint'}
        </p>
        <p className="text-xs text-gray-500">
          {waypoint.lng.toFixed(4)}, {waypoint.lat.toFixed(4)}
          {waypoint.isUserModified && (
            <span className="ml-1 text-teal-600">(moved)</span>
          )}
        </p>
        <div className="flex gap-1.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={getGoogleMapsUrl(waypoint.lat, waypoint.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-blue-500 hover:text-blue-700"
          >
            Maps
          </a>
          <a
            href={getStreetViewUrl(waypoint.lat, waypoint.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-green-500 hover:text-green-700"
          >
            Street View
          </a>
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove waypoint"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
