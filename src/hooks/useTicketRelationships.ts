import { useEffect, useState, useCallback } from 'react';
import api from '../api';
import type { TicketRelationship } from '../pages/Tickets/ticketTypes';

/**
 * Single shared fetch of a ticket's relationships, used by both the
 * Related Tickets panel and the parent-incident banner so the page doesn't
 * issue two separate requests for the same data.
 */
export function useTicketRelationships(ticketId: number, refreshSignal?: number) {
  const [relationships, setRelationships] = useState<TicketRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/tickets/${ticketId}/relationships`);
      setRelationships(data);
    } catch {
      setRelationships([]);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshSignal]);

  return { relationships, loading, refresh };
}
