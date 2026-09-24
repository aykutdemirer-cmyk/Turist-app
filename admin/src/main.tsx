import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { RequireAdmin } from './components/Layout';
import { ToastProvider } from './components/ui';
import './index.css';
import { AuthCallback } from './pages/AuthCallback';
import { DeletionsPage } from './pages/DeletionsPage';
import { LoginPage } from './pages/LoginPage';
import { ReportsPage } from './pages/ReportsPage';

const router = createBrowserRouter([
  { path: '/auth/login', element: <LoginPage /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    path: '/admin',
    element: <RequireAdmin />,
    children: [
      { index: true, element: <Navigate to="reports" replace /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'deletions', element: <DeletionsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/admin" replace /> },
]);

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
