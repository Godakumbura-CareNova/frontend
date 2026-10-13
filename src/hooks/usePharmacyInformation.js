import { useCallback, useEffect, useState } from 'react';
import { getPharmacyInformation } from '../services/pharmacyInformationService';
export default function usePharmacyInformation(admin = false) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await getPharmacyInformation(admin)); }
    catch { setError('Unable to load pharmacy information. Please try again.'); }
    finally { setLoading(false); }
  }, [admin]);
  useEffect(() => { reload(); }, [reload]);
  return { data, setData, loading, error, reload };
}
