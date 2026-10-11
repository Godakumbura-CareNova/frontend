import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/roleDashboardService';

const loaders = {
  Patient: { orders: api.getPatientOrderDashboard, medicinePayments: api.getPatientMedicinePaymentDashboard, appointments: api.getPatientAppointmentDashboard },
  PharmacyStaff: { operations: api.getStaffOperationsDashboard, medicinePayments: api.getStaffMedicinePaymentDashboard, appointmentPayments: api.getStaffAppointmentPaymentDashboard },
};
export function useRoleDashboard(role) {
  const { user, token } = useAuth();
  const userRole = user?.role === 'User' ? 'Patient' : user?.role === 'Pharmacy Staff' ? 'PharmacyStaff' : user?.role;
  const scope = user && token && userRole === role ? `${role}:${user.userId ?? user.id ?? user.email ?? ''}:${token}` : '';
  const [state, setState] = useState({ scope: '', sections: {} });
  const sessionRef = useRef(null);

  useEffect(() => {
    const session = { active: true, scope, versions: {}, load: null };
    sessionRef.current = session;
    setState({ scope, sections: {} });
    const load = async key => {
      if (!session.active || !scope || !loaders[role]?.[key]) return;
      const version = session.versions[key] = (session.versions[key] ?? 0) + 1;
      const current = () => session.active && session.versions[key] === version;
      const publish = value => { if (current()) setState(previous => previous.scope === scope
        ? { ...previous, sections: { ...previous.sections, [key]: value } } : previous); };
      publish({ loading: true, data: null, error: null, lastRefreshed: null });
      try {
        const data = await loaders[role][key]();
        publish({ loading: false, data, error: null, lastRefreshed: new Date().toISOString() });
      } catch {
        publish({ loading: false, data: null, error: 'This information is unavailable. Please retry.', lastRefreshed: null });
      }
    };
    session.load = load;
    if (scope) Object.keys(loaders[role] ?? {}).forEach(load);
    return () => { session.active = false; };
  }, [scope, role]);

  const refreshSection = useCallback(key => {
    const session = sessionRef.current;
    if (session?.scope === scope) session.load?.(key);
  }, [scope]);
  const refreshAll = useCallback(() => Object.keys(loaders[role] ?? {}).forEach(refreshSection), [role, refreshSection]);
  return { sections: scope && state.scope === scope ? state.sections : {}, refreshSection, refreshAll };
}
