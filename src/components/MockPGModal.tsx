import React, { useState } from 'react';
import { CreditCard, Landmark, Smartphone, X, Lock, CheckCircle, Loader2 } from 'lucide-react';

interface MockPGModalProps {
  amount: number;
  onSuccess: (method: 'upi' | 'card' | 'netbanking') => void;
  onCancel: () => void;
}

const MockPGModal: React.FC<MockPGModalProps> = ({ amount, onSuccess, onCancel }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [method, setMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');

  const handleSimulatePayment = () => {
    setIsProcessing(true);
    // Simulate network delay for realism
    setTimeout(() => {
      onSuccess(method);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div 
        className="relative w-full max-w-md rounded-sm bg-white dark:bg-[#1E293B] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="bg-[#007A78] text-white p-1.5 rounded-sm">
              <Lock size={16} />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Secure Payment</h2>
          </div>
          <button 
            onClick={onCancel} 
            disabled={isProcessing}
            className="p-1.5 rounded-sm text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Amount Summary */}
        <div className="px-5 py-6 flex flex-col items-center justify-center border-b border-dashed border-gray-200 dark:border-slate-700">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total to Pay</span>
          <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
            ₹{amount.toFixed(2)}
          </span>
        </div>

        {/* Payment Methods */}
        <div className="px-5 py-5 space-y-3 flex-1 overflow-y-auto">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Select Payment Method</p>
          
          <label className={`flex cursor-pointer items-center justify-between rounded-sm border p-4 transition-all ${method === 'upi' ? 'border-[#007A78] bg-[#007A78]/5 dark:border-[#2DD4BF] dark:bg-[#2DD4BF]/10' : 'border-gray-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50'}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${method === 'upi' ? 'bg-[#007A78] text-white dark:bg-[#2DD4BF] dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                <Smartphone size={20} />
              </div>
              <span className="font-semibold text-slate-700 dark:text-slate-200">UPI / QR Code</span>
            </div>
            <input
              type="radio"
              name="pg_method"
              className="h-4 w-4 text-[#007A78] dark:text-[#2DD4BF]"
              checked={method === 'upi'}
              onChange={() => setMethod('upi')}
            />
          </label>

          <label className={`flex cursor-pointer items-center justify-between rounded-sm border p-4 transition-all ${method === 'card' ? 'border-[#007A78] bg-[#007A78]/5 dark:border-[#2DD4BF] dark:bg-[#2DD4BF]/10' : 'border-gray-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50'}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-sm ${method === 'card' ? 'bg-[#007A78] text-white dark:bg-[#2DD4BF] dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                <CreditCard size={20} />
              </div>
              <span className="font-semibold text-slate-700 dark:text-slate-200">Credit / Debit Card</span>
            </div>
            <input
              type="radio"
              name="pg_method"
              className="h-4 w-4 text-[#007A78] dark:text-[#2DD4BF]"
              checked={method === 'card'}
              onChange={() => setMethod('card')}
            />
          </label>

          <label className={`flex cursor-pointer items-center justify-between rounded-sm border p-4 transition-all ${method === 'netbanking' ? 'border-[#007A78] bg-[#007A78]/5 dark:border-[#2DD4BF] dark:bg-[#2DD4BF]/10' : 'border-gray-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50'}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-sm ${method === 'netbanking' ? 'bg-[#007A78] text-white dark:bg-[#2DD4BF] dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                <Landmark size={20} />
              </div>
              <span className="font-semibold text-slate-700 dark:text-slate-200">Netbanking</span>
            </div>
            <input
              type="radio"
              name="pg_method"
              className="h-4 w-4 text-[#007A78] dark:text-[#2DD4BF]"
              checked={method === 'netbanking'}
              onChange={() => setMethod('netbanking')}
            />
          </label>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={handleSimulatePayment}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 rounded-sm bg-[#007A78] py-4 text-sm font-bold text-white transition-all hover:bg-[#006361] dark:bg-[#2DD4BF] dark:text-slate-900 dark:hover:bg-[#22b8a5] disabled:opacity-70 shadow-md"
          >
            {isProcessing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>
                <CheckCircle size={18} />
                Simulate Payment Success
              </>
            )}
          </button>
          
          {!isProcessing && (
            <button
              onClick={onCancel}
              className="w-full mt-3 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              Cancel Payment
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MockPGModal;
