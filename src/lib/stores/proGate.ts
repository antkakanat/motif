import { writable } from 'svelte/store';
import type { ProFeature } from '$lib/pro';

export interface ProGateModalState {
  open: boolean;
  feature: ProFeature | null;
  featureLabel: string;
}

const initialState: ProGateModalState = {
  open: false,
  feature: null,
  featureLabel: ''
};

export const proGateModal = writable<ProGateModalState>(initialState);

let pendingResolver: ((allowed: boolean) => void) | null = null;

export function openProGateModal(feature: ProFeature, featureLabel: string): Promise<boolean> {
  if (pendingResolver) {
    pendingResolver(false);
  }

  return new Promise<boolean>((resolve) => {
    pendingResolver = resolve;
    proGateModal.set({
      open: true,
      feature,
      featureLabel
    });
  });
}

export function resolveProGateModal(allowed: boolean): void {
  const resolver = pendingResolver;
  pendingResolver = null;
  proGateModal.set(initialState);
  resolver?.(allowed);
}
