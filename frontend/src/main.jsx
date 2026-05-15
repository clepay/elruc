import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { HelmetProvider } from 'react-helmet-async';
import ReactGA from 'react-ga4';
import './index.css'
import App from './App.jsx'
import theme from './theme.js';

const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
if (gaId) {
  ReactGA.initialize(gaId);
  ReactGA.send({ hitType: 'pageview', page: window.location.pathname + window.location.search });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
          </BrowserRouter>
        </LocalizationProvider>
      </ThemeProvider>
    </HelmetProvider>
  </StrictMode>,
)
