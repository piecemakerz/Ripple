import { createContext, useContext } from 'react';

export interface SampleGuide {
  step: number;
  atStep: boolean;
  evidenceNext?: { id: string; label: string; hint: string; disabled: boolean; run: () => void };
}
export const SampleGuideContext = createContext<SampleGuide | undefined>(undefined);
export const useSampleGuide = () => useContext(SampleGuideContext);
