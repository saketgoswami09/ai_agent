'use client';

import { useState } from 'react';
import { Phone, ShieldCheck, Loader2, ChevronLeft, ArrowRight } from 'lucide-react';

export default function LoginForm() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendOtp = async () => {
    if (!phone.trim()) return setError('Please enter a phone number');
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone }),
      });
      if (res.ok) setStep('OTP');
      else setError('Failed to send code. Check format.');
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone, otp }),
      });
      if (res.ok) window.location.href = '/dashboard';
      else setError('Invalid verification code');
    } catch (err) {
      setError('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4 bg-white">
      <div className="w-full max-w-md bg-white border border-gray-100 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-gray-200/50 transition-all duration-500">
        
        {/* 🏆 Header Section */}
        <header className="text-center mb-10">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-indigo-200 animate-in fade-in zoom-in duration-500">
            {step === 'PHONE' ? <Phone size={24} /> : <ShieldCheck size={24} />}
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tighter mb-2">
            {step === 'PHONE' ? 'Sign In' : 'Verify Identity'}
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            {step === 'PHONE' 
              ? 'Enter your mobile number to get started' 
              : `We sent a 6-digit code to ${phone}`}
          </p>
        </header>

        {/* ⚠️ Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold text-center">
            {error}
          </div>
        )}

        {/* 📝 Form Section */}
        <div className="space-y-4">
          {step === 'PHONE' ? (
            <div className="flex flex-col gap-4">
              <input 
                type="tel" 
                placeholder="+91 00000 00000" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl text-gray-900 font-semibold outline-none transition-all"
              />
              <button 
                onClick={sendOtp} 
                disabled={loading || !phone}
                className="w-full py-4 bg-gray-900 hover:bg-indigo-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 group transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none shadow-xl shadow-gray-200 hover:shadow-indigo-200"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : (
                  <>Continue <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <input 
                type="text" 
                placeholder="0 0 0 0 0 0" 
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none transition-all"
                maxLength={6}
              />
              <button 
                onClick={verifyOtp}
                disabled={loading || otp.length < 6} 
                className="w-full py-4 bg-gray-900 hover:bg-indigo-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-30 shadow-xl"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Complete Login'}
              </button>
              <button 
                onClick={() => setStep('PHONE')} 
                className="text-xs font-black text-gray-400 hover:text-indigo-600 uppercase tracking-widest flex items-center justify-center gap-1 transition-colors mt-2"
              >
                <ChevronLeft size={14} /> Edit Number
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}