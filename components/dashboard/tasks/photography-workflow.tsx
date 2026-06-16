"use client";

import React, { useState } from 'react';

interface Photographer {
    id: number;
    name: string;
    rating: number;
    reviews: number;
    price: string;
    phone: string;
    image: string;
}

const PHOTOGRAPHERS: Photographer[] = [
    { id: 1, name: "Luxe Lens PA", rating: 5.0, reviews: 124, price: "$250 - $400", phone: "(215) 555-0123", image: "📸" },
    { id: 2, name: "Philly Real Estate Pics", rating: 4.8, reviews: 89, price: "$200 - $350", phone: "(215) 555-0199", image: "🏙️" },
    { id: 3, name: "Budget Snaps", rating: 4.5, reviews: 56, price: "$150 flat", phone: "(484) 555-0888", image: "⚡" }
];

interface PhotographyWorkflowProps {
    onUploadComplete: () => void;
}

export function PhotographyWorkflow({ onUploadComplete }: PhotographyWorkflowProps) {
    const [view, setView] = useState<'selection' | 'pros' | 'diy' | 'upload'>('selection');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    // DIY Step
    const [showDiyWarning, setShowDiyWarning] = useState(false);

    const handleFileUpload = () => {
        setIsUploading(true);
        // Simulate upload
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            setUploadProgress(progress);
            if (progress >= 100) {
                clearInterval(interval);
                setIsUploading(false);
                onUploadComplete();
            }
        }, 300);
    };

    if (view === 'selection') {
        return (
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                <div
                    onClick={() => setView('pros')}
                    className={`border-2 border-slate-100 hover:border-blue-500 bg-white hover:bg-blue-50 rounded-xl p-8 cursor-pointer transition-all group flex flex-col items-center text-center`}
                >
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-4xl mb-6 group-hover:scale-110 transition-transform">📸</div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Hire a Pro</h3>
                    <p className="text-slate-500 mb-4">We'll send a local expert.</p>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">Recommended</span>
                </div>

                <div
                    onClick={() => setView('diy')}
                    className={`border-2 border-slate-100 hover:border-slate-400 bg-white hover:bg-slate-50 rounded-xl p-8 cursor-pointer transition-all group flex flex-col items-center text-center`}
                >
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-6 grayscale group-hover:grayscale-0 transition-all">📱</div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">I'll take them</h3>
                    <p className="text-slate-500">Upload your own photos.</p>
                </div>
            </div>
        );
    }

    if (view === 'pros') {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 w-full text-left">
                <button onClick={() => setView('selection')} className="text-sm text-slate-400 font-bold mb-4 hover:text-slate-600">← Back</button>
                <h3 className="text-xl font-bold text-slate-900 mb-6">Top Rated in Your Area</h3>
                <div className="space-y-4 mb-8">
                    {PHOTOGRAPHERS.map(pro => (
                        <div key={pro.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-xl">{pro.image}</div>
                                <div>
                                    <h4 className="font-bold text-slate-800">{pro.name}</h4>
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <span className="text-yellow-500">★ {pro.rating}</span>
                                        <span>({pro.reviews} reviews)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-slate-900">{pro.price}</div>
                                <div className="text-xs text-slate-500">{pro.phone}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                    <h4 className="font-bold text-green-800 mb-2">Next Steps</h4>
                    <p className="text-green-700 text-sm mb-4">Contact one of the pros above. Once you receive the digital files, come back here.</p>
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" className="w-5 h-5 rounded border-green-400 text-green-600 focus:ring-green-500"
                            onChange={(e) => {
                                if (e.target.checked) setView('upload');
                            }}
                        />
                        <span className="text-green-800 font-medium group-hover:text-green-900">
                            Great decision! I have the photos ready to upload.
                        </span>
                    </label>
                </div>
            </div>
        );
    }

    if (view === 'diy') {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 w-full text-left">
                <button onClick={() => setView('selection')} className="text-sm text-slate-400 font-bold mb-4 hover:text-slate-600">← Back</button>

                <div className="mb-8">
                    <h3 className="text-xl font-bold text-slate-900 mb-4">Pro Tips for DIY Photos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-50 rounded-lg text-center">
                            <div className="text-2xl mb-2">💡</div>
                            <div className="font-bold text-slate-900 text-sm">Light It Up</div>
                            <div className="text-xs text-slate-500">Turn on ALL lights and open curtains.</div>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg text-center">
                            <div className="text-2xl mb-2">📐</div>
                            <div className="font-bold text-slate-900 text-sm">Chest Height</div>
                            <div className="text-xs text-slate-500">Hold camera at chest level to keep lines straight.</div>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg text-center">
                            <div className="text-2xl mb-2">🚫</div>
                            <div className="font-bold text-slate-900 text-sm">No Wide Angle</div>
                            <div className="text-xs text-slate-500">Avoid "fisheye" distortion on phones.</div>
                        </div>
                    </div>
                </div>

                <div className="text-center">
                    <button
                        onClick={() => setView('upload')}
                        className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg"
                    >
                        I'm Ready to Upload
                    </button>
                </div>
            </div>
        );
    }

    if (view === 'upload') {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 w-full">
                <h3 className="text-xl font-bold text-slate-900 mb-6 text-center">Upload to MLS & Zillow</h3>

                {!isUploading && uploadProgress === 0 && (
                    <div
                        onClick={handleFileUpload}
                        className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-2xl p-12 text-center cursor-pointer hover:bg-blue-100 transition-colors group"
                    >
                        <div className="w-16 h-16 bg-blue-200 text-blue-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 group-hover:scale-110 transition-transform">
                            ☁️
                        </div>
                        <h4 className="font-bold text-blue-900 text-lg mb-1">Click to Upload Photos</h4>
                        <p className="text-blue-600 text-sm">JPG or PNG, max 10MB each</p>
                    </div>
                )}

                {(isUploading || uploadProgress > 0) && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between text-sm font-bold text-slate-700">
                            <span>Uploading to BrightMLS...</span>
                            <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                            <div
                                className="bg-blue-600 h-full transition-all duration-300 ease-out"
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>
                        <div className="text-center text-xs text-slate-400">
                            Syncing with Zillow, Realtor.com, and Redfin...
                        </div>
                    </div>
                )}

                {uploadProgress === 100 && (
                    <div className="mt-6 text-center animate-in fade-in zoom-in">
                        <div className="text-green-600 font-bold mb-2">✅ Upload Complete!</div>
                        <p className="text-slate-500 text-sm">Your photos are now staged for syndication.</p>
                    </div>
                )}
            </div>
        );
    }

    return null;
}
