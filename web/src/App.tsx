import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { JefeRoute } from '@/components/routing/JefeRoute';
import { ProtectedRoute } from '@/components/routing/ProtectedRoute';
import { SectionErrorBoundary } from '@/components/ui/SectionErrorBoundary';

const Login          = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));
const VerifyResetCode = lazy(() => import('@/pages/VerifyResetCode').then((m) => ({ default: m.VerifyResetCode })));
const ResetPassword  = lazy(() => import('@/pages/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const MiSemana       = lazy(() => import('@/pages/MiSemana').then((m) => ({ default: m.MiSemana })));
const Planificacion  = lazy(() => import('@/pages/Planificacion').then((m) => ({ default: m.Planificacion })));
const Objetivos      = lazy(() => import('@/pages/Objetivos').then((m) => ({ default: m.Objetivos })));
const Metricas       = lazy(() => import('@/pages/Metricas').then((m) => ({ default: m.Metricas })));
const OrdenesTrabajo = lazy(() => import('@/pages/OrdenesTrabajo').then((m) => ({ default: m.OrdenesTrabajo })));

function PageSpinner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: 'var(--mc-color-text-secondary)', fontSize: '14px',
    }}>
      Cargando…
    </div>
  );
}

function RouteWrapper({ children, label }: { children: ReactNode; label: string }) {
  const { pathname } = useLocation();
  return (
    <SectionErrorBoundary label={label} resetKey={pathname}>
      <Suspense fallback={<PageSpinner />}>
        {children}
      </Suspense>
    </SectionErrorBoundary>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login"             element={<RouteWrapper label="Login"><Login /></RouteWrapper>} />
      <Route path="/forgot-password"   element={<RouteWrapper label="Recuperar contraseña"><ForgotPassword /></RouteWrapper>} />
      <Route path="/verify-reset-code" element={<RouteWrapper label="Verificar código"><VerifyResetCode /></RouteWrapper>} />
      <Route path="/reset-password"    element={<RouteWrapper label="Restablecer contraseña"><ResetPassword /></RouteWrapper>} />

      {/* Rutas protegidas */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/semana" replace />} />
        <Route path="semana"         element={<RouteWrapper label="Mi semana"><MiSemana /></RouteWrapper>} />
        <Route path="objetivos"      element={<RouteWrapper label="Objetivos"><Objetivos /></RouteWrapper>} />
        <Route path="ordenes-trabajo" element={<RouteWrapper label="Órdenes de trabajo"><OrdenesTrabajo /></RouteWrapper>} />

        <Route path="planificacion" element={
          <JefeRoute>
            <RouteWrapper label="Planificación"><Planificacion /></RouteWrapper>
          </JefeRoute>
        } />
        <Route path="metricas" element={
          <JefeRoute>
            <RouteWrapper label="Métricas"><Metricas /></RouteWrapper>
          </JefeRoute>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/semana" replace />} />
    </Routes>
  );
}