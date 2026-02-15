import { create } from 'zustand';
import type { CurvyRouteOptions, CurvyRouteResult } from '@/types/routing';

interface CurvyRouteState {
  startPoint: { lng: number; lat: number } | null;
  endPoint: { lng: number; lat: number } | null;
  pickingMode: 'start' | 'end' | null;
  options: CurvyRouteOptions;
  result: CurvyRouteResult | null;
  isCalculating: boolean;
  error: string | null;

  setStartPoint: (lng: number, lat: number) => void;
  setEndPoint: (lng: number, lat: number) => void;
  setPickingMode: (mode: 'start' | 'end' | null) => void;
  setOptions: (partial: Partial<CurvyRouteOptions>) => void;
  clearAll: () => void;
  setResult: (result: CurvyRouteResult | null) => void;
  setIsCalculating: (calculating: boolean) => void;
  setError: (error: string | null) => void;
}

const DEFAULT_OPTIONS: CurvyRouteOptions = {
  corridor_width: 15000,
  min_curvature: 500,
  min_segment_length: 500,
  max_waypoints: 20,
  max_detour_ratio: 2.5,
};

export const useCurvyRouteStore = create<CurvyRouteState>((set) => ({
  startPoint: null,
  endPoint: null,
  pickingMode: null,
  options: { ...DEFAULT_OPTIONS },
  result: null,
  isCalculating: false,
  error: null,

  setStartPoint: (lng, lat) => set({ startPoint: { lng, lat }, pickingMode: null }),
  setEndPoint: (lng, lat) => set({ endPoint: { lng, lat }, pickingMode: null }),
  setPickingMode: (mode) => set({ pickingMode: mode }),
  setOptions: (partial) =>
    set((state) => ({ options: { ...state.options, ...partial } })),
  clearAll: () =>
    set({
      startPoint: null,
      endPoint: null,
      pickingMode: null,
      result: null,
      isCalculating: false,
      error: null,
    }),
  setResult: (result) => set({ result, isCalculating: false }),
  setIsCalculating: (calculating) => set({ isCalculating: calculating }),
  setError: (error) => set({ error, isCalculating: false }),
}));
