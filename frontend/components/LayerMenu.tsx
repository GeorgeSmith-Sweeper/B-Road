'use client';

import { useEffect, useRef } from 'react';
import { Fuel, Zap } from 'lucide-react';
import { useLayerStore } from '@/store/useLayerStore';

interface LayerMenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export default function LayerMenu({ open, onClose, anchorRef }: LayerMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const gasStationsVisible = useLayerStore((s) => s.gasStationsVisible);
  const toggleGasStations = useLayerStore((s) => s.toggleGasStations);
  const evChargingVisible = useLayerStore((s) => s.evChargingVisible);
  const toggleEvCharging = useLayerStore((s) => s.toggleEvCharging);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-2 w-52 bg-bg-card border border-border-subtle rounded-md shadow-lg overflow-hidden z-20"
    >
      <div className="px-3 py-2 border-b border-border-subtle">
        <span className="font-bebas text-[11px] tracking-[1px] text-text-secondary">
          MAP LAYERS
        </span>
      </div>

      <button
        onClick={toggleGasStations}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-muted transition text-left"
      >
        <Fuel className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="font-bebas text-[12px] tracking-[0.5px] text-text-primary flex-1">
          GAS STATIONS
        </span>
        <span
          className={`w-4 h-4 rounded border flex items-center justify-center transition ${
            gasStationsVisible
              ? 'bg-emerald-400 border-emerald-400'
              : 'border-border-subtle'
          }`}
        >
          {gasStationsVisible && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="#0D0D0D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </button>

      <button
        onClick={toggleEvCharging}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-muted transition text-left"
      >
        <Zap className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="font-bebas text-[12px] tracking-[0.5px] text-text-primary flex-1">
          EV CHARGING
        </span>
        <span
          className={`w-4 h-4 rounded border flex items-center justify-center transition ${
            evChargingVisible
              ? 'bg-blue-400 border-blue-400'
              : 'border-border-subtle'
          }`}
        >
          {evChargingVisible && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="#0D0D0D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}
