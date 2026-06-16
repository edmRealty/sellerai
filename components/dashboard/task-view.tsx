"use client";

import React, { useState } from 'react';
import { useApp } from '@/lib/context/app-context';

export interface TaskItem {
    id: number;
    title: string;
    description: string;
    icon: string;
    imageUrl?: string; // New: Hero Image
    significance?: string; // New: Educational Context
    component?: React.ReactNode;
    hideDefaultControls?: boolean;
    hideSignificance?: boolean;
}

interface TaskViewProps {
    task: TaskItem;
    onComplete: (taskId?: number) => void;
    onSaveForLater: () => void;
    onBack: () => void;
}

export function TaskView({ task, onComplete, onSaveForLater, onBack }: TaskViewProps) {
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        // Simulate "saving" to sidebar
        setTimeout(() => {
            onSaveForLater();
        }, 800);
    };

    return (
        <div className="w-full min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <button
                    onClick={onBack}
                    className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-2"
                >
                    ← Back to Dashboard
                </button>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                    Task #{task.id}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-start p-6 max-w-4xl mx-auto w-full pt-10 pb-20">

                {/* Hero section */}
                {task.imageUrl && (
                    <div className="w-full max-w-2xl h-64 md:h-80 relative rounded-2xl overflow-hidden shadow-2xl mb-8 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={task.imageUrl}
                            alt={task.title}
                            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                        />

                        <div className="absolute bottom-6 left-6 text-white">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-2xl mb-2">
                                {task.icon}
                            </div>
                        </div>
                    </div>
                )}

                {/* No Image Fallback */}
                {!task.imageUrl && (
                    <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-5xl mb-8 shadow-inner">
                        {task.icon}
                    </div>
                )}

                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 text-center">{task.title}</h1>

                <p className="text-lg md:text-xl text-slate-600 mb-8 text-center max-w-2xl leading-relaxed">
                    {task.description}
                </p>

                {/* Custom Task UI (Workflows) - Moved ABOVE Significance */}
                {task.component && (
                    <div className="w-full max-w-3xl mb-10 flex flex-col items-center">
                        {task.component}
                    </div>
                )}

                {/* Significance / Educational Context */}
                {task.significance && !task.hideSignificance && (
                    <div className="w-full max-w-2xl bg-blue-50 border border-blue-100 rounded-xl p-6 mb-10 text-center">
                        <h3 className="text-blue-900 font-bold mb-2 flex items-center justify-center gap-2">
                            <span>💡</span> Why this matters
                        </h3>
                        <p className="text-blue-800 leading-relaxed">
                            {task.significance}
                        </p>
                    </div>
                )}

                {/* Actions */}
                {!task.hideDefaultControls && (
                    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mt-auto">
                        <button
                            onClick={() => onComplete(task.id)}
                            className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <span className="text-xl">✅</span> Mark as Complete
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 py-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all active:scale-95"
                        >
                            {isSaving ? "Saving..." : <><span className="text-xl">💾</span> Save for Later</>}
                        </button>
                    </div>
                )}
                <p className="mt-4 text-xs text-slate-400 text-center">
                    "Save for Later" will add this task to your sidebar checklist.
                </p>
            </div>
        </div>
    );
}
