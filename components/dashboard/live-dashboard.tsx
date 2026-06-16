"use client";

import React, { useState } from 'react';
import {
    Eye, Heart, Calendar, AlertTriangle, CheckCircle,
    Home, FileText, TrendingUp, PenTool, Lock,
    ChevronRight, ArrowUpRight, Share2, ExternalLink,
    Brush, Image as ImageIcon, Sparkles, X, Camera, Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/context/app-context';

export function LiveDashboard({ propertyData, occupancyStatus }: { propertyData: any, occupancyStatus?: string }) {
    const [activeTab, setActiveTab] = useState<'overview' | 'marketing' | 'disclosures' | 'offers' | 'closing'>('overview');
    const [showStagingModal, setShowStagingModal] = useState(false);
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [showLockboxModal, setShowLockboxModal] = useState(false);
    const [showSignModal, setShowSignModal] = useState(false);
    const [showDescriptionModal, setShowDescriptionModal] = useState(false);
    const [showPriceModal, setShowPriceModal] = useState(false); // New Task Modal
    const { showToast } = useApp();

    return (
        <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-8 animate-in fade-in duration-500">
            {/* Dashboard Header Removed per User Request */}

            {/* Navigation Tabs */}
            <nav className="flex overflow-x-auto gap-8 border-b border-slate-200 hide-scrollbar">
                {[
                    { id: 'overview', label: 'Overview', icon: Home },
                    { id: 'marketing', label: 'Visual Marketing', icon: ImageIcon },
                    { id: 'disclosures', label: 'Disclosures', icon: FileText },
                    { id: 'offers', label: 'Offers', icon: TrendingUp, count: 0 },
                    { id: 'closing', label: 'Closing', icon: Lock }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "group flex items-center gap-2 pb-4 border-b-2 transition-all whitespace-nowrap px-1",
                            activeTab === tab.id
                                ? "border-slate-900 text-slate-900 font-semibold"
                                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                        )}
                    >
                        <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600")} />
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </nav>

            {/* TAB CONTENT */}
            <div className="min-h-[400px]">

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            {/* Stats Grid */}
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-indigo-500" /> Live Activity
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <StatCard
                                        icon={Eye}
                                        label="Total Views"
                                        value="42"
                                        trend="+12 today"
                                        trendUp={true}
                                        color="text-blue-600"
                                        bg="bg-blue-50"
                                    />
                                    <StatCard
                                        icon={Heart}
                                        label="Saves"
                                        value="8"
                                        trend="+2 today"
                                        trendUp={true}
                                        color="text-rose-600"
                                        bg="bg-rose-50"
                                    />
                                    <StatCard
                                        icon={Calendar}
                                        label="Showings"
                                        value="3"
                                        trend="Next: Tue @ 2pm"
                                        trendUp={true} // Neutral
                                        color="text-indigo-600"
                                        bg="bg-indigo-50"
                                    />
                                </div>
                            </div>

                            {/* Agent Feedback */}
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-500" /> Agent Feedback Insight
                                </h3>
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="p-6 space-y-6">
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
                                                <TrendingUp className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-900">Pricing Insight</h4>
                                                <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                                                    AI analysis of 3 showing feedbacks suggests the price is slightly high compared to recent comps on Welsh Rd.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="h-px bg-slate-100" />
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
                                                <Brush className="w-5 h-5 text-rose-600" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-900">Condition Issue</h4>
                                                <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                                                    2 agents mentioned that "clutter" in the living room is distracting buyers from seeing the space's potential.
                                                </p>
                                                <button
                                                    onClick={() => setActiveTab('marketing')}
                                                    className="inline-flex items-center gap-1 mt-2 text-indigo-600 text-sm font-medium hover:text-indigo-700 hover:underline"
                                                >
                                                    Fix in Visual Marketing Hub <ArrowUpRight className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tasks Sidebar */}
                        <div className="lg:col-span-1">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-500" /> Tasks
                            </h3>
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2">
                                <TaskItem
                                    label="Finalize Listing Price"
                                    status="pending"
                                    icon={TrendingUp}
                                    onClick={() => setShowPriceModal(true)}
                                    urgent={true}
                                />
                                <TaskItem
                                    label="Arrange Photography"
                                    status="pending"
                                    icon={Camera}
                                    onClick={() => setShowPhotoModal(true)}
                                    urgent={true}
                                />
                                <TaskItem
                                    label="Complete Seller's Disclosure"
                                    status="pending"
                                    icon={FileText}
                                    onClick={() => setActiveTab('disclosures')}
                                />
                                <TaskItem
                                    label={`Install Lockbox ${occupancyStatus === 'tenant' ? '(Optional)' : ''}`}
                                    status="pending"
                                    icon={Lock}
                                    urgent={occupancyStatus === 'vacant'}
                                    onClick={() => setShowLockboxModal(true)}
                                />
                                <TaskItem
                                    label="Install Yard Sign"
                                    status="pending"
                                    icon={Home}
                                    onClick={() => setShowSignModal(true)}
                                />
                                <TaskItem
                                    label="Write Property Description"
                                    status="pending"
                                    icon={PenTool}
                                    onClick={() => setShowDescriptionModal(true)}
                                />
                                <TaskItem
                                    label="Review Showing Availability"
                                    status="done"
                                    icon={Calendar}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* VISUAL MARKETING HUB TAB */}
                {activeTab === 'marketing' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 lg:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shadow-sm">
                            <div className="space-y-2">
                                <h4 className="text-blue-900 font-bold text-lg flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-blue-600" /> AI Insight: "Clutter Detected"
                                </h4>
                                <p className="text-blue-800/80 text-sm max-w-xl leading-relaxed">
                                    Our computer vision analysis detected significant personal items in the <strong>Living Room</strong>.
                                    Staged homes sell 73% faster and for more money.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowStagingModal(true)}
                                className="flex-shrink-0 w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold shadow-md hover:bg-blue-700 transition-all hover:shadow-lg flex items-center justify-center gap-2"
                            >
                                <Brush className="w-4 h-4" /> Book Virtual Staging ($50)
                            </button>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                                <ImageIcon className="w-5 h-5 text-slate-500" /> Listing Media Gallery
                                <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Cloudinary Enhanced</span>
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {['Living Room', 'Kitchen', 'Master Bed', 'Exterior'].map((room, i) => (
                                    <div key={room} className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                        <div className="h-48 bg-slate-100 relative overflow-hidden">
                                            {/* Placeholder Image replacement with colored div + text for now, better than placehold.co */}
                                            <div className={cn(
                                                "w-full h-full flex items-center justify-center text-slate-400 select-none",
                                                i === 0 ? "bg-amber-50" : "bg-slate-50"
                                            )}>
                                                <ImageIcon className="w-12 h-12 opacity-20" />
                                            </div>

                                            {/* Labels */}
                                            <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-md">
                                                {room}
                                            </div>
                                            {i === 0 && (
                                                <div className="absolute top-3 right-3 bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm animate-pulse">
                                                    CLUTTER DETECTED
                                                </div>
                                            )}

                                            {/* Hover Actions */}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <button className="p-2 bg-white rounded-full text-slate-900 hover:bg-slate-100 transition-colors">
                                                    <Eye size={16} />
                                                </button>
                                                <button className="p-2 bg-white rounded-full text-slate-900 hover:bg-slate-100 transition-colors">
                                                    <PenTool size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                                                    <Sparkles size={12} /> Enhanced
                                                </span>
                                                <span className="text-xs text-slate-400">2048x1536</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button className="flex-1 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors">
                                                    Reject
                                                </button>
                                                <button className="flex-1 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors shadow-sm">
                                                    Approve
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* OTHER TABS (Placeholders) */}
                {activeTab === 'disclosures' && <PlaceholderTab title="Smart Disclosure Wizard" icon={FileText} desc="Pre-filled seller's disclosure using public records and visual analysis." />}
                {activeTab === 'offers' && <PlaceholderTab title="Offer Intelligence" icon={TrendingUp} desc="Compare incoming offers side-by-side with AI analysis on Net Proceeds and Risk." />}
                {activeTab === 'closing' && <PlaceholderTab title="Closing Reconciliation" icon={Lock} desc="Track milestones, inspections, and verify final settlement statements." />}

            </div>

            {/* Staging Modal */}
            {showStagingModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Brush className="w-5 h-5 text-indigo-600" /> Virtual Staging Studio
                            </h2>
                            <button onClick={() => setShowStagingModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 mb-6">Select a design aesthetic to instantly transform the <strong>Living Room</strong>:</p>
                            <div className="space-y-3">
                                <button className="w-full p-4 border border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all flex items-center gap-4 group text-left">
                                    <div className="w-12 h-12 bg-slate-100 rounded-lg group-hover:bg-white flex-shrink-0"></div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900 group-hover:text-indigo-700">Modern Minimalist</h4>
                                        <p className="text-xs text-slate-500">Clean lines, neutral tones, clutter-free.</p>
                                    </div>
                                </button>
                                <button className="w-full p-4 border border-slate-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all flex items-center gap-4 group text-left">
                                    <div className="w-12 h-12 bg-slate-100 rounded-lg group-hover:bg-white flex-shrink-0"></div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900 group-hover:text-green-700">Organic Scandinavian</h4>
                                        <p className="text-xs text-slate-500">Warm wood, plants, cozy textures.</p>
                                    </div>
                                </button>
                                <button className="w-full p-4 border border-slate-200 rounded-xl hover:border-amber-500 hover:bg-amber-50 transition-all flex items-center gap-4 group text-left">
                                    <div className="w-12 h-12 bg-slate-100 rounded-lg group-hover:bg-white flex-shrink-0"></div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900 group-hover:text-amber-700">Traditional Luxury</h4>
                                        <p className="text-xs text-slate-500">Rich fabrics, classic furniture, elegant.</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setShowStagingModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:text-slate-900">Cancel</button>
                            <button onClick={() => setShowStagingModal(false)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-sm">
                                Generate Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Selection Modal */}
            {showPhotoModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                    <Camera size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Schedule Photography</h2>
                                    <p className="text-sm text-slate-500">Professional photos increase views by 118%.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowPhotoModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-0 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 h-full">
                                {/* Option 1: DIY */}
                                <div className="p-8 border-b md:border-b-0 md:border-r border-slate-100 hover:bg-slate-50 transition-colors group cursor-pointer">
                                    <div className="flex flex-col h-full">
                                        <div className="mb-6">
                                            <h3 className="text-lg font-bold text-slate-900 mb-2">I'll take my own photos</h3>
                                            <p className="text-slate-500 text-sm">Upload your own high-quality images. Recommended only if you have professional equipment.</p>
                                        </div>
                                        <div className="bg-slate-100 rounded-xl aspect-video mb-6 flex items-center justify-center text-slate-400 group-hover:bg-slate-200 transition-colors">
                                            <ImageIcon size={48} />
                                        </div>
                                        <div className="mt-auto">
                                            <button className="w-full py-3 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:border-slate-400 hover:bg-white transition-all">
                                                Upload My Photos
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Option 2: Hire Pro */}
                                <div className="p-8 bg-gradient-to-b from-indigo-50/50 to-white relative">
                                    <div className="absolute top-6 right-6 bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full border border-green-200">
                                        RECOMMENDED
                                    </div>
                                    <div className="mb-6">
                                        <h3 className="text-lg font-bold text-slate-900 mb-2">Hire a Photographer</h3>
                                        <p className="text-slate-500 text-sm">We found top-rated local pros near you.</p>
                                    </div>

                                    <div className="space-y-4 mb-8">
                                        {/* Recommended Pro */}
                                        <div className="bg-white p-4 rounded-xl border-2 border-indigo-100 shadow-sm relative overflow-hidden">
                                            <div className="absolute top-0 left-0 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg">
                                                OUR PICK
                                            </div>
                                            <div className="flex gap-4 items-start">
                                                <div className="w-12 h-12 bg-slate-200 rounded-lg flex-shrink-0 bg-cover bg-center" style={{ backgroundImage: 'url(https://placehold.co/100x100/333/fff?text=Luxe)' }}></div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="font-bold text-slate-900">LuxeHome Media</h4>
                                                        <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                                                            <Star size={12} fill="currentColor" /> 4.9 (128)
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1">Specializes in HDR & Drone. 24hr turnaround.</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-xs font-semibold text-green-600">$199 package</span>
                                                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">Google Verified</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button className="w-full mt-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                                                Let's Schedule Now
                                            </button>
                                        </div>

                                        {/* Other Pros */}
                                        {[
                                            { name: "Philly Real Estate Pics", rating: "4.7", reviews: "84", price: "$150", bg: "bg-slate-50" },
                                            { name: "Main Line Visuals", rating: "4.8", reviews: "42", price: "$225", bg: "bg-slate-50" }
                                        ].map((pro, i) => (
                                            <div key={i} className={`p-3 rounded-xl border border-slate-200 ${pro.bg} flex items-center justify-between`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-200 rounded-lg flex-shrink-0 opacity-50"></div>
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-slate-700">{pro.name}</h4>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <span className="flex items-center gap-0.5"><Star size={10} className="text-amber-400" fill="currentColor" /> {pro.rating}</span>
                                                            <span>• {pro.price}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button className="text-xs font-medium text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 px-3 py-1.5 rounded bg-white">
                                                    Select
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lockbox Modal */}
            {showLockboxModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Lock className="w-5 h-5 text-indigo-600" /> Secure Lockbox Setup
                            </h2>
                            <button onClick={() => setShowLockboxModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3 text-sm text-amber-800">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
                                <div>
                                    <strong>Important Security Step:</strong> This code will only be shared with verified licensed agents who schedule a showing through the platform.
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Lockbox Serial Number</label>
                                <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" placeholder="e.g. SN-482910" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Shackle Code</label>
                                    <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" placeholder="4-digit" />
                                    <p className="text-xs text-slate-500 mt-1">To hang/remove the box</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Access Code</label>
                                    <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" placeholder="4-digit" />
                                    <p className="text-xs text-slate-500 mt-1">To get the key</p>
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input type="checkbox" className="mt-1" />
                                    <span className="text-sm text-slate-600">I have placed a spare key inside the lockbox and verified it opens the door.</span>
                                </label>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setShowLockboxModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:text-slate-900">Cancel</button>
                            <button onClick={() => { setShowLockboxModal(false); showToast("Lockbox registered!", "success"); }} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-sm">
                                Register Lockbox
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Yard Sign Modal */}
            {showSignModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Home className="w-5 h-5 text-indigo-600" /> Yard Sign Scheduling
                            </h2>
                            <button onClick={() => setShowSignModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex items-start gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center border border-slate-200 font-bold text-2xl shadow-sm text-indigo-600">
                                    FY
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900">Standard Post Panel</h4>
                                    <p className="text-sm text-slate-500 mt-1">Professional wooden post with high-reflectivity aluminum panel. Includes brochure box.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Select Installation Date</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Mon, Dec 12', 'Tue, Dec 13', 'Wed, Dec 14'].map((date, i) => (
                                        <button key={i} className={`p-3 text-sm border rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors ${i === 1 ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600' : 'border-slate-200 text-slate-600'}`}>
                                            {date}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Installation Instructions (Optional)</label>
                                <textarea className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none min-h-[80px] text-sm" placeholder="e.g. Please place near the driveway, watch out for sprinkler heads."></textarea>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setShowSignModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:text-slate-900">Cancel</button>
                            <button onClick={() => { setShowSignModal(false); showToast("Installation scheduled!", "success"); }} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-sm">
                                Schedule Installation
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Property Description Modal */}
            {showDescriptionModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-indigo-600" /> AI-Enhanced Description
                            </h2>
                            <button onClick={() => setShowDescriptionModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex gap-2 mb-2">
                                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">Tone: Professional</span>
                                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">Focus: Family Friendly</span>
                                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">Length: ~250 words</span>
                            </div>

                            <div className="relative">
                                <textarea
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none min-h-[300px] text-slate-600 leading-relaxed resize-none"
                                    defaultValue={`Welcome home to ${propertyData.address}! This charming ${propertyData.details?.bedrooms || 3}-bedroom, ${propertyData.details?.bathrooms || 2.5}-bath residence offers the perfect blend of comfort and convenience. 

As you step inside, you'll be greeted by an open-concept living area bathed in natural light, perfect for both relaxing and entertaining. The updated kitchen features modern appliances and ample counter space, making meal prep a delight.

Retreat to the spacious master suite, your private oasis after a long day. The additional bedrooms provide plenty of room for family, guests, or a home office.

Outside, enjoy the well-maintained yard, ideal for summer barbecues or morning coffee. Located just minutes from local shops, top-rated schools, and parks, this home truly has it all.

Don't miss this opportunity to own a piece of this wonderful community. Schedule your showing today!`}
                                ></textarea>
                                <div className="absolute bottom-3 right-3 flex gap-2">
                                    <button className="px-3 py-1.5 bg-white border border-slate-200 shadow-sm rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-200">
                                        ✨ Regenerate
                                    </button>
                                    <button className="px-3 py-1.5 bg-white border border-slate-200 shadow-sm rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-200">
                                        Shorten
                                    </button>
                                </div>
                            </div>

                            <p className="text-xs text-slate-400 text-center">
                                *This description will be syndicated to Zillow, Realtor.com, Trulia, and the MLS.
                            </p>
                        </div>
                        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setShowDescriptionModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:text-slate-900">Save Draft</button>
                            <button onClick={() => { setShowDescriptionModal(false); showToast("Description Published!", "success"); }} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-sm">
                                Approve & Publish
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Price Modal */}
            {showPriceModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-indigo-600" /> Finalize Listing Price
                            </h2>
                            <button onClick={() => setShowPriceModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-sm">
                                <strong>AI Analysis:</strong> Your property is positioned well for the Spring market.
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Approved List Price ($)</label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-2xl font-bold text-slate-700"
                                    defaultValue={propertyData.price}
                                />
                                <p className="text-xs text-slate-500 mt-2">This price will be syndicated to MLS.</p>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setShowPriceModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:text-slate-900">Cancel</button>
                            <button onClick={() => { setShowPriceModal(false); showToast("Price Finalized!", "success"); }} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-sm">
                                Confirm Price
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon: Icon, label, value, trend, trendUp, color, bg }: any) {
    return (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className={cn("p-2 rounded-lg", bg)}>
                    <Icon className={cn("w-5 h-5", color)} />
                </div>
                <div className={cn("text-xs font-semibold px-2 py-1 rounded-full bg-slate-50 text-slate-600")}>
                    7d
                </div>
            </div>
            <div>
                <div className="text-2xl font-bold text-slate-900 mb-1">{value}</div>
                <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-500">{label}</div>
                    <div className={cn("text-xs font-semibold", trendUp ? "text-green-600" : "text-slate-500")}>
                        {trend}
                    </div>
                </div>
            </div>
        </div>
    );
}

function TaskItem({ label, status, icon: Icon, onClick, urgent }: any) {
    const isDone = status === 'done';
    return (
        <div
            onClick={!isDone ? onClick : undefined}
            className={cn(
                "flex items-center justify-between p-3 rounded-lg transition-colors group",
                !isDone && onClick ? "hover:bg-slate-50 cursor-pointer" : ""
            )}
        >
            <div className="flex items-center gap-3">
                <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border flex-shrink-0",
                    isDone ? "bg-green-100 border-green-200 text-green-600" : "bg-white border-slate-200 text-slate-400 group-hover:border-indigo-200 group-hover:text-indigo-500"
                )}>
                    {isDone ? <CheckCircle size={14} /> : <Icon size={14} />}
                </div>
                <div>
                    <span className={cn(
                        "text-sm font-medium block",
                        isDone ? "text-slate-400 line-through" : "text-slate-700 group-hover:text-slate-900"
                    )}>
                        {label}
                    </span>
                    {urgent && !isDone && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 mt-0.5">
                            Action Required
                        </span>
                    )}
                </div>
            </div>
            {!isDone && <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400" />}
        </div>
    );
}

function PlaceholderTab({ title, icon: Icon, desc }: any) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                <Icon className="w-10 h-10 text-slate-300" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{title} Coming Soon</h2>
            <p className="text-slate-500 max-w-md">{desc}</p>
        </div>
    );
}
