import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import BackButton from '../components/ui/BackButton';

import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Mail,
  Phone,
  MessageCircle,
  FileText,
  Send,
  Loader2,
  CheckCircle2
} from 'lucide-react';
// --- TYPES ---
interface AccordionItemProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onClick: () => void;
}

// --- REUSABLE ACCORDION COMPONENT ---
const AccordionItem: React.FC<AccordionItemProps> = ({ title, icon, children, isOpen, onClick }) => {
  return (
    <div className="border border-gray-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#1E293B] mb-3 overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md">
      <button
        onClick={onClick}
        className={`w-full flex items-center justify-between p-4 text-left transition-colors ${isOpen ? 'bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white' : 'bg-white dark:bg-[#1E293B] text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-gray-500 dark:text-slate-400">{icon}</span>}
          <span className="font-semibold text-sm sm:text-base">{title}</span>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400 dark:text-slate-500" /> : <ChevronDown className="w-5 h-5 text-gray-400 dark:text-slate-500" />}
      </button>

      <div
        className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        <div className="p-4 border-t border-gray-100 dark:border-slate-800 text-gray-600 dark:text-slate-400 text-sm leading-relaxed bg-white dark:bg-[#1E293B]">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
const SupportPage: React.FC = () => {
  const [openSection, setOpenSection] = useState<string | null>('faq-1');

  const [userProfile, setUserProfile] = useState({ fullName: '', email: '', phone: '' });
  const [formData, setFormData] = useState({ subject: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketRef, setTicketRef] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const fetchProfile = async () => {
      const companiesSnapshot = await getDocs(collection(db, "companies"));

      for (const companyDoc of companiesSnapshot.docs) {
        const userDoc = await getDoc(doc(db, "companies", companyDoc.id, "users", currentUser.uid));

        if (userDoc.exists()) {
          const data = userDoc.data();

          setUserProfile({
            fullName: data.name || currentUser.email || 'Unknown',
            email: currentUser.email || 'N/A',
            phone: data.phoneNumber || 'N/A',
          });
          break;
        }
      }
    };

    fetchProfile();
  }, []);

  const generateRefNumber = async () => {
    const counterRef = doc(db, "counters", "event_support_tickets");
    const counterSnap = await getDoc(counterRef);

    let nextNumber = 1;
    if (counterSnap.exists()) {
      nextNumber = (counterSnap.data().count || 0) + 1;
    }

    await setDoc(counterRef, { count: nextNumber });

    return `TKT-${String(nextNumber).padStart(4, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || !formData.description) {
      alert("Please fill all fields.");
      return;
    }
    setSubmitting(true);
    try {
      const refNumber = await generateRefNumber();
      await addDoc(collection(db, "event_support_tickets"), {
        referenceNumber: refNumber,
        fullName: userProfile.fullName,
        email: userProfile.email,
        phone: userProfile.phone,
        subject: formData.subject,
        description: formData.description,
        status: 'received',
        createdAt: serverTimestamp(),
      });
      setTicketRef(refNumber);
      setSubmitted(true);
      setFormData({ subject: '', description: '' });
    } catch (err) {
      alert("Failed to submit ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSection = (id: string) => {
    setOpenSection(prev => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F172A] pb-20">

      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] shadow-sm border-b border-gray-200 dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-between h-16 items-center">
            <BackButton />
            <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold text-gray-800 dark:text-white truncate max-w-[65%]">Help & Support</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-8">

        {/* --- SECTION 1: FAQ --- */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-4 ml-1">
            Frequently Asked Questions
          </h2>

          <AccordionItem
            title="How do I purchase credits for my events?"
            icon={<HelpCircle className="w-5 h-5" />}
            isOpen={openSection === 'faq-1'}
            onClick={() => toggleSection('faq-1')}
          >
            Go to the <Link to="/plans"><strong>Recharge & Buy Credits</strong></Link> page from your Account menu, select the credit pack that fits your event needs, and tap "Buy Now". Once payment is verified, credits are added to your wallet and get deducted per event you publish.
          </AccordionItem>

          <AccordionItem
            title="How do I create a new event?"
            icon={<HelpCircle className="w-5 h-5" />}
            isOpen={openSection === 'faq-2'}
            onClick={() => toggleSection('faq-2')}
          >
            From your Dashboard, tap <strong>"Create Event"</strong>, fill in the event details, and publish. You can edit event fields anytime from <strong>Discover Page</strong>.
          </AccordionItem>

          <AccordionItem
            title="How can I view or manage my attendees?"
            icon={<HelpCircle className="w-5 h-5" />}
            isOpen={openSection === 'faq-3'}
            onClick={() => toggleSection('faq-3')}
          >
            Open the <strong>Attendees</strong> tab from your Dashboard to see the full list of registrations, check-in status, and export attendee data for any of your events.
          </AccordionItem>

          <AccordionItem
            title="How do I reset my password?"
            icon={<HelpCircle className="w-5 h-5" />}
            isOpen={openSection === 'faq-4'}
            onClick={() => toggleSection('faq-4')}
          >
            Click "Forgot Password" on the login screen and follow the instructions sent to your registered email to reset your password.
          </AccordionItem>

          <AccordionItem
            title="Is my event and attendee data safe?"
            icon={<HelpCircle className="w-5 h-5" />}
            isOpen={openSection === 'faq-5'}
            onClick={() => toggleSection('faq-5')}
          >
            Absolutely. We use Google Firebase for secure cloud storage and authentication. Your event and attendee data is encrypted and backed up daily.
          </AccordionItem>
        </div>

        {/* --- SECTION 2: CONTACT --- */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 ml-1">
            Get in Touch
          </h2>

          <AccordionItem
            title="Contact Support Team"
            icon={<Phone className="w-5 h-5" />}
            isOpen={openSection === 'contact-1'}
            onClick={() => toggleSection('contact-1')}
          >
            <div className="space-y-4">
              <p>Our team is available Mon-Fri, 10 AM - 6 PM.</p>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-md border border-gray-100 dark:border-slate-700">
                <div className="bg-blue-100 dark:bg-blue-950 p-2 rounded-full text-blue-600 dark:text-blue-400">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase">Email Us</p>
                  <a href="mailto:sellarsuite@gmail.com" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">sellarsuite@gmail.com</a>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-md border border-gray-100 dark:border-slate-700">
                <div className="bg-green-100 dark:bg-green-950 p-2 rounded-full text-green-600 dark:text-green-400">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase">WhatsApp Support</p>
                  <a href="https://wa.me/919818815838" className="text-green-600 dark:text-green-400 font-medium hover:underline">+91 9818815838</a>
                </div>
              </div>
            </div>
          </AccordionItem>

          <AccordionItem
            title="Visit Our Office"
            icon={<FileText className="w-5 h-5" />}
            isOpen={openSection === 'contact-2'}
            onClick={() => toggleSection('contact-2')}
          >
            <p className="font-medium text-gray-800 dark:text-slate-100">Sellar HQ</p>
            <p>2nd Floor, Parsvnath Arcade, Unit 22, Vaibhav Khand</p>
            <p>Indirapuram, Ghaziabad, Uttar Pradesh 201014</p>
            <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">(Visits by appointment only)</p>
          </AccordionItem>
        </div>

        {/* --- SECTION 3: RAISE TICKET --- */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-4 ml-1">
            Report an Issue
          </h2>

          <div className="bg-white dark:bg-[#1E293B] p-4 rounded-lg border border-gray-200 dark:border-slate-800 shadow-sm">
            {submitted ? (
              <div className="flex flex-col items-center text-center gap-2 py-4">
                <div className="p-3 rounded-full bg-[#007A78]/10 dark:bg-[#2DD4BF]/15 text-[#007A78] dark:text-[#2DD4BF]">
                  <CheckCircle2 size={22} />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Ticket raised — {ticketRef}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                  Our team will get back to you shortly on your registered email/phone.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-2 text-xs font-semibold text-[#007A78] dark:text-[#2DD4BF] hover:underline"
                >
                  Raise another ticket
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-1">
                  <Send className="w-4 h-4 text-[#007A78] dark:text-[#2DD4BF]" />
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Raise a Support Ticket</span>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Briefly describe the issue"
                    className="w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Explain the issue in detail"
                    rows={4}
                    className="w-full rounded-sm border border-slate-200 dark:border-slate-700 bg-[#F9FAFB] dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-[#007A78] dark:focus:ring-[#2DD4BF] resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 flex items-center justify-center gap-2 rounded-sm bg-[#007A78] dark:bg-[#2DD4BF] py-2.5 text-sm font-semibold text-white dark:text-slate-950 hover:bg-[#006361] dark:hover:bg-[#22b8a5] disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SupportPage;