/**
 * src/hooks/__tests__/useWorkspaceId.test.ts
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { useWorkspaceStore } from '@/store/workspaceStore';

beforeEach(() => {
  useWorkspaceStore.getState().reset();
});

describe('useWorkspaceId', () => {
  it('sin workspace activo, devuelve null', () => {
    const { result } = renderHook(() => useWorkspaceId());

    expect(result.current).toBeNull();
  });

  it('con workspace activo, devuelve su id', () => {
    useWorkspaceStore.setState({
      workspaceActivo: { id: 'ws-1', organizacion_id: 'org-1', nombre: 'WS', activo: true },
    });

    const { result } = renderHook(() => useWorkspaceId());

    expect(result.current).toBe('ws-1');
  });
});
