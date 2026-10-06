import React, {createContext, useContext} from 'react';
import type {AdSpec} from './spec';
import type {Theme} from './theme';

type Ctx = {spec: AdSpec; theme: Theme};
const AdContext = createContext<Ctx | null>(null);

export const AdProvider: React.FC<Ctx & {children: React.ReactNode}> = ({spec, theme, children}) => (
  <AdContext.Provider value={{spec, theme}}>{children}</AdContext.Provider>
);

export const useAd = () => {
  const ctx = useContext(AdContext);
  if (!ctx) throw new Error('useAd() must be used inside <AdProvider>');
  return ctx;
};
