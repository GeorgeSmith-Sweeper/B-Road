'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Map from '@/components/Map';
import ChatInterface from '@/components/ChatInterface';
import RouteStats from '@/components/planner/RouteStats';
import SidebarFilters from '@/components/planner/SidebarFilters';
import WaypointList from '@/components/planner/WaypointList';
import SaveRouteModal from '@/components/planner/SaveRouteModal';
import { useAppStore } from '@/store/useAppStore';
import { useChatStore } from '@/store/useChatStore';
import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';
import { apiClient } from '@/lib/api';
import { getGpxExportUrl, getKmlExportUrl } from '@/lib/routes-api';
import { getDirectionsUrl } from '@/lib/google-maps';
import { ApiError } from '@/types';
import {
  Save,
  Share2,
  User,
  Plus,
  X,
  PanelLeft,
  MousePointerClick,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Planner() {
  const { setMapboxToken, initError, setInitError } = useAppStore();
  const { setCurvatureSources, setSourcesError } = useAppStore();
  const { setSearchResults } = useChatStore();
  const {
    waypoints,
    calculatedRoute,
    isCalculating,
    error: routeError,
    clearWaypoints,
    getWaypointCount,
  } = useWaypointRouteStore();

  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  // Sidebar toggle for mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Save route state
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  const waypointCount = getWaypointCount();

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

            <SidebarFilters sourcesLoading={sourcesLoading} />
          </div>

          {/* Waypoint List */}
          <WaypointList />

          {/* Route error */}
          {routeError && (
            <div className="px-5 py-2 bg-red-900/20 border-t border-red-800/30">
              <p className="font-cormorant text-xs italic text-red-400">{routeError}</p>
            </div>
          )}

          {/* Stats Row */}
          <RouteStats />

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
      <SaveRouteModal
        open={showSaveForm}
        onClose={() => setShowSaveForm(false)}
        onSaved={(slug) => setSavedSlug(slug)}
      />

      {/* Chat Interface (floating overlay) */}
      <ChatInterface onResultsReceived={setSearchResults} />
    </div>
  );
}
