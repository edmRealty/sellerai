"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { SERVICES_CATALOG, ServiceItem } from '../data/services-db';

type PropertyData = {
    address?: string;
    details?: any;
    seller?: any;
    price?: number;
    priceSource?: 'manual' | 'comps';
    addons?: any[];
    images?: string[];
    condition?: 'new' | 'great' | 'good' | 'fair' | 'fixer' | 'rehab';
    features?: string[];
    aiTags?: string[];
};

type CartItem = {
    id: string;
    name: string;
    price: number;
    quantity?: number; // New
    mandatory: boolean; // Kept for type compatibility, but mostly false now
};

// Create a lookup map for easy access
const SERVICES_MAP = SERVICES_CATALOG.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
}, {} as Record<string, ServiceItem>);

type AppContextType = {
    currentStep: number;
    propertyData: PropertyData;
    cart: CartItem[];
    addons: typeof SERVICES_MAP; // Exposed for components that might need it
    brokerFee: number;
    totalBalance: number;
    user: { email: string; avatar?: string } | null;
    isLoading: boolean;
    setCurrentStep: (step: number) => void;
    setPropertyData: (data: any) => void;
    navigateToStep: (step: number, options?: { force?: boolean }) => void;
    toggleAddon: (addonId: string, quantity?: number) => void;
    updateBrokerFee: (price: number) => void;
    resetApp: () => void;
    login: (email: string) => void;
    logout: () => void;
    saveUserProgress: (email: string) => void;
    isAuthModalOpen: boolean;
    setAuthModalOpen: (isOpen: boolean) => void;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    // Canonical Workflow
    workflow: WorkflowState;
    updateWorkflow: (updates: Partial<WorkflowState>, emailOverride?: string) => void;
    updateWorkflowTask: (taskId: string, status: 'locked' | 'todo' | 'in_progress' | 'pending_admin' | 'done') => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- CANONICAL WORKFLOW STATE ---
export type WorkflowStage = 'activation' | 'price_verification' | 'esign' | 'pre_market' | 'pending_publish' | 'active_market' | 'offers' | 'inspections' | 'appraisal' | 'negotiations' | 'closing_prep' | 'closing' | 'after_closing';

export type WorkflowState = {
    emailConfirmed: boolean;
    passwordSet: boolean;
    data: {
        approvedListPrice: number | null;
        propertyAddress?: string;
    };
    dates: {
        esignRequestedAt: string | null;
        esignCompletedAt: string | null;
        publishReadyNotifiedAt: string | null;
        listingActiveAt: string | null;
    };
    status: {
        mls: 'draft' | 'pending_publish' | 'active';
        tasks: Record<string, 'locked' | 'todo' | 'in_progress' | 'pending_admin' | 'done'>;
    };
    stage: WorkflowStage;
};

const DEFAULT_WORKFLOW: WorkflowState = {
    emailConfirmed: false,
    passwordSet: false,
    data: { approvedListPrice: null },
    dates: { esignRequestedAt: null, esignCompletedAt: null, publishReadyNotifiedAt: null, listingActiveAt: null },
    status: {
        mls: 'draft',
        tasks: {
            '14': 'locked', // Upload Docs (Commercial) / Final Review (Res) - IDs need alignment, using standard ID flow
            // Standard IDs from Dashboard:
            // 9: Photo, 10: Lockbox, 11: Sign, 12: Disclosure, 13: Showing, 14: Final/Price
            'price_verification': 'todo', // Special task ID for the workflow
            '9': 'locked',
            '10': 'locked',
            '11': 'locked',
            '12': 'locked', // Can be done earlier? Usually unlocked.
            '13': 'locked',
            'esign': 'locked',
        }
    },
    stage: 'activation'
};

export function AppProvider({ children }: { children: ReactNode }) {
    const [currentStep, setCurrentStepState] = useState(1);
    const [propertyData, setPropertyDataState] = useState<PropertyData>({});
    const [cart, setCart] = useState<CartItem[]>([]);
    const [brokerFee, setBrokerFee] = useState(0);
    const [user, setUser] = useState<{ email: string; avatar?: string } | null>(null);
    const [isAuthModalOpen, setAuthModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean } | null>(null);

    // WORKFLOW STATE
    const [workflow, setWorkflow] = useState<WorkflowState>(DEFAULT_WORKFLOW);

    // Initialize
    useEffect(() => {
        // Restore User Session
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                if (parsedUser && parsedUser.email) {
                    setUser(parsedUser);
                    loadWorkflow(parsedUser.email);
                }
            } catch (e) {
                console.error("Failed to restore user session", e);
            }
        }
        setIsLoading(false);
    }, []);

    // Ensure Broker Fee is synced with Property Data Price on Load/Change
    useEffect(() => {
        if (propertyData.price) {
            setBrokerFee(propertyData.price * 0.02); // Fixed to 2% matching generic text
        }
    }, [propertyData.price]);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type, visible: true });
        setTimeout(() => setToast(prev => prev ? { ...prev, visible: false } : null), 3000);
    };

    const setPropertyData = (data: any) => {
        if (typeof data === 'function') {
            setPropertyDataState(data);
        } else {
            setPropertyDataState(prev => ({ ...prev, ...data }));
        }
    };

    const navigateToStep = (step: number, options?: { force?: boolean }) => {
        if (!options?.force && step >= 8 && !workflow.emailConfirmed) {
            showToast("Please confirm your email to continue.", "info");
            setCurrentStepState(7);
            window.scrollTo(0, 0);
            return;
        }
        setCurrentStepState(step);
        window.scrollTo(0, 0);
    };

    const toggleAddon = (addonId: string, quantity: number = 1) => {
        const addon = SERVICES_MAP[addonId];
        if (!addon) return;
        const price = typeof addon.price_value === 'number' ? addon.price_value : 0;

        setCart(prev => {
            const exists = prev.find(item => item.id === addonId);
            if (quantity <= 0) return prev.filter(item => item.id !== addonId);
            if (exists) return prev.map(item => item.id === addonId ? { ...item, quantity } : item);
            return [...prev, { id: addonId, name: addon.name, price, quantity, mandatory: false }];
        });
    };

    const updateBrokerFee = (price: number) => {
        setBrokerFee(price * 0.02);
    };

    // --- WORKFLOW HELPERS ---
    const loadWorkflow = (email: string) => {
        const saved = localStorage.getItem(`workflow_${email}`);
        if (saved) {
            try {
                setWorkflow(JSON.parse(saved));
            } catch (e) {
                console.error("Error loading workflow", e);
                setWorkflow(DEFAULT_WORKFLOW);
            }
        } else {
            setWorkflow(DEFAULT_WORKFLOW);
        }

        // Also load property data
        const savedData = localStorage.getItem(`propertyData_${email}`);
        if (savedData) setPropertyDataState(JSON.parse(savedData));
    };

    const updateWorkflow = (updates: Partial<WorkflowState>, emailOverride?: string) => {
        setWorkflow(prev => {
            const next = { ...prev, ...updates };
            const persistEmail = emailOverride || user?.email;
            if (persistEmail) {
                localStorage.setItem(`workflow_${persistEmail}`, JSON.stringify(next));
            }
            return next;
        });
    };

    const updateWorkflowTask = (taskId: string, status: 'locked' | 'todo' | 'in_progress' | 'pending_admin' | 'done') => {
        setWorkflow(prev => {
            const next = {
                ...prev,
                status: {
                    ...prev.status,
                    tasks: { ...prev.status.tasks, [taskId]: status }
                }
            };
            if (user?.email) localStorage.setItem(`workflow_${user.email}`, JSON.stringify(next));
            return next;
        });
    };

    const login = (email: string) => {
        setUser({ email });
        localStorage.setItem('currentUser', JSON.stringify({ email }));
        loadWorkflow(email);
        showToast(`Welcome, ${email}!`, 'success');
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('currentUser');
        setWorkflow(DEFAULT_WORKFLOW);
        resetApp();
    };

    const saveUserProgress = (email: string) => {
        if (!email) return;
        localStorage.setItem(`propertyData_${email}`, JSON.stringify(propertyData));
    };

    const resetApp = () => {
        setCurrentStepState(1);
        setPropertyDataState({});
        setCart([]);
        setBrokerFee(0);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('propertyData');
            localStorage.removeItem('completedTaskIds');
            localStorage.removeItem('savedTaskIds');
        }
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    const totalBalance = brokerFee + cartTotal;

    return (
        <AppContext.Provider value={{
            currentStep, propertyData, cart, addons: SERVICES_MAP, brokerFee, totalBalance,
            setCurrentStep: setCurrentStepState, setPropertyData, navigateToStep, toggleAddon, updateBrokerFee,
            resetApp, user, isLoading, login, logout, saveUserProgress,
            isAuthModalOpen, setAuthModalOpen, showToast,
            workflow, updateWorkflow, updateWorkflowTask
        }}>
            {children}
            {/* Global Toast Component */}
            {toast && toast.visible && (
                <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl z-[9999] transition-all duration-300 transform translate-y-0 opacity-100 flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-50 text-red-900 border border-red-200' :
                    toast.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' :
                        'bg-card text-foreground border border-border'
                    }`}>
                    <div className={`w-2 h-2 rounded-full ${toast.type === 'error' ? 'bg-red-500' :
                        toast.type === 'success' ? 'bg-emerald-500' :
                            'bg-slate-500'
                        }`} />
                    <span className="font-medium text-sm">{toast.message}</span>
                </div>
            )}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
