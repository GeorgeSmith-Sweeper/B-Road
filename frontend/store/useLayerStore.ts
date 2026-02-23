import { create } from 'zustand';

interface LayerState {
  gasStationsVisible: boolean;
  toggleGasStations: () => void;
  evChargingVisible: boolean;
  toggleEvCharging: () => void;
}

export const useLayerStore = create<LayerState>((set) => ({
  gasStationsVisible: false,
  toggleGasStations: () => set((state) => ({ gasStationsVisible: !state.gasStationsVisible })),
  evChargingVisible: false,
  toggleEvCharging: () => set((state) => ({ evChargingVisible: !state.evChargingVisible })),
}));
