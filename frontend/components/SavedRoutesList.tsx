'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useRouteStore, RouteSegmentData } from '@/store/useRouteStore';
import { listRoutes, deleteRoute, getRoute, getGpxExportUrl, getKmlExportUrl, RouteResponse } from '@/lib/routes-api';

interface SavedRoutesListProps {
  onClose: () => void;
}

export default function SavedRoutesList({ onClose }: SavedRoutesListProps) {
  const { sessionId, loadSegments } = useRouteStore();
  const [routes, setRoutes] = useState<RouteResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchRoutes = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listRoutes(sessionId);
      setRoutes(data.routes);
    } catch (error) {
      console.error('Failed to load routes:', error);
      toast.error('Failed to load saved routes');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const handleDelete = async (routeId: number) => {
    if (!sessionId || !confirm('Delete this route?')) return;

    setDeletingId(routeId);
    try {
      await deleteRoute(routeId, sessionId);
      setRoutes((prev) => prev.filter((r) => r.route_id !== routeId));
      toast.success('Route deleted');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete route';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoad = async (routeId: number) => {
    try {
      const route = await getRoute(routeId);
      // Convert saved segments back to RouteSegmentData
      const segments: RouteSegmentData[] = route.segments.map((seg: Record<string, unknown>) => ({
        way_id: seg.way_id as number,
        name: (seg.name as string) || null,
        curvature: seg.curvature as number,
        length: seg.length as number,
        start: seg.start as [number, number],
        end: seg.end as [number, number],
        radius: seg.radius as number,
        curvature_level: seg.curvature_level as number,
        highway: (seg.highway as string) || null,
        surface: (seg.surface as string) || null,
        coordinates: [], // Will be empty for loaded routes since geometry comes from GeoJSON
      }));
      loadSegments(segments);
      toast.success(`Loaded "${route.route_name}"`);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load route';
      toast.error(message);
    }
  };

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/routes/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  if (loading) {
    return (
      <div className="py-6 text-center text-gray-400">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-2" />
        <p className="text-sm">Loading routes...</p>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="py-6 text-center text-gray-400">
        <p className="text-sm">Save a route to see it here</p>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="py-6 text-center text-gray-400">
        <p className="text-sm">No saved routes yet</p>
        <p className="text-xs mt-1">Build and save a route to see it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {routes.map((route) => (
        <div
          key={route.route_id}
          className="p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-start justify-between mb-1">
            <button
              onClick={() => handleLoad(route.route_id)}
              className="text-sm font-medium text-gray-800 hover:text-purple-600 text-left truncate flex-1"
            >
              {route.route_name}
            </button>
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              {route.is_public && (
                <button
                  onClick={() => handleCopyLink(route.url_slug)}
                  className="p-1 text-gray-400 hover:text-blue-500"
                  title="Copy share link"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => handleDelete(route.route_id)}
                disabled={deletingId === route.route_id}
                className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
                title="Delete route"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex gap-2 text-xs text-gray-500">
            <span>{route.segment_count} {route.route_type === 'waypoint' ? 'waypoints' : 'stops'}</span>
            <span>·</span>
            <span>{route.total_length_mi.toFixed(1)} mi</span>
            {route.route_type !== 'waypoint' && (
              <>
                <span>·</span>
                <span>{Math.round(route.total_curvature).toLocaleString()} curv</span>
              </>
            )}
          </div>

          {route.description && (
            <p className="text-xs text-gray-400 mt-1 truncate">{route.description}</p>
          )}

          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-400">
              {new Date(route.created_at).toLocaleDateString()}
            </p>
            {route.is_public && (
              <div className="flex gap-1">
                <a
                  href={getGpxExportUrl(route.url_slug)}
                  download
                  className="text-xs text-blue-500 hover:text-blue-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  GPX
                </a>
                <a
                  href={getKmlExportUrl(route.url_slug)}
                  download
                  className="text-xs text-blue-500 hover:text-blue-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  KML
                </a>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
