"use client";

import React, { useState } from 'react';

import { useApp } from '@/lib/context/app-context';

interface FinalReviewWorkflowProps {
    onComplete: () => void;
    onDemoActivate?: () => void; // New prop for demo
}

export function FinalReviewWorkflow({ onComplete, onDemoActivate }: FinalReviewWorkflowProps) {
    const [step, setStep] = useState<'review' | 'submitting' | 'submitted'>('review');
    const { user, propertyData } = useApp();

    const handleSubmit = async () => {
        setStep('submitting');

        try {
            const res = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: 'ben@housingpa.com',
                    type: 'submission',
                    subject: `📦 New Listing Package: ${propertyData?.address}`,
                    name: user?.email || 'User',
                    address: propertyData?.address,
                    propertyData: propertyData
                })
            });

            if (!res.ok) {
                // If soft fail logic returns 200 even on warning, this catches 400s/500s
                throw new Error("Failed to submit package");
            }

            // Success
            setStep('submitted');
            onComplete(); // Mark task as done
        } catch (e) {
            console.error("Admin notify failed", e);
            alert("There was an issue submitting your package. Please try again or contact support.");
            setStep('review'); // Reset to allow retry
        }
    };

    if (step === 'review') {
        return (
            <div className="bg-white rounded-xl shadow-lg border border-indigo-100 p-8 w-full flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

                <div className="mb-8 max-w-lg">
                    <h3 className="text-3xl font-bold text-slate-900 mb-4">You're All Set! 🚀</h3>
                    <p className="text-lg text-slate-600 leading-relaxed">
                        You've completed all the necessary steps to get listed. We've verified your documents and photos.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-x-12 gap-y-4 max-w-md mx-auto mb-10 text-left text-base bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-700 font-medium">✅ Listing Agreement</div>
                    <div className="flex items-center gap-2 text-slate-700 font-medium">✅ Photos Uploaded</div>
                    <div className="flex items-center gap-2 text-slate-700 font-medium">✅ Lockbox Installed</div>
                    <div className="flex items-center gap-2 text-slate-700 font-medium">✅ Disclosure Signed</div>
                </div>

                <button
                    onClick={handleSubmit}
                    className="w-full max-w-sm py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transform hover:-translate-y-1 transition-all text-xl"
                >
                    Submit for Final Review
                </button>
            </div>
        );
    }

    if (step === 'submitting') {
        return (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-16 w-full flex flex-col items-center text-center">
                <div className="animate-bounce text-6xl mb-6">📤</div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Sending to Broker...</h3>
                <p className="text-slate-500">Validating checklist & generating summary...</p>
            </div>
        );
    }

    if (step === 'submitted') {
        return (
            <div className="w-full flex flex-col items-center text-center animate-in zoom-in duration-500 max-w-2xl mx-auto">
                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-5xl mb-6 shadow-sm">
                    🎉
                </div>
                <h3 className="text-4xl font-bold text-slate-900 mb-4">Submission Received!</h3>
                <p className="text-xl text-slate-600 mb-8 max-w-xl">
                    Your listing is now <strong>Pending Review</strong>.
                </p>

                <div className="bg-blue-50 border border-blue-100 p-8 rounded-2xl w-full mb-8">
                    <h4 className="font-bold text-blue-900 text-lg mb-2">What Happens Next?</h4>
                    <p className="text-blue-800 leading-relaxed mb-4">
                        Thank you for your business! You made the first step towards saving thousands on broker fees.
                    </p>
                    <ul className="text-left text-blue-800 space-y-3 max-w-md mx-auto">
                        <li className="flex gap-3">
                            <span>📧</span>
                            <span>We sent a confirmation email to you.</span>
                        </li>
                        <li className="flex gap-3">
                            <span>👨‍💻</span>
                            <span>Your agent (James) is reviewing your file now.</span>
                        </li>
                        <li className="flex gap-3">
                            <span>📢</span>
                            <span>Once approved, we publish to BrightMLS, Zillow, and Realtor.com.</span>
                        </li>
                    </ul>
                </div>

                <p className="text-green-600 text-sm mt-8">
                    Dashboard will update to "On Market" view automatically once live.
                </p>

                {/* DEMO LINK */}
                {onDemoActivate && (
                    <div className="mt-12 pt-8 border-t border-green-100 w-full max-w-xs">
                        <p className="text-xs text-slate-400 mb-2 uppercase tracking-widest font-bold">Developer Demo</p>
                        <button
                            onClick={onDemoActivate}
                            className="text-slate-400 hover:text-blue-600 underline text-xs"
                        >
                            Simulate Broker Approval & Go Live
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return null;
}
