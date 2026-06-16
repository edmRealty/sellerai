"use client";

import React, { useState } from 'react';

interface YardSignWorkflowProps {
    onComplete: () => void;
}

export function YardSignWorkflow({ onComplete }: YardSignWorkflowProps) {
    const [step, setStep] = useState<'choice' | 'configure' | 'success'>('choice');
    const [quantity, setQuantity] = useState(1);
    const [installService, setInstallService] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleConfirm = () => {
        setIsSaving(true);
        // Simulate order API
        setTimeout(() => {
            setIsSaving(false);
            setStep('success');
        }, 1500);
    };

    if (step === 'choice') {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                <div
                    onClick={() => setStep('configure')}
                    className="border-2 border-slate-100 hover:border-blue-500 bg-slate-50 hover:bg-blue-50 rounded-2xl p-8 cursor-pointer transition-all group text-center flex flex-col items-center justify-center h-64"
                >
                    <div className="text-6xl mb-6 group-hover:scale-110 transition-transform">🪧</div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Yes, I want a sign</h3>
                    <p className="text-slate-500 text-lg">Capture 15% more local buyers.</p>
                </div>

                <div
                    onClick={onComplete}
                    className="border-2 border-slate-100 hover:border-slate-400 bg-white hover:bg-slate-50 rounded-2xl p-8 cursor-pointer transition-all group text-center flex flex-col items-center justify-center h-64"
                >
                    <div className="text-6xl mb-6 grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all">🚫</div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">No sign needed</h3>
                    <p className="text-slate-500 text-lg">I prefer to keep it digital only.</p>
                </div>
            </div>
        );
    }

    if (step === 'configure') {
        const baseCost = 0;
        const installCost = 250;
        const total = installService ? installCost : 0;

        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 w-full flex flex-col items-center text-center animate-in slide-in-from-right duration-300">
                <button onClick={() => setStep('choice')} className="self-start text-sm text-slate-400 font-bold mb-4 hover:text-slate-600">← Back</button>
                <div className="flex flex-col items-center gap-4 mb-10">
                    <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center text-4xl">🪧</div>
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900">Configure Your Sign</h3>
                        <p className="text-slate-500">High-visibility, reflective aluminum.</p>
                    </div>
                </div>

                {/* Quantity */}
                <div className="mb-10 w-full max-w-md">
                    <label className="block text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Quantity</label>
                    <div className="flex items-center justify-center gap-6">
                        <button
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            className="w-12 h-12 rounded-full border-2 border-slate-200 flex items-center justify-center hover:bg-slate-100 font-bold text-xl"
                        >
                            -
                        </button>
                        <span className="text-3xl font-bold w-12 text-center">{quantity}</span>
                        <button
                            onClick={() => setQuantity(Math.min(5, quantity + 1))}
                            className="w-12 h-12 rounded-full border-2 border-slate-200 flex items-center justify-center hover:bg-slate-100 font-bold text-xl"
                        >
                            +
                        </button>
                    </div>
                    <div className="text-sm text-slate-400 mt-2">(Corner lots may need 2)</div>
                </div>

                {/* Installation Service */}
                <div className="mb-10 space-y-4 w-full max-w-lg">
                    <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Installation</label>

                    <div
                        onClick={() => setInstallService(false)}
                        className={`p-6 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all text-left ${!installService ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${!installService ? 'border-blue-600' : 'border-slate-300'}`}>
                                {!installService && <div className="w-3 h-3 bg-blue-600 rounded-full"></div>}
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 text-lg">I will install it myself</div>
                                <div className="text-sm text-slate-500">We ship the post and sign to you. (Free)</div>
                            </div>
                        </div>
                        <div className="font-bold text-slate-700 text-xl">$0</div>
                    </div>

                    <div
                        onClick={() => setInstallService(true)}
                        className={`p-6 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all text-left ${installService ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${installService ? 'border-blue-600' : 'border-slate-300'}`}>
                                {installService && <div className="w-3 h-3 bg-blue-600 rounded-full"></div>}
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 text-lg">Pro Installation & Removal</div>
                                <div className="text-sm text-slate-500">We drive the post and remove it after sale.</div>
                            </div>
                        </div>
                        <div className="font-bold text-slate-700 text-xl">$250</div>
                    </div>
                </div>

                <div className="w-full max-w-lg border-t border-slate-100 pt-8 flex items-center justify-between">
                    <div className="text-left">
                        <div className="text-sm text-slate-500">Total Cost</div>
                        <div className="text-3xl font-bold text-slate-900">${total}</div>
                    </div>
                    <button
                        onClick={handleConfirm}
                        disabled={isSaving}
                        className="px-8 py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg disabled:opacity-50 text-lg"
                    >
                        {isSaving ? "Processing..." : "Confirm Choices"}
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div className="bg-green-50 rounded-xl border border-green-200 p-12 w-full flex flex-col items-center text-center animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm">
                    🚚
                </div>
                <h3 className="text-2xl font-bold text-green-800 mb-2">Order Confirmed!</h3>
                <p className="text-green-700 text-lg mb-8 max-w-md">
                    {installService
                        ? "Our team will be out within 48 hours to install your sign."
                        : "Your sign kit has been shipped and will arrive in 2-3 business days."}
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
