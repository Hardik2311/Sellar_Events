import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
}

export function useTeamMembers(companyId: string | undefined) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'companies', companyId, 'users'), orderBy('name', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() } as TeamMember)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [companyId]);

  return { members, loading };
}