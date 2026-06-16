"use client";

import React, { useState } from 'react';

interface LockboxWorkflowProps {
    onComplete: () => void;
}

export function LockboxWorkflow({ onComplete }: LockboxWorkflowProps) {
    const [step, setStep] = useState<'guide' | 'form' | 'success'>('guide');
    const [combo, setCombo] = useState('');
    const [location, setLocation] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsUploading(true);
        // Simulate upload/save
        setTimeout(() => {
            setIsUploading(false);
            setStep('success');
            // Allow user to see success before auto-closing? 
            // Better to show success state then they click "Complete"
        }, 1500);
    };

    if (step === 'guide') {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 w-full flex flex-col items-center text-center">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mb-8">
                    {/* Reference Image */}
                    <div className="rounded-xl shadow-lg border border-slate-100 h-64 bg-gray-200 relative overflow-hidden">
                        <img
                            src="/images/lockbox-hero.png"
                            alt="Lockbox Example"
                            className="w-full h-full object-cover"
                        />
                    </div>

                    {/* Video */}
                    <div className="rounded-xl shadow-lg bg-black h-64 overflow-hidden">
                        <iframe
                            width="100%"
                            height="100%"
                            src="https://www.youtube.com/embed/HhcSrKVRST0"
                            title="How to Install a Lockbox"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        ></iframe>
                    </div>
                </div>

                <div className="flex gap-4 mb-8 text-sm text-slate-600 justify-center">
                    <a href="#" className="flex items-center gap-2 hover:text-blue-600 border px-4 py-2 rounded-full bg-slate-50 transition-colors">
                        📺 Different Lockbox Types
                    </a>
                    <a href="#" className="flex items-center gap-2 hover:text-blue-600 border px-4 py-2 rounded-full bg-slate-50 transition-colors">
                        📄 Installation PDF
                    </a>
                </div>

                <button
                    onClick={() => setStep('form')}
                    className="w-full max-w-sm py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg text-lg transform hover:scale-105 transition-all"
                >
                    I have installed the lockbox
                </button>
            </div>
        );
    }

    if (step === 'form') {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 w-full flex flex-col items-center text-center animate-in slide-in-from-right duration-300">
                <button onClick={() => setStep('guide')} className="self-start text-sm text-slate-400 font-bold mb-4 hover:text-slate-600">← Back to Guide</button>
                <h3 className="text-2xl font-bold text-slate-900 mb-8">Lockbox Details</h3>

                <form onSubmit={handleSubmit} className="space-y-8 w-full max-w-md">
                    <div className="text-left">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Combination Code</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. 1984"
                            value={combo}
                            onChange={(e) => setCombo(e.target.value)}
                            className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 text-xl font-mono tracking-widest focus:ring-2 focus:ring-blue-500 outline-none text-center"
                        />
                    </div>

                    <div className="text-left">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Detailed Location</label>
                        <textarea
                            required
                            placeholder="e.g. Attached to the gas meter pipe on the right side of the house."
                            rows={3}
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="text-left">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Verification Photo</label>
                        <div className="border-2 border-dashed border-slate-300 bg-slate-50 rounded-xl p-8 text-center cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all flex flex-col items-center">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl shadow-sm mb-3">📸</div>
                            <div className="text-sm font-bold text-slate-600">Click to upload photo</div>
                            <div className="text-xs text-slate-400 mt-1">Proof of installation</div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isUploading}
                        className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isUploading ? "Saving..." : "Save Lockbox Details"}
                    </button>
                </form>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div className="bg-green-50 rounded-xl border border-green-200 p-12 w-full flex flex-col items-center text-center animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm">
                    ✅
                </div>
                <h3 className="text-2xl font-bold text-green-800 mb-2">Lockbox Registered!</h3>
                <p className="text-green-700 text-lg mb-8 max-w-sm">
                    We've securely stored your code. It will only be shared with verified agents.
                </p>
                <button
                    onClick={onComplete}
                    className="px-10 py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all flex items-center gap-2"
                >
                    Continue
                </button>
            </div>
        );
    }

    return null;
}
