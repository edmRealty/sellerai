"use client";

import React, { useState, useEffect } from 'react';

interface DisclosureWorkflowProps {
    onComplete: () => void;
}

export function DisclosureWorkflow({ onComplete }: DisclosureWorkflowProps) {
    const [step, setStep] = useState<'start' | 'sending' | 'waiting' | 'success'>('start');

    // Simulate polling for signature
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (step === 'waiting') {
            interval = setInterval(() => {
                // In a real app, this would poll an endpoint like /api/check-signature
                console.log("Polling for DocuSign status...");
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [step]);

    const handleStartSign = () => {
        setStep('sending');
        // Simulate API call to send envelope
        setTimeout(() => {
            setStep('waiting');
        }, 2000);
    };

    const handleSimulateSigned = () => {
        setStep('success');
    };

    if (step === 'start') {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 w-full text-center">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
                    📝
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Seller's Property Disclosure</h3>
                <p className="text-slate-600 mb-8 max-w-lg mx-auto">
                    This is a legally required document in Pennsylvania. We've pre-filled your property details.
                    You just need to answer the condition questions (Roof, HVAC, etc.).
                </p>
                <div className="flex flex-col gap-3 max-w-xs mx-auto">
                    <button
                        onClick={handleStartSign}
                        className="w-full py-4 bg-yellow-500 text-white font-bold rounded-xl hover:bg-yellow-600 shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all"
                    >
                        <span>🖊️</span> Start eSign Now
                    </button>
                    <p className="text-xs text-slate-400">Powered by DocuSign</p>
                </div>
            </div>
        );
    }

    if (step === 'sending') {
        return (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 w-full text-center">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <h3 className="font-bold text-slate-700">Preparing Your Package...</h3>
                <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
                    Thank you. Your signing package is being prepared manually... This may take up to 60 minutes.
                </p>
            </div>
        );
    }

    if (step === 'waiting') {
        return (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-8 w-full text-center animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 animate-pulse">
                    📧
                </div>
                <h3 className="text-xl font-bold text-blue-900 mb-2">Check Your Email</h3>
                <p className="text-blue-800 mb-6 max-w-md mx-auto">
                    We've sent the disclosure statement to your email. Please click the link in the email to complete the signing process.
                </p>

                <div className="p-4 bg-white rounded-lg border border-blue-100 max-w-sm mx-auto mb-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="text-yellow-600 font-bold">DocuSign</div>
                        <div className="text-sm text-slate-500">Please Sign: Property Disclosure...</div>
                    </div>
                </div>

                <div className="text-sm text-slate-500 mb-8">
                    Waiting for signature confirmation...
                </div>

                {/* Demo Control */}
                <button
                    onClick={handleSimulateSigned}
                    className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                    [Demo: Simulate "Signed" Event]
                </button>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div className="bg-green-50 rounded-xl border border-green-200 p-8 text-center animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                    ✅
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Disclosure Signed & Filed</h3>
                <p className="text-green-700 text-sm mb-6">
                    We've automatically attached this to your listing profile. Buyers will be able to request it directly.
                </p>
                <button
                    onClick={onComplete}
                    className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-sm"
                >
                    Continue
                </button>
            </div>
        );
    }

    return null;
}
