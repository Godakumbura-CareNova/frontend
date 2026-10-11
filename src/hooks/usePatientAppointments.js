import { useCallback, useEffect, useRef, useState } from 'react';
import { getPatientAppointment, getPatientAppointments } from '../services/appointmentService';

export default function usePatientAppointments(appointmentId) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    setBusy(true);
    setError('');
    try {
      const result = appointmentId === undefined ? await getPatientAppointments() : await getPatientAppointment(appointmentId);
      if (current === request.current) setData(result);
    } catch (failure) {
      if (current !== request.current) return;
      const status = failure?.response?.status;
      if ([401, 403, 404].includes(status)) setData(null);
      setError(status === 404 ? 'Appointment not found.' : status === 401 ? 'Please sign in to view your appointments.' : status === 403 ? 'You do not have access to these appointments.' : 'Could not load appointment information. Please try again.');
    } finally {
      if (current === request.current) setBusy(false);
    }
  }, [appointmentId]);
  useEffect(() => {
    setData(null);
    refresh();
    return () => { request.current += 1; };
  }, [refresh]);
  return { data, error, busy, refresh };
}
