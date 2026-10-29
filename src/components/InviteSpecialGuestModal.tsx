import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { EventSummary } from '../types/event.types';
import { createSpecialGuest } from '../lib/ticketing';

const CATEGORIES = ['Artist', 'Chief Guest', 'Speaker', 'Sponsor', 'VIP', 'Friend / Family', 'Team', 'Other'];

interface Props {
    isOpen: boolean;
    onClose: () => void;
    event: EventSummary | null;
    companyId?: string;
    onSuccess: (guest: {
        name: string; email: string; phone: string;
        ticketId: string; tierName: string; guestCategory: string;
    }) => void;
}

const InviteSpecialGuestModal: React.FC<Props> = ({ isOpen, onClose, event, companyId, onSuccess }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [customCategory, setCustomCategory] = useState('');
    const [tierId, setTierId] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen || !event) return null;
    const effectiveTierId = tierId || event.tiers[0]?.id || '';

    const reset = () => { setName(''); setPhone(''); setEmail(''); setCategory(CATEGORIES[0]); setCustomCategory(''); setTierId(''); setError(''); };

    const handleSave = async () => {
        if (!companyId) return;
        if (!name.trim()) { setError('Guest name is required.'); return; }
            if (!/^\d{10}$/.test(phone.trim())) { setError('Phone number must be exactly 10 digits.'); return; }
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }
        const finalCategory = category === 'Other' ? customCategory.trim() : category;
            if (!finalCategory) { setError('Please enter a category (e.g. Anchor, Photographer).'); return; }
        setSaving(true);
        setError('');
        try {
            const res = await createSpecialGuest({
                companyId,
                eventId: event.id,
                eventTitle: event.title,
                tierId: effectiveTierId,
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
                guestCategory: finalCategory,
            });
            onSuccess({ name: name.trim(), email: email.trim(), phone: phone.trim(), guestCategory: finalCategory, ...res });
            reset();
            onClose();
        } catch (e: any) {
            setError(e?.message || 'Could not add guest, please retry.');
        } finally {
            setSaving(false);
        }
    };

    const inputCls =
        'w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none';

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
            <div className="relative w-full sm:max-w-md rounded-sm bg-white dark:bg-slate-900 p-4 shadow-xl">
                <button onClick={onClose} className="absolute right-3 top-3 p-1.5 text-slate-500" aria-label="Close">
                    <X size={16} />
                </button>
                <h2 className="mb-3 text-base font-extrabold text-slate-900 dark:text-white">Invite Special Guest</h2>
                <div className="flex flex-col gap-2.5">
                    <input className={inputCls} placeholder="Guest name *" value={name} onChange={(e) => setName(e.target.value)} />
                    <input
                        className={inputCls}
                        placeholder="Phone (10 digit) *"
                        value={phone}
                        inputMode="numeric"
                        maxLength={10}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    />
                    <input
                        className={inputCls}
                        type="email"
                        inputMode="email"
                        placeholder="Email *"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <select
                            className={`${inputCls} min-w-0 flex-1`}
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {category === 'Other' && (
                            <input
                                className={`${inputCls} min-w-0 flex-1`}
                                placeholder="Custom category"
                                value={customCategory}
                                onChange={(e) => setCustomCategory(e.target.value)}
                                maxLength={30}
                                autoFocus
                            />
                        )}
                    </div>
                    <select className={inputCls} value={effectiveTierId} onChange={(e) => setTierId(e.target.value)}>
                        {event.tiers.map((t) => (
                            <option key={t.id} value={t.id}>{t.name} ({t.sold}/{t.total} sold)</option>
                        ))}
                    </select>
                    {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-sm bg-[#007A78] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50 dark:bg-[#2DD4BF] dark:text-slate-950"
                    >
                        {saving ? 'Adding…' : 'Add Special Guest'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InviteSpecialGuestModal;