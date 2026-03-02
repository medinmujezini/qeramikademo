/**
 * Furniture Context - Shared furniture state across tabs
 * 
 * Provides furniture items and operations to all furniture-related components.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useFurnitureState, type FurnitureStateHook } from '@/hooks/useFurnitureState';

const FurnitureContext = createContext<FurnitureStateHook | null>(null);

export const FurnitureProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const furnitureState = useFurnitureState();
  
  return (
    <FurnitureContext.Provider value={furnitureState}>
      {children}
    </FurnitureContext.Provider>
  );
};

export const useFurnitureContext = (): FurnitureStateHook => {
  const context = useContext(FurnitureContext);
  if (!context) {
    throw new Error('useFurnitureContext must be used within a FurnitureProvider');
  }
  return context;
};
