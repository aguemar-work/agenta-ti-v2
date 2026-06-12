import { describe, expect, it, vi, beforeEach } from 'vitest';

import { Q_OT } from '@/hooks/useOrdenesTrabajoPage';
import { invalidateRelatedQueries } from '@/lib/queryHelpers';
import type { QueryClient } from '@tanstack/react-query';

const WS_ID = 'ws-test-uuid';

vi.mock('@/store/workspaceStore', () => ({
  getWorkspaceId: () => WS_ID,
}));

describe('invalidación OT tras mutaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('el grupo ot invalida la misma queryKey que useOrdenesTrabajoPage', async () => {
    const qc = {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    } as unknown as QueryClient;

    await invalidateRelatedQueries(qc, ['ot']);

    expect(qc.invalidateQueries).toHaveBeenCalledWith({
      queryKey: [Q_OT, WS_ID],
      exact: false,
    });
  });
});
