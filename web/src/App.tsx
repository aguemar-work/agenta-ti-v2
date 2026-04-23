import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { JefeRoute } from '@/components/routing/JefeRoute';
import { ProtectedRoute } from '@/components/routing/ProtectedRoute';
import { SectionErrorBoundary } from '@/components/ui/SectionErrorBoundary';

const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));
const VerifyResetCode = lazy(() => import('@/pages/VerifyResetCode').then((m) => ({ default: m.VerifyResetCode })));
const ResetPassword = lazy(() => import('@/pages/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const Hoy = lazy(() => import('@/pages/Hoy').then((m) => ({ default: m.Hoy })));
const MiSemana = lazy(() => import('@/pages/MiSemana').then((m) => ({ default: m.MiSemana })));
const Planificacion = lazy(() => import('@/pages/Planificacion').then((m) => ({ default: m.Planificacion })));
const Tablero = lazy(() => import('@/pages/Tablero').then((m) => ({ default: m.Tablero })));
const Objetivos = lazy(() => import('@/pages/Objetivos').then((m) => ({ default: m.Objetivos })));
const Bitacora = lazy(() => import('@/pages/Bitacora').then((m) => ({ default: m.Bitacora })));
const Metricas = lazy(() => import('@/pages/Metricas').then((m) => ({ default: m.Metricas })));

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

function RouteWrapper({ children, label }: { children: React.ReactNode; label: string }) {
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
      <Route path="/login" element={<RouteWrapper label="Login"><Login /></RouteWrapper>} />
      <Route path="/forgot-password" element={<RouteWrapper label="Recuperar contraseña"><ForgotPassword /></RouteWrapper>} />
      <Route path="/verify-reset-code" element={<RouteWrapper label="Verificar código"><VerifyResetCode /></RouteWrapper>} />
      <Route path="/reset-password" element={<RouteWrapper label="Restablecer contraseña"><ResetPassword /></RouteWrapper>} />

      {/* Rutas protegidas */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/hoy" replace />} />
        <Route path="hoy" element={<RouteWrapper label="Hoy"><Hoy /></RouteWrapper>} />
        <Route path="semana" element={<RouteWrapper label="Mi semana"><MiSemana /></RouteWrapper>} />
        <Route
          path="planificacion"
          element={
            <JefeRoute>
              <RouteWrapper label="Planificación"><Planificacion /></RouteWrapper>
            </JefeRoute>
          }
        />
        <Route path="tablero" element={<RouteWrapper label="Tablero"><Tablero /></RouteWrapper>} />
        <Route path="objetivos" element={<RouteWrapper label="Objetivos"><Objetivos /></RouteWrapper>} />
        <Route path="bitacora" element={<RouteWrapper label="Bitácora"><Bitacora /></RouteWrapper>} />
        <Route path="metricas" element={<RouteWrapper label="Métricas"><Metricas /></RouteWrapper>} />
      </Route>

      <Route path="*" element={<Navigate to="/hoy" replace />} />
    </Routes>
  );
}