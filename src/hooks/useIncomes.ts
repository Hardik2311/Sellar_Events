import { useState, useEffect } from 'react';
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Income {
  id: string;
  source: string;
  description: string;
  amount: number;
  date: number;
  createdAt: number;
  createdBy?: string;
}

export function useIncomes(companyId: string | undefined, eventId: string | undefined) {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !eventId) {
      setIncomes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'companies', companyId, 'events', eventId, 'incomes'),
      orderBy('date', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setIncomes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Income)));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [companyId, eventId]);

  const addIncome = async (
    companyId: string,
    eventId: string,
    data: Omit<Income, 'id' | 'createdAt'>,
  ) => {
    await addDoc(collection(db, 'companies', companyId, 'events', eventId, 'incomes'), {
      ...data,
      createdAt: Date.now(),
    });
  };

  const deleteIncome = async (companyId: string, eventId: string, id: string) => {
    await deleteDoc(doc(db, 'companies', companyId, 'events', eventId, 'incomes', id));
  };

  return { incomes, loading, error, addIncome, deleteIncome };
}