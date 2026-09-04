import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export const useEventCredits = () => {
  const { profile } = useAuth();
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.companyId) {
      setLoading(false);
      return;
    }
    const companyRef = doc(db, 'companies', profile.companyId);
    const unsub = onSnapshot(
      companyRef,
      (snap) => {
        const data = snap.data();
        // Field abhi kahi initialize nahi hai — missing ho to 0 maano
        setCredits(typeof data?.eventCredits === 'number' ? data.eventCredits : 0);
        setLoading(false);
      },
      (err) => {
        console.error('useEventCredits error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [profile?.companyId]);

  return { credits, loading };
};