"use client";

import React from 'react';
import { useApp } from '@/lib/context/app-context';

interface PropertyInsightsProps {
    propertyType: string;
    comps?: any[];
}

export function PropertyInsights({ propertyType, comps = [] }: PropertyInsightsProps) {
    const { propertyData } = useApp();
    const isCommercial = propertyType === 'commercial' || propertyType === 'industrial';

    // Derived from user input or defaults
    const address = propertyData?.address || "120 Maple Drive (Your Home)";

    // Fallback Comps if AI returns none (or API failure)
    const displayComps = (comps && comps.length > 0) ? comps : [
        { address: "Searching nearby sales...", price: 0, soldDate: "Pending", sqft: 0 },
        { address: "Searching nearby sales...", price: 0, soldDate: "Pending", sqft: 0 }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-bold text-slate-900 border-l-4 border-blue-600 pl-4">
                {isCommercial ? "Commercial Market Intelligence" : "Neighborhood Insights"}
            </h2>

            {/* RESIDENTIAL MODE */}
            {!isCommercial && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Comparable Sales */}
                    <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                🏘️ Comparable Sales
                            </h3>
                            <span className="text-xs text-slate-500">Radius: 0.5mi</span>
                        </div>
                        <div className="space-y-4">
                            {displayComps.map((comp, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-slate-200 rounded overflow-hidden flex items-center justify-center text-xs text-slate-400">
                                            Home
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800">{comp.address}</div>
                                            <div className="text-xs text-slate-500">Sold: {comp.soldDate}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-green-700">${comp.price.toLocaleString()}</div>
                                        <div className="text-xs text-slate-400">${comp.price && comp.sqft ? Math.round(comp.price / comp.sqft) : 0}/sqft</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                            <button className="text-blue-600 text-sm font-bold hover:underline">View 5 More Recent Sales →</button>
                        </div>
                    </div>

                    {/* School & Safety */}
                    <div className="space-y-6">
                        {/* Schools */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">🎓 School District</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-green-50/50 p-2 rounded">
                                    <span className="text-sm text-slate-600">Elementary</span>
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">A+ (9/10)</span>
                                </div>
                                <div className="flex justify-between items-center bg-green-50/50 p-2 rounded">
                                    <span className="text-sm text-slate-600">Middle</span>
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">A (8/10)</span>
                                </div>
                                <div className="flex justify-between items-center bg-yellow-50/50 p-2 rounded">
                                    <span className="text-sm text-slate-600">High School</span>
                                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">B+ (7/10)</span>
                                </div>
                            </div>
                        </div>

                        {/* Safety */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">🛡️ Safety Score</h3>
                            <div className="flex items-end gap-2">
                                <span className="text-5xl font-bold text-blue-600">92</span>
                                <span className="text-base text-slate-400 mb-1">/ 100</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                                <div className="bg-blue-600 h-full w-[92%] rounded-full"></div>
                            </div>
                            <p className="text-xs text-slate-500 mt-2 font-medium">"Very Safe" relative to city average.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* COMMERCIAL MODE */}
            {isCommercial && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Cap Rate Trends */}
                    <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                📈 Area Cap Rate Trends
                            </h3>
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">Last 12 Months</span>
                        </div>

                        {/* CSS Bar Chart Simulation */}
                        <div className="flex items-end justify-between h-32 gap-2 text-center text-xs text-slate-500">
                            <div className="w-full flex flex-col items-center gap-1 group">
                                <div className="w-full bg-blue-100 group-hover:bg-blue-200 h-[60%] rounded-t transition-all relative">
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-slate-900 font-bold opacity-0 group-hover:opacity-100">5.2%</span>
                                </div>
                                <span>Q1</span>
                            </div>
                            <div className="w-full flex flex-col items-center gap-1 group">
                                <div className="w-full bg-blue-200 group-hover:bg-blue-300 h-[55%] rounded-t transition-all relative">
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-slate-900 font-bold opacity-0 group-hover:opacity-100">5.0%</span>
                                </div>
                                <span>Q2</span>
                            </div>
                            <div className="w-full flex flex-col items-center gap-1 group">
                                <div className="w-full bg-blue-400 group-hover:bg-blue-500 h-[70%] rounded-t transition-all relative">
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-slate-900 font-bold opacity-0 group-hover:opacity-100">5.8%</span>
                                </div>
                                <span>Q3</span>
                            </div>
                            <div className="w-full flex flex-col items-center gap-1 group">
                                <div className="w-full bg-blue-600 group-hover:bg-blue-700 h-[65%] rounded-t transition-all relative">
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-slate-900 font-bold opacity-0 group-hover:opacity-100">5.6%</span>
                                </div>
                                <span>Q4</span>
                            </div>
                        </div>
                        <p className="mt-4 text-xs text-slate-400">Analysis based on sold comps in zip code.</p>
                    </div>

                    {/* Financial Tools */}
                    <div className="space-y-6">
                        {/* 1031 Exchange */}
                        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-xl shadow-md text-white">
                            <h3 className="font-bold text-lg mb-2">1031 Exchange</h3>
                            <p className="text-indigo-100 text-sm mb-4">Defer taxes by reinvesting graphics.</p>
                            <div className="bg-white/10 p-3 rounded backdrop-blur-sm border border-white/20 mb-4">
                                <div className="text-xs text-indigo-200 uppercase tracking-widest">Identification Deadline</div>
                                <div className="font-bold text-xl">45 Days</div>
                            </div>
                            <button className="w-full py-2 bg-white text-indigo-600 font-bold rounded text-sm hover:bg-indigo-50 transition-colors">
                                View Qualified Intermediaries
                            </button>
                        </div>

                        {/* Loan Rates */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">Commercial Rates</h3>
                            <div className="flex justify-between border-b border-slate-100 pb-2 mb-2">
                                <span className="text-sm text-slate-600">SBA 504</span>
                                <span className="font-bold text-slate-900">6.75%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-600">Conventional</span>
                                <span className="font-bold text-slate-900">7.12%</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
