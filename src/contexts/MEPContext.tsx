/**
 * MEP Context - Shared MEP state across tabs
 * 
 * Provides fixtures, routes, nodes, and operations to all MEP-related components.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useMEPState, type MEPStateHook } from '@/hooks/useMEPState';

const MEPContext = createContext<MEPStateHook | undefined>(undefined);

export const MEPProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const mepState = useMEPState();
  
  return (
    <MEPContext.Provider value={mepState}>
      {children}
    </MEPContext.Provider>
  );
};

export const useMEPContext = (): MEPStateHook => {
  const context = useContext(MEPContext);
  if (context === undefined) {
    throw new Error('useMEPContext must be used within an MEPProvider');
  }
  return context;
};
