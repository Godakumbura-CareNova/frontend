import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { cancelAppointment, getAppointmentCancellationEligibility } from '../services/appointmentCancellationService';

export default function useAppointmentCancellation(appointmentId, onCancelled) {
  const { user, token, isAuthenticated } = useAuth();
  const scope = `${user?.id || user?.userId || ''}:${token || ''}:${appointmentId}`;
  const [state, setState] = useState({ scope, eligibility: null, result: null, loading: true, submitting: false, error: '', uncertain: false });
  const active = useRef(scope); active.current = scope;
  const request = useRef(0); const pending = useRef(false);
  const current = state.scope === scope ? state : { eligibility: null, result: null, loading: true, submitting: false, error: '', uncertain: false };
  const refresh = useCallback(async () => {
    const sequence = ++request.current;
    if (isAuthenticated === false) { setState({ scope, eligibility: null, result: null, loading: false, submitting: false, error: 'Please sign in to view cancellation information.' }); return; }
    setState(previous => ({ ...previous, scope, eligibility: previous.scope === scope ? previous.eligibility : null, result: previous.scope === scope ? previous.result : null, loading: true, error: '' }));
    try {
      const eligibility = await getAppointmentCancellationEligibility(appointmentId);
      if (active.current === scope && sequence === request.current) setState(previous => ({ ...previous, scope, eligibility, result: eligibility.cancellation || previous.result, loading: false, uncertain: false }));
    } catch (failure) {
      if (active.current !== scope || sequence !== request.current) return;
      const denied = [401, 403, 404].includes(failure?.response?.status);
      setState(previous => ({ ...previous, loading: false, eligibility: null, result: denied ? null : previous.result,
        error: denied ? 'Cancellation information is not available for this account.' : 'Could not load cancellation information. Please retry.' }));
    }
  }, [appointmentId, scope, isAuthenticated]);
  useEffect(() => { pending.current = false; active.current = scope; refresh(); return () => { request.current++; active.current = null; }; }, [refresh, scope]);
  const cancel = async (reason, acknowledgeNoRefund) => {
    if (pending.current || current.loading || current.error || current.uncertain || !current.eligibility?.allowed) return;
    pending.current = true;
    const generation = request.current;
    setState(previous => ({ ...previous, submitting: true, error: '' }));
    try {
      const result = await cancelAppointment(appointmentId, { expectedVersion: current.eligibility.version, reason: reason.trim() || null, acknowledgeNoRefund });
      if (active.current !== scope || request.current !== generation) return;
      setState(previous => ({ ...previous, result, submitting: false, uncertain: false }));
      onCancelled?.(result);
    } catch (failure) {
      if (active.current !== scope || request.current !== generation) return;
      const code = failure?.response?.status;
      const denied = [401, 403, 404].includes(code);
      setState(previous => ({ ...previous, submitting: false, eligibility: denied ? null : previous.eligibility, result: denied ? null : previous.result, uncertain: true,
        error: code === 409 ? 'Appointment or payment information changed. Refresh cancellation information and confirm again.' : code === 400 ? failure.response.data?.message || 'Cancellation is not permitted. Refresh cancellation information.' : denied ? 'You no longer have access to cancel this appointment.' : 'Could not confirm cancellation. Refresh to check its status before trying again.' }));
    } finally { if (active.current === scope && request.current === generation) pending.current = false; }
  };
  return { ...current, scope, refresh, cancel };
}
