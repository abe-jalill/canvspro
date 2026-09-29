/** Tracks the last confirmed value while multiple edits are queued for a field. */
export function createOptimisticWrites() {
  type State = { version: number; pending: number; confirmed: unknown };
  const states = new Map<string, State>();
  return {
    start(key: string, previous: unknown) {
      const state = states.get(key) ?? { version: 0, pending: 0, confirmed: previous };
      state.pending++;
      state.version++;
      states.set(key, state);
      return { key, state, version: state.version };
    },
    commit(ticket: { state: State }, value: unknown) { ticket.state.confirmed = value; },
    rollback(ticket: { state: State; version: number }) {
      return { apply: ticket.state.version === ticket.version, value: ticket.state.confirmed };
    },
    finish(ticket: { key: string; state: State }) {
      if (--ticket.state.pending === 0 && states.get(ticket.key) === ticket.state) states.delete(ticket.key);
    },
  };
}
