'use client';

import { useState } from 'react';
import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';
import { createSession, saveRoute } from '@/lib/routes-api';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface SaveRouteModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (slug: string) => void;
}

export default function SaveRouteModal({ open, onClose, onSaved }: SaveRouteModalProps) {
  const { waypoints, calculatedRoute, getTotalCurvature, sessionId, setSessionId } =
    useWaypointRouteStore();

  const [saving, setSaving] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  if (!open) return null;

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
      onSaved(result.url_slug);
      onClose();
      setRouteName('');
      setDescription('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save route');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-subtle p-6 w-[calc(100%-2rem)] sm:w-[400px] mx-4 sm:mx-0 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="font-bebas text-lg tracking-[3px] text-text-primary">SAVE ROUTE</span>
          <button onClick={onClose} className="text-text-disabled hover:text-text-primary transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <input
          type="text"
          value={routeName}
          onChange={(e) => setRouteName(e.target.value)}
          placeholder="Route name"
          maxLength={255}
          className="w-full px-4 py-2.5 bg-bg-muted border border-border-subtle rounded text-sm font-cormorant italic text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent-gold-dim"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full px-4 py-2.5 bg-bg-muted border border-border-subtle rounded text-sm font-cormorant italic text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent-gold-dim resize-none"
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="w-3.5 h-3.5 accent-[#C9A962]"
          />
          <span className="font-cormorant text-sm italic text-text-secondary">Make public (shareable)</span>
        </label>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={!routeName.trim() || saving}
            className="flex-1 font-bebas text-sm tracking-[2px] bg-accent-gold text-bg-primary py-2.5 hover:brightness-110 disabled:opacity-50 transition"
          >
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
          <button
            onClick={onClose}
            className="px-6 font-bebas text-sm tracking-[2px] border border-border-subtle text-text-secondary py-2.5 hover:text-text-primary hover:border-text-secondary transition"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}
