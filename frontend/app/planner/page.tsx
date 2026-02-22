'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Map from '@/components/Map';
import ChatInterface from '@/components/ChatInterface';
import { useAppStore } from '@/store/useAppStore';
import { useChatStore } from '@/store/useChatStore';
import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';
import { apiClient } from '@/lib/api';
import { createSession, saveRoute, getGpxExportUrl, getKmlExportUrl } from '@/lib/routes-api';
import { getDirectionsUrl } from '@/lib/google-maps';
import { ApiError } from '@/types';
import type { Waypoint } from '@/types/routing';
import {
  Save,
  Share2,
  User,
  Plus,
  Search,
  GripVertical,
  MousePointerClick,
  X,
  PanelLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Planner() {
  const { setMapboxToken, initError, setInitError } = useAppStore();
  const {
    searchFilters,
    setSearchFilters,
    curvatureSources,
    setCurvatureSources,
    selectedSource,
    setSelectedSource,
    setSourcesError,
  } = useAppStore();
  const { setSearchResults } = useChatStore();
  const {
    waypoints,
    calculatedRoute,
    isCalculating,
    error: routeError,
    removeWaypoint,
    clearWaypoints,
    getTotalDistance,
    getTotalDuration,
    getWaypointCount,
    sessionId,
    setSessionId,
  } = useWaypointRouteStore();

  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  // Sidebar toggle for mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Save route state
  const [saving, setSaving] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  const totalDistance = getTotalDistance();
  const totalDuration = getTotalDuration();
  const waypointCount = getWaypointCount();

  // Format duration as Xh Xm
  const hours = Math.floor(totalDuration / 60);
  const minutes = Math.round(totalDuration % 60);
  const durationStr = hours > 0 ? `${hours}H ${minutes}M` : `${minutes}M`;

  // Initialize app
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
    return () => { cancelled = true; };
  }, [setMapboxToken, setInitError, retryCount]);

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

  useEffect(() => {
    if (!loading && !initError) loadSources();
  }, [loading, initError, loadSources]);

  const handleRetry = () => setRetryCount((c) => c + 1);

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
      await saveRoute(currentSessionId, {
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
      });
      toast.success(`Route "${routeName}" saved!`);
      setSavedSlug(routeName.trim().toLowerCase().replace(/\s+/g, '-'));
      setShowSaveForm(false);
      setRouteName('');
      setDescription('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save route');
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-accent-gold mx-auto mb-4" />
          <p className="font-bebas text-lg tracking-[2px] text-text-secondary">LOADING ROADRUNNER...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (initError) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <div className="bg-bg-card border border-border-subtle p-8 max-w-md text-center">
          <div className="text-accent-gold mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="font-bebas text-2xl tracking-[2px] text-text-primary mb-2">UNABLE TO CONNECT</h1>
          <p className="font-cormorant text-text-secondary italic mb-4">{initError.message}</p>
          <p className="font-cormorant text-sm text-text-muted italic mb-6">
            Please ensure the API server is running at{' '}
            <code className="bg-bg-muted px-1 text-accent-gold">
              {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}
            </code>
          </p>
          {initError.retryable && (
            <button
              onClick={handleRetry}
              className="font-bebas text-sm tracking-[2px] bg-accent-gold text-bg-primary px-6 py-2 hover:brightness-110 transition"
            >
              TRY AGAIN
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
      {/* ── Top Nav ── */}
      <nav className="flex items-center justify-between h-14 px-6 bg-bg-card border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-3 sm:gap-5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-text-secondary hover:text-text-primary transition-colors p-1"
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          <Link href="/" className="font-bebas text-[22px] tracking-[4px] text-accent-gold hover:brightness-110 transition">
            ROADRUNNER
          </Link>
          <div className="w-px h-6 bg-border-subtle hidden sm:block" />
          <span className="font-bebas text-base tracking-[3px] text-text-primary hidden sm:inline">ROUTE BUILDER</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Save button */}
          <button
            onClick={() => {
              if (waypointCount >= 2 && calculatedRoute) {
                setSavedSlug(null);
                setShowSaveForm(!showSaveForm);
              } else {
                toast('Add at least 2 waypoints to save a route', { icon: '\u2139\uFE0F' });
              }
            }}
            className="flex items-center gap-1.5 rounded bg-bg-muted border border-border-subtle px-4 py-2 font-bebas text-xs tracking-[2px] text-text-secondary hover:text-text-primary hover:border-text-secondary transition"
          >
            <Save className="w-3.5 h-3.5" />
            SAVE ROUTE
          </button>
          {/* Share button */}
          <button
            onClick={() => {
              if (savedSlug) {
                navigator.clipboard.writeText(window.location.href);
                toast.success('Link copied!');
              } else {
                toast('Save the route first to share it', { icon: '\u2139\uFE0F' });
              }
            }}
            className="flex items-center gap-1.5 rounded bg-accent-gold px-4 py-2 font-bebas text-xs tracking-[2px] text-bg-primary hover:brightness-110 transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            SHARE
          </button>
          {/* Profile icon */}
          <div className="w-8 h-8 rounded-full bg-bg-muted border border-accent-gold-dim flex items-center justify-center">
            <User className="w-4 h-4 text-text-secondary" />
          </div>
        </div>
      </nav>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Mobile sidebar overlay ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <aside className={`
          ${sidebarOpen ? 'fixed inset-y-0 left-0 z-40 w-[300px] sm:w-[340px] pt-14' : 'hidden'}
          md:relative md:flex md:w-[340px] md:pt-0
          flex-shrink-0 bg-bg-card border-r border-border-subtle flex flex-col
        `}>
          {/* Sidebar Header */}
          <div className="px-5 pt-5 pb-4 border-b border-border-subtle flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-bebas text-lg tracking-[3px] text-text-primary">WAYPOINTS</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast('Click on a road segment on the map to add waypoints', { icon: '\uD83D\uDCCD' })}
                  className="flex items-center gap-1.5 rounded bg-accent-gold px-3 py-1.5 font-bebas text-[11px] tracking-[2px] text-bg-primary hover:brightness-110 transition"
                >
                  <Plus className="w-3 h-3" />
                  ADD
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="md:hidden text-text-disabled hover:text-text-primary transition p-1"
                  aria-label="Close sidebar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Source filter as search-like bar */}
            <div className="flex items-center gap-2 h-9 rounded bg-bg-muted border border-border-subtle px-3">
              <Search className="w-3.5 h-3.5 text-text-disabled flex-shrink-0" />
              <select
                value={selectedSource || ''}
                onChange={(e) => setSelectedSource(e.target.value || null)}
                disabled={sourcesLoading}
                className="flex-1 bg-transparent text-sm font-cormorant italic text-text-disabled focus:text-text-secondary focus:outline-none appearance-none cursor-pointer"
              >
                <option value="">
                  {sourcesLoading ? 'Loading states...' : 'Filter by state...'}
                </option>
                {curvatureSources.map((source) => (
                  <option key={source.id} value={source.name} className="bg-bg-card text-text-primary">
                    {source.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} ({source.segment_count.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Curvature slider */}
            <div className="flex items-center gap-3">
              <span className="font-bebas text-[10px] tracking-[2px] text-text-disabled whitespace-nowrap">MIN CURV</span>
              <input
                type="range"
                min="0"
                max="5000"
                step="100"
                value={searchFilters.min_curvature}
                onChange={(e) => setSearchFilters({ min_curvature: parseInt(e.target.value) })}
                className="flex-1 accent-[#C9A962] h-1"
              />
              <span className="font-bebas text-sm tracking-[1px] text-accent-gold w-10 text-right">
                {searchFilters.min_curvature}
              </span>
            </div>
          </div>

          {/* Waypoint List */}
          <div className="flex-1 overflow-y-auto">
            {waypointCount === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-4">
                <MousePointerClick className="w-8 h-8 text-text-disabled" />
                <p className="font-cormorant text-sm italic text-text-disabled leading-relaxed">
                  Click on road segments on the map to add waypoints and build your route
                </p>
              </div>
            ) : (
              waypoints.map((wp: Waypoint, index: number) => (
                <div
                  key={wp.id}
                  className={`flex items-center gap-3.5 px-5 py-3.5 border-b border-border-subtle group hover:bg-bg-muted/50 transition ${
                    index === 0 ? 'bg-bg-muted' : ''
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bebas text-sm flex-shrink-0 ${
                      index < 3
                        ? 'bg-accent-gold text-bg-primary'
                        : 'border-2 border-accent-gold text-accent-gold'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="font-bebas text-[15px] tracking-[1px] text-text-primary truncate">
                      {wp.segmentName?.toUpperCase() || 'WAYPOINT'}
                    </span>
                    <span className="font-cormorant text-[13px] italic text-text-secondary">
                      {wp.lng.toFixed(4)}, {wp.lat.toFixed(4)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeWaypoint(wp.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-text-disabled hover:text-accent-gold"
                    title="Remove waypoint"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <GripVertical className="w-4 h-4 text-text-disabled flex-shrink-0" />
                </div>
              ))
            )}
          </div>

          {/* Route error */}
          {routeError && (
            <div className="px-5 py-2 bg-red-900/20 border-t border-red-800/30">
              <p className="font-cormorant text-xs italic text-red-400">{routeError}</p>
            </div>
          )}

          {/* Stats Row */}
          <div className="flex items-center justify-between bg-bg-muted px-5 py-4 border-t border-border-subtle">
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-bebas text-[22px] tracking-[1px] text-accent-gold">
                {calculatedRoute ? totalDistance.toFixed(1) : '0.0'}
              </span>
              <span className="font-bebas text-[10px] tracking-[2px] text-text-disabled">TOTAL MI</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-bebas text-[22px] tracking-[1px] text-accent-gold">
                {calculatedRoute ? durationStr : '0M'}
              </span>
              <span className="font-bebas text-[10px] tracking-[2px] text-text-disabled">EST. TIME</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-bebas text-[22px] tracking-[1px] text-accent-gold">{waypointCount}</span>
              <span className="font-bebas text-[10px] tracking-[2px] text-text-disabled">STOPS</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-bebas text-[22px] tracking-[1px] text-accent-gold">—</span>
              <span className="font-bebas text-[10px] tracking-[2px] text-text-disabled">ELEV. FT</span>
            </div>
          </div>

          {/* Action buttons */}
          {waypointCount > 0 && (
            <div className="px-5 py-3 border-t border-border-subtle flex flex-col gap-2">
              {calculatedRoute && waypointCount >= 2 && (
                <a
                  href={getDirectionsUrl(waypoints.map((wp) => [wp.lat, wp.lng]))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center font-bebas text-xs tracking-[2px] text-accent-gold border border-accent-gold-dim px-4 py-2 hover:bg-accent-gold hover:text-bg-primary transition"
                >
                  GET DIRECTIONS
                </a>
              )}
              {savedSlug && (
                <div className="flex gap-2">
                  <a
                    href={getGpxExportUrl(savedSlug)}
                    download
                    className="flex-1 text-center font-bebas text-[11px] tracking-[2px] text-text-secondary border border-border-subtle px-3 py-1.5 hover:text-text-primary hover:border-text-secondary transition"
                  >
                    EXPORT GPX
                  </a>
                  <a
                    href={getKmlExportUrl(savedSlug)}
                    download
                    className="flex-1 text-center font-bebas text-[11px] tracking-[2px] text-text-secondary border border-border-subtle px-3 py-1.5 hover:text-text-primary hover:border-text-secondary transition"
                  >
                    EXPORT KML
                  </a>
                </div>
              )}
              <button
                onClick={() => {
                  clearWaypoints();
                  setSavedSlug(null);
                  setShowSaveForm(false);
                }}
                className="font-bebas text-xs tracking-[2px] text-text-disabled hover:text-text-secondary transition"
              >
                CLEAR ALL
              </button>
            </div>
          )}
        </aside>

        {/* ── Map Area ── */}
        <div className="flex-1 relative">
          <Map />

          {/* Calculating indicator */}
          {isCalculating && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#1A1A1ACC] backdrop-blur-sm rounded-full px-4 py-2">
              <div className="w-3 h-3 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
              <span className="font-bebas text-xs tracking-[2px] text-accent-gold">CALCULATING ROUTE...</span>
            </div>
          )}

          {/* Hint bar */}
          {waypointCount === 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-[#1A1A1ACC] backdrop-blur-sm rounded-full px-6 h-9">
              <MousePointerClick className="w-3.5 h-3.5 text-accent-gold" />
              <span className="font-cormorant text-sm italic text-text-secondary">
                Click anywhere on the map to add a waypoint
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Save Form Modal */}
      {showSaveForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-border-subtle p-6 w-[calc(100%-2rem)] sm:w-[400px] mx-4 sm:mx-0 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-bebas text-lg tracking-[3px] text-text-primary">SAVE ROUTE</span>
              <button onClick={() => setShowSaveForm(false)} className="text-text-disabled hover:text-text-primary transition">
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
                onClick={() => setShowSaveForm(false)}
                className="px-6 font-bebas text-sm tracking-[2px] border border-border-subtle text-text-secondary py-2.5 hover:text-text-primary hover:border-text-secondary transition"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Interface (floating overlay) */}
      <ChatInterface onResultsReceived={setSearchResults} />
    </div>
  );
}
