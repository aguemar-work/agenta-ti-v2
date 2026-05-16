import { describe, expect, it, vi } from 'vitest';

import { Q_OT } from '@/hooks/useOrdenesTrabajoPage';
import { invalidateRelatedQueries } from '@/lib/queryHelpers';
import type { QueryClient } from '@tanstack/react-query';

describe('invalidación OT tras mutaciones', () => {
  it('el grupo ot invalida la misma queryKey que useOrdenesTrabajoPage', async () => {
    const qc = {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    } as unknown as QueryClient;

    await invalidateRelatedQueries(qc, ['ot']);

    expect(qc.invalidateQueries).toHaveBeenCalledWith({
      queryKey: [Q_OT],
      exact: false,
    });
  });
});
