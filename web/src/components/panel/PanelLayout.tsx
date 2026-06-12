import { Outlet } from 'react-router-dom';

import { PanelNav } from '@/components/panel/PanelNav';

/** Layout del panel dueño: sub-navegación + rutas hijas. */
export function PanelLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <PanelNav />
      <Outlet />
    </div>
  );
}
