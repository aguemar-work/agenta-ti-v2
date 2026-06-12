import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { DefaultHomeRedirect } from '@/components/routing/ModoContextoGuard';
import { PanelLayout } from '@/components/panel/PanelLayout';
import { PanelRoute } from '@/components/routing/PanelRoute';
import { usePageAnalytics } from '@/hooks/usePageAnalytics';
import { JefeRoute } from '@/components/routing/JefeRoute';
import { ProtectedRoute } from '@/components/routing/ProtectedRoute';
import { SectionErrorBoundary } from '@/components/ui/SectionErrorBoundary';
import { WorkspaceProvider } from '@/providers/WorkspaceProvider';

const Login          = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));
const VerifyResetCode = lazy(() => import('@/pages/VerifyResetCode').then((m) => ({ default: m.VerifyResetCode })));
const ResetPassword  = lazy(() => import('@/pages/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const Privacidad     = lazy(() => import('@/pages/Privacidad').then((m) => ({ default: m.Privacidad })));
const MiSemana       = lazy(() => import('@/pages/MiSemana').then((m) => ({ default: m.MiSemana })));
const Planificacion  = lazy(() => import('@/pages/Planificacion').then((m) => ({ default: m.Planificacion })));
const Objetivos      = lazy(() => import('@/pages/Objetivos').then((m) => ({ default: m.Objetivos })));
const OrdenesTrabajo = lazy(() => import('@/pages/OrdenesTrabajo').then((m) => ({ default: m.OrdenesTrabajo })));
const Metricas       = lazy(() => import('@/pages/Metricas').then((m) => ({ default: m.Metricas })));
const Clientes       = lazy(() => import('@/pages/Clientes').then((m) => ({ default: m.Clientes })));
const Proyectos      = lazy(() => import('@/pages/Proyectos').then((m) => ({ default: m.Proyectos })));
const Areas          = lazy(() => import('@/pages/Areas').then((m) => ({ default: m.Areas })));
const PanelPrincipal = lazy(() => import('@/pages/PanelPrincipal').then((m) => ({ default: m.PanelPrincipal })));
const PanelUsuarios  = lazy(() => import('@/pages/PanelUsuarios').then((m) => ({ default: m.PanelUsuarios })));

function PageSpinner() {
  return <div className="mc-page-loading">Cargando…</div>;
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
  usePageAnalytics();

  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login"             element={<RouteWrapper label="Login"><Login /></RouteWrapper>} />
      <Route path="/forgot-password"   element={<RouteWrapper label="Recuperar contraseña"><ForgotPassword /></RouteWrapper>} />
      <Route path="/verify-reset-code" element={<RouteWrapper label="Verificar código"><VerifyResetCode /></RouteWrapper>} />
      <Route path="/reset-password"    element={<RouteWrapper label="Restablecer contraseña"><ResetPassword /></RouteWrapper>} />
      <Route path="/privacidad"        element={<RouteWrapper label="Privacidad"><Privacidad /></RouteWrapper>} />

      {/* Rutas protegidas */}
      <Route
        element={
          <ProtectedRoute>
            <WorkspaceProvider>
              <AppShell />
            </WorkspaceProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<DefaultHomeRedirect />} />
        <Route
          path="panel"
          element={
            <PanelRoute>
              <RouteWrapper label="Panel"><PanelLayout /></RouteWrapper>
            </PanelRoute>
          }
        >
          <Route index element={<RouteWrapper label="Organizaciones"><PanelPrincipal /></RouteWrapper>} />
          <Route path="usuarios" element={<RouteWrapper label="Usuarios"><PanelUsuarios /></RouteWrapper>} />
        </Route>
        <Route path="semana"         element={<RouteWrapper label="Mi semana"><MiSemana /></RouteWrapper>} />
        <Route path="objetivos"      element={<RouteWrapper label="Objetivos"><Objetivos /></RouteWrapper>} />
        <Route path="ordenes-trabajo" element={<RouteWrapper label="Órdenes de trabajo"><OrdenesTrabajo /></RouteWrapper>} />
        <Route path="clientes"       element={<RouteWrapper label="Clientes"><Clientes /></RouteWrapper>} />
        <Route path="proyectos"      element={<RouteWrapper label="Proyectos"><Proyectos /></RouteWrapper>} />
        <Route path="areas"          element={<RouteWrapper label="Áreas"><Areas /></RouteWrapper>} />

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

      <Route path="*" element={<DefaultHomeRedirect />} />
    </Routes>
  );
}