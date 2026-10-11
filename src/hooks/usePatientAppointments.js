import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPatientAppointment, getPatientAppointments } from '../services/appointmentService';

export default function usePatientAppointments(appointmentId) {
  const { user, token, isAuthenticated } = useAuth();
  const scope = `${user?.id || user?.userId || ''}:${token || ''}:${appointmentId ?? 'list'}`;
  const [state, setState] = useState({ scope, data: null, error: '', busy: true });
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    if (isAuthenticated === false) { setState({ scope, data: null, error: 'Please sign in to view your appointments.', busy: false }); return null; }
    setState(previous => ({ scope, data: previous.scope === scope ? previous.data : null, busy: true, error: '' }));
    try {
      const result = appointmentId === undefined ? await getPatientAppointments() : await getPatientAppointment(appointmentId);
      if (current === request.current) { setState({ scope, data: result, busy: false, error: '' }); return result; }
    } catch (failure) {
      if (current !== request.current) return null;
      const status = failure?.response?.status;
      const message = status === 404 ? 'Appointment not found.' : status === 401 ? 'Please sign in to view your appointments.' : status === 403 ? 'You do not have access to these appointments.' : 'Could not load appointment information. Please try again.';
      setState(previous => ({ scope, data: [401, 403, 404].includes(status) ? null : previous.scope === scope ? previous.data : null, error: message, busy: false }));
    }
    return null;
  }, [appointmentId, scope, isAuthenticated]);
  useEffect(() => { refresh(); return () => { request.current += 1; }; }, [refresh]);
  return { ...(state.scope === scope ? state : { data: null, error: '', busy: true }), refresh, scope };
}
