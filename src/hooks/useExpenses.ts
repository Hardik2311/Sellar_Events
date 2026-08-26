import { useState, useEffect } from 'react';
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Expense {
  id: string;
  title: string;
  description: string;
  amount: number;
  date: number;
  createdAt: number;
  createdBy?: string;
}

export function useExpenses(companyId: string | undefined, eventId: string | undefined) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !eventId) {
      setExpenses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'companies', companyId, 'events', eventId, 'expenses'),
      orderBy('date', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [companyId, eventId]);

  const addExpense = async (
    companyId: string,
    eventId: string,
    data: Omit<Expense, 'id' | 'createdAt'>,
  ) => {
    await addDoc(collection(db, 'companies', companyId, 'events', eventId, 'expenses'), {
      ...data,
      createdAt: Date.now(),
    });
  };

  const deleteExpense = async (companyId: string, eventId: string, id: string) => {
    await deleteDoc(doc(db, 'companies', companyId, 'events', eventId, 'expenses', id));
  };

  return { expenses, loading, error, addExpense, deleteExpense };
}