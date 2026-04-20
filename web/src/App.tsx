import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { JefeRoute } from '@/components/routing/JefeRoute';
import { ProtectedRoute } from '@/components/routing/ProtectedRoute';
import { Bitacora } from '@/pages/Bitacora';
import { Hoy } from '@/pages/Hoy';
import { Login } from '@/pages/Login';
import { Metricas } from '@/pages/Metricas';
import { MiSemana } from '@/pages/MiSemana';
import { Objetivos } from '@/pages/Objetivos';
import { Planificacion } from '@/pages/Planificacion';
import { Tablero } from '@/pages/Tablero';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/hoy" replace />} />
        <Route path="hoy" element={<Hoy />} />
        <Route path="semana" element={<MiSemana />} />
        <Route
          path="planificacion"
          element={
            <JefeRoute>
              <Planificacion />
            </JefeRoute>
          }
        />
        <Route path="tablero" element={<Tablero />} />
        <Route path="objetivos" element={<Objetivos />} />
        <Route path="bitacora" element={<Bitacora />} />
        <Route path="metricas" element={<Metricas />} />
      </Route>
      <Route path="*" element={<Navigate to="/hoy" replace />} />
    </Routes>
  );
}
