import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/adminDashboardService';

const loaders = {
  users: api.getAdminUserDashboard, operations: api.getAdminOperationsDashboard, appointments: api.getAdminAppointmentDashboard,
  medicinePayments: api.getAdminMedicinePaymentDashboard, appointmentPayments: api.getAdminAppointmentPaymentDashboard,
};
export function useAdminDashboard() {
  const { user, token, isAuthenticated } = useAuth();
  const scope = user?.role === 'Admin' && token && isAuthenticated !== false ? `${user.userId ?? user.id ?? user.email ?? ''}:${token}` : '';
  const [state, setState] = useState({ scope: '', sections: {} });
  const sessionRef = useRef(null);
  useEffect(() => {
    const session = { active: true, scope, versions: {}, snapshots: {} };
    sessionRef.current = session;
    setState({ scope, sections: {} });
    session.load = async key => {
      if (!scope || !session.active || !loaders[key]) return;
      const version = session.versions[key] = (session.versions[key] ?? 0) + 1;
      const current = () => session.active && session.versions[key] === version;
      const publish = value => {
        if (!current()) return;
        session.snapshots[key] = value;
        setState(previous => previous.scope === scope ? { ...previous, sections: { ...previous.sections, [key]: value } } : previous);
      };
      const previous = session.snapshots[key];
      publish({ loading: true, data: previous?.data ?? null, error: null, stale: false, lastRefreshed: previous?.lastRefreshed ?? null });
      try {
        const data = await loaders[key]();
        publish({ loading: false, data, error: null, stale: false, lastRefreshed: new Date().toISOString() });
      } catch (failure) {
        if (!current()) return;
        if ([401, 403].includes(failure?.response?.status)) {
          session.active = false;
          setState({ scope, sections: Object.fromEntries(Object.keys(loaders).map(name => [name, { loading: false, data: null, stale: false,
            error: 'Access denied. Please sign in with an authorized admin account.', lastRefreshed: null }])) });
        } else publish({ loading: false, data: previous?.data ?? null, stale: !!previous?.data,
          error: 'This information is unavailable. Please retry.', lastRefreshed: previous?.lastRefreshed ?? null });
      }
    };
    if (scope) Object.keys(loaders).forEach(session.load);
    return () => { session.active = false; };
  }, [scope]);
  const refreshSection = useCallback(key => {
    const session = sessionRef.current;
    if (session?.scope === scope) return session.load(key);
  }, [scope]);
  const refreshAll = useCallback(() => Promise.all(Object.keys(loaders).map(refreshSection)), [refreshSection]);
  return { sections: scope && state.scope === scope ? state.sections : {}, refreshSection, refreshAll };
}
