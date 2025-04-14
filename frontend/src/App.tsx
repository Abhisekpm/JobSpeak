import React from 'react';
import { Toaster } from './components/ui/toaster';
import AppRoutes from './AppRoutes'; // Import the AppRoutes component

// Simple ThemeProvider since the original can't be found
// Note: Your main.tsx already uses NextThemesProvider, 
// so this ThemeProvider might be redundant or conflicting. 
// Consider removing it if NextThemesProvider handles everything.
const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return <div className="app-theme">{children}</div>;
};

function App() {
  return (
    <ThemeProvider> {/* Consider removing this if NextThemesProvider is sufficient */}
      {/* AuthProvider is now only in main.tsx */}
      <AppRoutes /> {/* Render the AppRoutes component */} 
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
