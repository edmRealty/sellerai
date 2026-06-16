"use client";

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';

import { useApp } from '@/lib/context/app-context';

export function TopNavigation() {
    const { user, logout, setAuthModalOpen } = useApp();
    const isAuthenticated = !!user;

    const [activeModal, setActiveModal] = useState<string | null>(null);

    // Public Visitor Menu
    const menuGroups = {
        "Main Menu": [
            { id: 'home', label: 'Home', href: 'https://housingpa.com', external: true },
            { id: 'how-it-works', label: 'How it works', href: 'https://housingpa.com/#how-it-works' }, // assuming anchor or page
            { id: 'meet-team', label: 'Meet the team' },
            { id: 'is-really-2', label: 'Is it really 2%?' },
            { id: 'savings', label: '5% vs 2% Comparison' },
            { id: 'about', label: 'About us' },
            { id: 'contact', label: 'Contact' }
        ]
    };

    // Authenticated User Menu
    const sellerMenuGroups = {
        "Seller Tools": [
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'contact', label: 'Concierge Help' }
        ]
    };

    // Switch menu based on auth status
    const activeMenuGroups = isAuthenticated ? sellerMenuGroups : menuGroups;

    const handleMenuClick = (item: any) => {
        if (item.external && item.href) {
            window.location.href = item.href;
            return;
        }
        setActiveModal(item.id);
    };

    const renderModalContent = (id: string) => {
        // Placeholder content matching the IDs
        switch (id) {
            case 'is-really-2':
                return (
                    <div className="p-4 space-y-4">
                        <h3 className="text-xl font-bold text-slate-900">Is it really 2%?</h3>
                        <p className="text-slate-600">Yes! We have streamlined the process using AI to pass the savings directly to you.</p>
                        <ul className="list-disc pl-5 space-y-2 text-slate-600">
                            <li>2% Listing Agent Fee (HousingPA)</li>
                            <li>+ Buyer's Agent Fee (Flexible)</li>
                            <li><strong>= Huge Savings vs 6%</strong></li>
                        </ul>
                    </div>
                );
            case 'savings':
                return (
                    <div className="p-4 space-y-4">
                        <h3 className="text-xl font-bold text-slate-900">5% vs 2% Comparison</h3>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <p className="text-sm font-bold text-slate-500 uppercase">Traditional (5-6%)</p>
                                    <p className="text-2xl font-bold text-red-500">$25,000</p>
                                    <p className="text-xs text-slate-400">on a $500k home</p>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-500 uppercase">HousingPA (2%)</p>
                                    <p className="text-2xl font-bold text-green-600">$10,000</p>
                                    <p className="text-xs text-slate-400">on a $500k home</p>
                                </div>
                            </div>
                            <div className="mt-4 text-center">
                                <p className="font-bold text-slate-800">You Save: $15,000</p>
                            </div>
                        </div>
                    </div>
                );
            case 'meet-team':
                return <div className="p-4"><h3 className="font-bold">Meet the Team</h3><p>Our team of expert agents and AI specialists.</p></div>;
            case 'how-it-works':
                return <div className="p-4"><h3 className="font-bold">How it Works</h3><p>1. Sign Up <br />2. AI Evaluation <br />3. List & Save</p></div>;
            case 'about':
                return <div className="p-4"><h3 className="font-bold">About Us</h3><p>Redefining real estate in Pennsylvania.</p></div>;
            case 'contact':
                return <div className="p-4"><h3 className="font-bold">Contact Support</h3><p className="text-lg">📞 (215) 555-0123</p><p>✉️ support@housingpa.com</p></div>;
            default:
                return null;
        }
    };

    // Flatten for Title Lookup
    const allItems = [...Object.values(menuGroups).flat(), ...Object.values(sellerMenuGroups).flat()];

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <>
            {/* Top Navigation Container */}
            <div className="fixed top-6 right-8 flex gap-4 items-center z-[50]" style={{ pointerEvents: 'auto' }}>
                {/* Auth Buttons - Hidden on small screens */}
                <div className="hidden md:flex gap-3">
                    <div className="header-property-address font-bold text-gray-700 mr-4" style={{ display: 'none' }} id="persistent-header-address"></div>

                    {/* Dynamic Auth Button */}
                    {/* Dynamic Auth Button - Icon only on mobile */}
                    {isAuthenticated ? (
                        <button
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-all bg-white border border-slate-200 rounded-full shadow-sm hover:shadow-md hover:border-slate-300 active:scale-95 flex items-center justify-center"
                            onClick={() => {
                                logout();
                            }}
                            title="Sign Out"
                        >
                            <span className="hidden md:inline">Sign Out</span>
                            <span className="md:hidden text-lg">🚪</span> {/* Icon for Mobile */}
                        </button>
                    ) : (
                        <button
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-all bg-white border border-slate-200 rounded-full shadow-sm hover:shadow-md hover:border-slate-300 active:scale-95 flex items-center justify-center"
                            onClick={() => setAuthModalOpen(true)}
                            title="Sign In / Sign Up"
                        >
                            <span className="hidden md:inline">Sign In / Sign Up</span>
                            <span className="md:hidden text-lg">👤</span> {/* Icon for Mobile */}
                        </button>
                    )}
                </div>

                {/* Menu Toggle */}
                <div className="relative">
                    <button
                        className={`w-8 h-8 flex items-center justify-center rounded-full shadow-sm text-slate-600 transition-all ${isMenuOpen ? 'bg-slate-900 text-white rotate-90' : 'bg-white border border-slate-200 hover:text-slate-900 hover:border-slate-300 hover:shadow-md'}`}
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label="Toggle Menu"
                    >
                        {isMenuOpen ? (
                            <span className="text-xl">✕</span>
                        ) : (
                            <span className="text-xl">☰</span>
                        )}
                    </button>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                        <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                            <div className="max-h-[80vh] overflow-y-auto custom-scrollbar">
                                {Object.entries(activeMenuGroups).map(([group, items]) => (
                                    <div key={group} className="border-b border-slate-100 last:border-0 pb-2">
                                        <div className="px-5 py-3 bg-slate-50/50 text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
                                            {group}
                                        </div>
                                        <div className="py-1">
                                            {items.map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => {
                                                        handleMenuClick(item);
                                                        setIsMenuOpen(false);
                                                    }}
                                                    className="w-full text-left px-5 py-3 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all flex items-center justify-between group"
                                                >
                                                    {item.label}
                                                    {(item as any).href ? (
                                                        <span className="opacity-0 group-hover:opacity-100 text-slate-400 text-xs transition-opacity">↗</span>
                                                    ) : (
                                                        <span className="opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity">→</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {/* Render Modal if active */}
            {activeModal && (
                <Modal
                    isOpen={!!activeModal}
                    onClose={() => setActiveModal(null)}
                    title={allItems.find(i => i.id === activeModal)?.label || 'Info'}
                >
                    <div className="modal-rich-content">
                        {renderModalContent(activeModal)}
                    </div>
                </Modal>
            )}
            <style jsx>{`
                .menu-item-hover:hover { background-color: #f1f5f9 !important; color: #10a37f !important; }
            `}</style>
        </>
    );
}
