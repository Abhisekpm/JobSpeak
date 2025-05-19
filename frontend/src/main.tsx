import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ThemeProvider as NextThemesProvider } from "next-themes"

// Get Client ID from environment variables
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

if (!googleClientId) {
  console.error("ERROR: VITE_GOOGLE_CLIENT_ID environment variable is not set.")
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  // Commenting out StrictMode temporarily for debugging
  // <React.StrictMode>
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem storageKey="vite-ui-theme" forcedTheme="light">
      <GoogleOAuthProvider clientId={googleClientId || ""}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </NextThemesProvider>
  // </React.StrictMode>,
  ,
)
