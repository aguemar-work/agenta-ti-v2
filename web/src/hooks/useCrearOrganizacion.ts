import { useMutation } from '@tanstack/react-query';

import { crearOrganizacion, type CrearOrgInput, type CrearOrgResult } from '@/api/organizacion';

export function useCrearOrganizacion(onSuccess?: (r: CrearOrgResult) => void) {
  return useMutation({
    mutationFn: (input: CrearOrgInput) => crearOrganizacion(input),
    ...(onSuccess ? { onSuccess } : {}),
  });
}
