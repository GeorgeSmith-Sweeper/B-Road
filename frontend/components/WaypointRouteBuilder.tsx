'use client';

import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';
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
  } = useWaypointRouteStore();

  const totalDistance = getTotalDistance();
  const totalDuration = getTotalDuration();
  const waypointCount = getWaypointCount();

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
              <div className="bg-amber-50 px-2 py-1 rounded text-amber-700 font-medium">
                {totalDuration.toFixed(0)} min
              </div>
            </>
          )}
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

      {/* Actions */}
      {waypointCount > 0 && (
        <div className="space-y-2">
          <button
            onClick={clearWaypoints}
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
      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
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
            <span className="ml-1 text-amber-600">(moved)</span>
          )}
        </p>
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
