"use client";

import React, { useState } from 'react';

interface ShowingPreferencesWorkflowProps {
    onComplete: () => void;
}

const SHOWING_OPTIONS = [
    { id: 'go_show', label: 'Go and Show', description: 'Immediate access via lockbox. No confirmation needed.' },
    { id: 'few_hours', label: 'Appointment Required', description: 'Agent must call first. 1-2 hour notice.' },
    { id: '24h', label: '24 Hour Notice', description: 'Tenant or seller requires day-before scheduling.' },
    { id: '48h', label: '48 Hour Notice', description: 'Strict advance notice required.' },
    { id: 'more_48', label: 'More than 48 Hours', description: 'Special arrangement required.' },
    { id: 'seller_open', label: 'Seller Will Open', description: 'You will meet the agent at the door.' },
    { id: 'no_show', label: 'Property Can\'t Be Shown', description: 'Temporarily off-market for showings.' },
    { id: 'other', label: 'Other', description: 'Custom arrangement.' }
];

export function ShowingPreferencesWorkflow({ onComplete }: ShowingPreferencesWorkflowProps) {
    const [selected, setSelected] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const handleSave = () => {
        if (!selected) return;
        setIsSaving(true);
        // Simulate API save
        setTimeout(() => {
            setIsSaving(false);
            setIsSaved(true);
        }, 1000);
    };

    if (isSaved) {
        return (
            <div className="bg-green-50 rounded-xl border border-green-200 p-12 w-full flex flex-col items-center text-center animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm">
                    ✅
                </div>
                <h3 className="text-2xl font-bold text-green-800 mb-2">Preferences Saved</h3>
                <p className="text-green-700 text-lg mb-8 max-w-md">
                    ShowingTime has been updated. Agents will see these instructions immediately.
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

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 w-full flex flex-col items-center text-center">
            <h3 className="text-2xl font-bold text-slate-900 mb-8">Select Access Type</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 w-full max-w-2xl">
                {SHOWING_OPTIONS.map(option => (
                    <div
                        key={option.id}
                        onClick={() => setSelected(option.id)}
                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all text-left ${selected === option.id ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-blue-300 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4 mb-2">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected === option.id ? 'border-blue-600' : 'border-slate-300'}`}>
                                {selected === option.id && <div className="w-3 h-3 bg-blue-600 rounded-full"></div>}
                            </div>
                            <span className="font-bold text-slate-900 text-lg">{option.label}</span>
                        </div>
                        <p className="text-sm text-slate-500 ml-10">{option.description}</p>
                    </div>
                ))}
            </div>

            <button
                onClick={handleSave}
                disabled={!selected || isSaving}
                className="w-full max-w-sm py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
                {isSaving ? "Saving..." : "Save Preferences"}
            </button>
        </div>
    );
}
