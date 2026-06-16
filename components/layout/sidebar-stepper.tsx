"use client";

import React from 'react';
import { useApp } from '@/lib/context/app-context';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { notificationService } from '@/lib/services/notifications';
import { createClient } from '@supabase/supabase-js';

const isValidHttpUrl = (value?: string) => {
    if (!value) return false;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const rawSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const hasValidSupabase = isValidHttpUrl(rawSupabaseUrl) && rawSupabaseAnonKey.length > 20;

const supabase = createClient(
    hasValidSupabase ? rawSupabaseUrl : 'https://placeholder.supabase.co',
    hasValidSupabase ? rawSupabaseAnonKey : 'fallback-key-for-build'
);

export function SidebarStepper() {
    const { currentStep, navigateToStep, resetApp, user, login, logout, saveUserProgress, isAuthModalOpen, setAuthModalOpen, showToast } = useApp();
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = React.useState(true); // Default to collapsed

    // Mobile Detection
    const [isMobile, setIsMobile] = React.useState(false);
    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const [authMode, setAuthMode] = React.useState<'signup' | 'signin'>('signup');
    const [emailInput, setEmailInput] = React.useState('');
    const [passwordInput, setPasswordInput] = React.useState('');

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);

    const handleStartOver = () => {
        if (confirm("Are you sure you want to start over? This will clear ALL data.")) {
            resetApp();
            window.location.href = '/';
        }
    };



    const handleAuthSubmit = async () => {
        try {
            if (!emailInput || !emailInput.includes('@')) {
                showToast("Please enter a valid email.", "error");
                return;
            }

            if (authMode === 'signup') {
                if (!hasValidSupabase) {
                    showToast("Signup is unavailable until Supabase is configured.", "error");
                    return;
                }
                // Sign Up Flow - Client Side Supabase
                try {
                    const { data, error } = await supabase.auth.signUp({
                        email: emailInput,
                        password: passwordInput || 'temp123'
                    });

                    if (error) {
                        if (error.message.includes("already registered")) {
                            showToast("User already exists. Please sign in.", "info");
                            setAuthMode('signin');
                            return;
                        }
                        throw error;
                    }

                    // Success
                    login(emailInput);
                    saveUserProgress(emailInput);

                    // Notify Admin (With Auth Token for Security)
                    const token = data.session?.access_token;

                    if (token) {
                        // Fire and forget
                        fetch('/api/send-email', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                to: 'ben@housingpa.com',
                                type: 'admin_notification',
                                subject: `[ADMIN] 🚀 New User Started: ${emailInput}`,
                                address: "Property pending..."
                            })
                        }).catch(e => console.error("Admin notify failed", e));
                    }

                    setAuthModalOpen(false);
                    // Standard welcome email or other logic...
                    await notificationService.sendWelcomeEmail(emailInput);

                } catch (e: any) {
                    console.error("Signup Error", e);
                    showToast(e.message || "Signup failed", "error");
                    return;
                }

                // Alert handled by login() mostly, but for account creation specific:
                // showToast("Account created! Check your email.", "success"); 
                // Context login() handles the toast.
                setAuthModalOpen(false);
            } else {
                // Sign In Flow
                login(emailInput); // Loads data and toasts
                setAuthModalOpen(false);
            }
        } catch (error) {
            console.error("Auth Error:", error);
            showToast("Something went wrong. Please try again.", "error");
        }
    };


    // "Unrevealed": We will hide steps > currentStep + 1 or just dim them heavily?
    // "keep the next ones unrervelead" -> Maybe just don't show text?
    // Let's go with: Steps > Current are opacity-50 and grayscale.
    const steps = [
        { id: 1, label: "Address", description: "Property Location" },
        { id: 2, label: "Details", description: "Verify Info" },
        { id: 3, label: "Valuation", description: "AI Market Analysis" },
        { id: 4, label: "Seller Info", description: "Your Details" },
        { id: 5, label: "Add-Ons", description: "Boost Listing" },
        { id: 6, label: "Review", description: "Final Check" },
        { id: 7, label: "Confirm", description: "Email Verification" },
        { id: 8, label: "Sign", description: "e-Signature" },
        // Gaps created to align Dashboard to 12 as requested
        { id: 12, label: "Dashboard", description: "Manage Listing" },
        { id: 13, label: "Photography", description: "Schedule Photos" },
        { id: 14, label: "Lockbox", description: "Install Lockbox" },
        { id: 15, label: "Yard Sign", description: "Place Yard Sign" },
        { id: 16, label: "Disclosures", description: "Seller's Disclosure" },
        { id: 17, label: "Showings", description: "Manage Showings" },
        { id: 18, label: "Final Review", description: "Listing Live" },
        { id: 19, label: "Offers", description: "Review Offers" },
        { id: 20, label: "Negotiation", description: "Negotiate Terms" },
        { id: 21, label: "Closing Prep", description: "Prepare for Closing" },
        { id: 22, label: "Settlement", description: "Finalize Deal" },
        { id: 23, label: "Feedback", description: "Review & Like" }
    ];

    // Auto-Scroll Active Step into View
    React.useEffect(() => {
        const activeElement = document.getElementById(`step-${currentStep}`);
        if (activeElement) {
            // Use 'nearest' to avoid jumping the whole page, just ensure it's in view
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [currentStep]);


    return (
        <>
            {/* Sidebar Toggle Button */}
            <button
                onClick={toggleSidebar}
                className={cn(
                    "fixed top-6 z-[1050] w-8 h-8 flex items-center justify-center rounded-r-lg bg-white text-slate-900 border border-l-0 border-slate-200 shadow-sm hover:bg-slate-50 transition-all duration-300 ease-in-out cursor-pointer hidden md:flex",
                    isCollapsed ? "left-[60px]" : "left-[320px]"
                )}
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
                <span className="text-lg font-bold pb-1">{isCollapsed ? "+" : "-"}</span>
            </button>

            <aside className={cn("ai-sidebar max-h-screen overflow-y-auto custom-scrollbar", isCollapsed && "collapsed")} id="sidebar">
                {/* Mobile Handle / Toggle Area */}
                <div
                    className="md:hidden w-full flex flex-col items-center justify-center pt-3 pb-3 cursor-pointer bg-slate-200 border-b border-slate-300 hover:bg-slate-300 transition-colors shadow-sm"
                    onClick={toggleSidebar}
                >
                    <div className="w-12 h-1.5 bg-slate-500 rounded-full mb-1"></div>
                    <span className="text-xs text-slate-700 font-bold uppercase tracking-wider flex items-center gap-1">
                        {isCollapsed ? `View Menu (Step ${currentStep}) ▲` : "Close Menu ▼"}
                    </span>
                </div>


                <div className="sidebar-inner-content">
                    <div className="sidebar-header">
                        <div className="ai-logo flex items-center gap-3">
                            {/* Avatar Trigger */}
                            <div
                                onClick={() => window.location.href = '/dashboard/profile'}
                                className="cursor-pointer w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center hover:bg-white hover:shadow-md transition-all group"
                                title="My Profile"
                            >
                                {user?.avatar ? (
                                    <img src={user.avatar} className="w-full h-full rounded-full object-cover" alt="Me" />
                                ) : (
                                    <span className="text-lg group-hover:scale-110 transition-transform">👤</span>
                                )}
                            </div>

                            <div className="logo-text">
                                <div className="logo-title">housingPA AI</div>
                                <div className="logo-subtitle">Property Intelligence</div>
                            </div>
                        </div>
                    </div>

                    <nav className="sidebar-nav">
                        <div className="step-list">
                            {/* STANDARD FLOW STEPS */}
                            {steps.map((step) => {
                                // "Unrevealed" Logic: User prefers the 'blurry' look.
                                // Logic: 
                                // Current = Active
                                // Current + 1 = blurred (visible but next) -> Actually user said "next ones unrevealed".
                                // Let's use the original logic: 
                                // > Current + 1 = heavily-blurred
                                // > Current = blurred
                                // Logic: Allow clicking ANY step to review/edit
                                // We kept the blurring for visual hierarchy but removed the touch restriction.

                                let stepClass = "step-item";
                                if (step.id === currentStep) stepClass += " active";
                                else if (step.id > currentStep + 1) stepClass += " heavily-blurred";
                                else if (step.id > currentStep) stepClass += " blurred";

                                return (
                                    <div
                                        key={step.id}
                                        id={`step-${step.id}`}
                                        onClick={() => {
                                            // 1. Update Context Step
                                            navigateToStep(step.id);

                                            // 2. Handle Routing
                                            if (step.id <= 8) {
                                                // Wizard Step
                                                if (pathname.includes('/dashboard')) {
                                                    // Force hard nav or router push? Router push is faster.
                                                    // But Wizard relies on state. Context preserves it? Yes context should be global if wrapped at layout.
                                                    // Actually context state is in memory, reset on refresh unless loaded from localstorage.
                                                    // Let's rely on context being preserved since it's an SPA transition.
                                                    window.location.href = '/'; // Safety net to ensure clean mounting of Wizard? 
                                                    // Or just router.push('/'). Context should hold.
                                                    // Let's try router.push first, cleaner.
                                                    // optimization: import useRouter
                                                }
                                            } else {
                                                // Dashboard Step (9+)
                                                if (!pathname.includes('/dashboard')) {
                                                    window.location.href = '/dashboard?activated=true';
                                                }
                                            }
                                        }}
                                        className={cn(
                                            "step-item",
                                            step.id === currentStep && "active",
                                            // Only blur if it's REALLY far future? User said "allow.. on any previous step".
                                            // Let's remove blur for "past" steps logic if any.
                                            // Existing logic:
                                            step.id > currentStep && "blurred"
                                        )}
                                    >
                                        <div className="step-indicator">
                                            <div className={cn("step-number", step.id < currentStep && "bg-green-500 text-white border-none")}>
                                                {step.id < currentStep ? "✓" : step.id}
                                            </div>
                                            {/* Connector Line Logic (Manual CSS usually handles this in step-indicator::after) */}
                                        </div>
                                        <div className="step-info">
                                            <div className={cn("step-title", step.id === 12 && "font-black text-white/90 uppercase tracking-widest")}>{step.label}</div>
                                            <div className="step-description">{step.description}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </nav>

                    {/* Footer Actions */}
                    <div className="sidebar-footer" style={{ flexDirection: 'column', gap: '8px', alignItems: 'flex-start', padding: '16px' }}>
                        {user ? (
                            <>
                                <a
                                    href="/dashboard"
                                    className="save-progress-btn text-center no-underline flex items-center justify-center gap-2"
                                    style={{ fontSize: '11px', padding: '4px 8px', width: 'auto', background: '#3b82f6', color: 'white', border: 'none' }}
                                >
                                    📊 Dashboard
                                </a>
                                <button
                                    onClick={logout}
                                    className="save-progress-btn"
                                    style={{ fontSize: '11px', padding: '4px 8px', width: 'auto', background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1' }}
                                >
                                    Log Out
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setAuthModalOpen(true)}
                                className="save-progress-btn"
                                style={{ fontSize: '11px', padding: '4px 8px', width: 'auto' }}
                            >
                                💾 Save
                            </button>
                        )}

                        <button
                            onClick={handleStartOver}
                            className="save-progress-btn"
                            style={{ fontSize: '11px', padding: '4px 8px', width: 'auto', background: 'transparent', color: '#ef4444', border: '1px solid #fecaca' }}
                        >
                            Start Over
                        </button>
                    </div>
                </div>
            </aside>

            {/* SAVE PROGRESS SIGNUP MODAL */}
            {
                isAuthModalOpen && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white p-4 rounded-xl shadow-2xl max-w-[240px] w-full mx-4 relative text-sm">
                            <button
                                onClick={() => setAuthModalOpen(false)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold"
                            >
                                ✕
                            </button>

                            {user ? (
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
                                    <h3 className="text-xl font-bold text-slate-900">Progress Saved</h3>
                                    <p className="text-slate-500 text-sm mt-2 mb-6">Logged in as {user.email}</p>
                                    <button
                                        onClick={() => {
                                            saveUserProgress(user.email);
                                            alert("Progress Synced!");
                                            setAuthModalOpen(false);
                                        }}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg mb-3"
                                    >
                                        Sync Now
                                    </button>
                                    <button onClick={logout} className="text-red-500 text-sm hover:underline">Log Out</button>
                                </div>
                            ) : (
                                <>
                                    <div className="text-center mb-6">
                                        <h3 className="text-xl font-bold text-slate-900">
                                            {authMode === 'signup' ? "Save Your Progress" : "Welcome Back"}
                                        </h3>
                                        <div className="flex gap-4 justify-center mt-4 border-b border-slate-100 pb-1">
                                            <button
                                                onClick={() => setAuthMode('signup')}
                                                className={cn("text-sm pb-2 border-b-2 transition-colors", authMode === 'signup' ? "border-blue-600 text-blue-600 font-bold" : "border-transparent text-slate-400")}
                                            >
                                                New Account
                                            </button>
                                            <button
                                                onClick={() => setAuthMode('signin')}
                                                className={cn("text-sm pb-2 border-b-2 transition-colors", authMode === 'signin' ? "border-blue-600 text-blue-600 font-bold" : "border-transparent text-slate-400")}
                                            >
                                                Sign In
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <input
                                            type="email"
                                            placeholder="Email Address"
                                            className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-slate-50"
                                            value={emailInput}
                                            onChange={(e) => setEmailInput(e.target.value)}
                                        />
                                        <input
                                            type="password"
                                            placeholder={authMode === 'signup' ? "Create Password" : "Password"}
                                            className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-slate-50"
                                            value={passwordInput}
                                            onChange={(e) => setPasswordInput(e.target.value)}
                                        />
                                        <button
                                            onClick={handleAuthSubmit}
                                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all text-sm"
                                        >
                                            {authMode === 'signup' ? "Create Account & Save" : "Sign In & Load"}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )
            }
        </>
    );
}
