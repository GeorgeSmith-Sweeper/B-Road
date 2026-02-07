'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useRouteStore } from '@/store/useRouteStore';
import { createSession, saveRoute } from '@/lib/routes-api';

interface SaveRouteDialogProps {
  onClose: () => void;
}

export default function SaveRouteDialog({ onClose }: SaveRouteDialogProps) {
  const { routeSegments, sessionId, setSessionId, clearRoute } = useRouteStore();

  const [routeName, setRouteName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!routeName.trim()) return;

    setSaving(true);
    try {
      // Ensure session exists
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const session = await createSession();
        currentSessionId = session.session_id;
        setSessionId(currentSessionId);
      }

      // Build segments payload
      const segments = routeSegments.map((seg) => ({
        way_id: seg.way_id,
        start: seg.start,
        end: seg.end,
        length: seg.length,
        radius: seg.radius,
        curvature: seg.curvature,
        curvature_level: seg.curvature_level,
        name: seg.name,
        highway: seg.highway,
        surface: seg.surface,
      }));

      await saveRoute(currentSessionId, {
        route_name: routeName.trim(),
        description: description.trim() || undefined,
        segments,
        is_public: isPublic,
      });

      toast.success(`Route "${routeName}" saved!`);
      clearRoute();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save route';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Save Route</h2>

        <div className="space-y-4">
          {/* Route Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Route Name *
            </label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="e.g., Vermont Mountain Loop"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              autoFocus
              maxLength={255}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of your route..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none"
              rows={3}
            />
          </div>

          {/* Public Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <span className="text-sm text-gray-700">Make this route public (shareable link)</span>
          </label>

          {/* Route Summary */}
          <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
            {routeSegments.length} segment{routeSegments.length !== 1 ? 's' : ''} ·{' '}
            {(routeSegments.reduce((s, seg) => s + seg.length, 0) / 1609.34).toFixed(1)} mi ·{' '}
            {Math.round(routeSegments.reduce((s, seg) => s + seg.curvature, 0)).toLocaleString()} curvature
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={!routeName.trim() || saving}
            className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {saving ? 'Saving...' : 'Save Route'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
