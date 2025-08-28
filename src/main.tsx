import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider, CssBaseline } from '@mui/material'
import theme from "./theme.tsx";
import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'

// Create Emotion cache with explicit insertion point for stable style order in production
const insertionPoint = document.querySelector<HTMLMetaElement>('meta[name="emotion-insertion-point"]') ?? undefined;
const muiCache = createCache({ key: 'mui', insertionPoint });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CacheProvider value={muiCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </CacheProvider>
  </StrictMode>,
)
