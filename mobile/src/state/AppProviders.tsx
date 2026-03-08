import React from 'react';
import { LauncherItemsProvider } from './LauncherItemsContext';
import { ConnectionProvider } from './ConnectionContext';
import { ThemeProvider } from '../theme/ThemeContext';

export const AppProviders = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ConnectionProvider>
      <LauncherItemsProvider>{children}</LauncherItemsProvider>
    </ConnectionProvider>
  </ThemeProvider>
);
