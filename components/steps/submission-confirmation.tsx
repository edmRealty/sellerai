"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context/app-context';

export function SubmissionConfirmation() {
    // States: submitting -> sent_agent -> sent_seller -> completed
    const [status, setStatus] = useState<'submitting' | 'sent_agent' | 'sent_seller' | 'completed'>('submitting');
    const { propertyData, navigateToStep } = useApp();

    useEffect(() => {
        // Just stay in "sent_seller" state permanently for this step
        setStatus('sent_seller');
    }, []);

    const steps = [
        { id: 'gen', label: 'Generating Contracts', done: true },
        { id: 'agent', label: 'Agent Signature (Me)', done: ['sent_agent', 'sent_seller', 'completed'].includes(status) },
        { id: 'seller', label: 'Seller Signature (You)', done: ['completed'].includes(status), current: status === 'sent_seller' },
        { id: 'final', label: 'Listing Active', done: status === 'completed' }
    ];

    return (
        <div className="confirmation-container" style={{ textAlign: 'center', padding: '3rem 1rem', maxWidth: '600px', margin: '0 auto' }}>
            {status !== 'completed' ? (
                // WAITING STATE
                <div className="waiting-state">
                    <div className="animation-container" style={{ position: 'relative', height: '150px', marginBottom: '2rem' }}>
                        {/* CSS Pulse Animation */}
                        <div style={{
                            width: '100px',
                            height: '100px',
                            background: '#eff6ff',
                            borderRadius: '50%',
                            margin: '0 auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '4px solid #3b82f6',
                            boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
                            animation: 'pulse 2s infinite'
                        }}>
                            <span style={{ fontSize: '3rem' }}>📧</span>
                        </div>
                    </div>

                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>
                        Please Check Your Email
                    </h2>

                    <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '2rem' }}>
                        You will receive a <strong>Consumer Notice</strong> and your <strong>Listing Agreement</strong> to review and sign.
                    </p>

                    {/* DEV ONLY: Simulate Signature Completion */}
                    <div style={{ marginTop: '3rem', borderTop: '1px dashed #e2e8f0', paddingTop: '1rem' }}>
                        <button
                            onClick={() => navigateToStep(8)}
                            style={{
                                background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.8rem', cursor: 'pointer'
                            }}
                        >
                            (Dev: Simulate Signature Complete)
                        </button>
                    </div>
                </div>
            ) : (
                // SUCCESS STATE
                <div className="success-state" style={{ animation: 'fadeIn 1s ease' }}>
                    <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🎉</div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', marginBottom: '1rem' }}>
                        Congratulations!
                    </h2>
                    <h3 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '2rem' }}>
                        Your listing is now ACTIVE.
                    </h3>
                    <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: 1.6 }}>
                        You have successfully completed the set up. Your property will be syndicated to Zillow, Realtor.com, and the MLS within 24 hours.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <button className="dashboard-btn" style={{ padding: '1rem', background: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                            Go to Dashboard
                        </button>
                        <button className="share-btn" style={{ padding: '1rem', background: 'white', border: '2px solid #e2e8f0', color: '#1e293b', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                            Share Listing
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes pulse {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
                    70% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(59, 130, 246, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
