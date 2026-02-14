import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sentry } from './sentry';
import './i18n';
import App from './App';
import './index.css';

// Global handler for uncaught promise rejections — prevents silent failures
window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason);
  if (import.meta.env.DEV) {
    console.error('[unhandledrejection]', event.reason);
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
