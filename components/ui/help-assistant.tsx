"use client";

import React, { useState } from 'react';
import { useApp } from '@/lib/context/app-context';
import { Modal } from './modal';


export function HelpAssistant() {
    const { currentStep } = useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'menu' | 'guide' | 'contact' | 'about' | 'security'>('menu');

    // Reset to menu when opening
    const handleOpen = () => {
        setActiveTab('menu');
        setIsOpen(true);
    };

    const stepHelpContent: Record<number, { title: string, content: React.ReactNode }> = {
        1: { title: "Getting Started", content: <p>Enter your address to begin. This connects us to local records to speed up the process.</p> },
        2: { title: "Property Details", content: <p>Accurate details (SqFt, Beds, Baths) ensure the most precise valuation for your home.</p> },
        3: { title: "Pricing Strategy", content: <p>You can choose between our AI-recommended price or set your own. Pricing correctly is key to a fast sale.</p> },
        4: {
            title: "How much do I save?",
            content: "We charge a low 2% listing fee compared to the standard 3%, saving you thousands while providing full service."
        },
        5: { title: "Add-On Services", content: <p>Enhance your listing with professional photography or signs. <strong>Note: None of these are mandatory, only highly recommended.</strong></p> },
        6: { title: "Review & Submit", content: <p>Double-check everything. You can always go back to previous steps to make changes before signing.</p> },
        7: { title: "Email Verification", content: <p>We sent a secure link to your email. Click it to activate your dashboard.</p> },
        8: { title: "e-Signature", content: <p>Sign the listing agreement digitally. It's fast, legal, and secure.</p> },
        9: { title: "Photography", content: <p>Professional photos increase views by 400%. <strong>Highly Recommended.</strong></p> },
        10: {
            title: "Lockbox & Access",
            content: (
                <div className="space-y-2">
                    <p><strong>Importance:</strong> A lockbox allows buyer agents to show your home when you aren't there.</p>
                    <p><strong>Types of Lockboxes:</strong></p>
                    <ul className="list-disc pl-5">
                        <li><strong>Electronic (Supra):</strong> Most secure, tracks every agent entry. Recommended.</li>
                        <li><strong>Combo Code:</strong> Simple, mechanical code. Good backup.</li>
                    </ul>
                    <p className="text-sm italic mt-2">Note: Not mandatory, but essential for maximum showings.</p>
                </div>
            )
        },
        11: { title: "Yard Sign", content: <p>Capture local interest. Neighbors often know buyers who want to move into the area.</p> },
        12: {
            title: "Disclosures (SD)",
            content: (
                <div className="space-y-2">
                    <p><strong>What is it?</strong> The Seller's Disclosure (SD) is a legal document where you list known issues with the property.</p>
                    <p><strong>Liability:</strong> Honesty is your best protection. Disclosing issues upfront prevents lawsuits later. If you don't know, say "Unknown".</p>
                    <p className="font-bold text-red-500">Important: Non-disclosure is a major source of post-closing liability.</p>
                </div>
            )
        },
        13: {
            title: "Showings",
            content: (
                <div className="space-y-2">
                    <p>Manage your availability for tours.</p>
                    <ul className="list-disc pl-5 text-sm text-slate-600 mt-2">
                        <li>Declutter and Depersonalize</li>
                        <li>Open all blinds/curtains</li>
                        <li>Remove pets during showings</li>
                    </ul>
                </div>
            )
        },
        14: { title: "Final Review", content: <p>Your listing is live! Monitor views and offers from your dashboard.</p> },
    };

    const currentHelp = stepHelpContent[currentStep] || { title: "Help", content: <p>Select a step to see details.</p> };

    // Styles logic
    const getColor = (step: number) => {
        if (step < 7) return "#3b82f6"; // Blue
        if (step === 12) return "#ef4444"; // Red (Warning/Important)
        if (step > 7) return "#10b981"; // Green
        return "#64748b";
    };
    const color = getColor(currentStep);

    // Render Content Based on Active Tab
    const renderContent = () => {
        switch (activeTab) {
            case 'menu':
                return (
                    <div className="grid gap-3 pt-2">
                        <a href="https://housingpa.com" target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors group">
                            <span className="text-2xl">🏠</span>
                            <div>
                                <div className="font-bold text-slate-800 group-hover:text-blue-600">Home</div>
                                <div className="text-xs text-slate-500">Visit housingPA.com</div>
                            </div>
                        </a>

                        <button onClick={() => setActiveTab('contact')}
                            className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors group text-left w-full">
                            <span className="text-2xl">📞</span>
                            <div>
                                <div className="font-bold text-slate-800 group-hover:text-blue-600">Contact Us</div>
                                <div className="text-xs text-slate-500">Call, Text, or Email</div>
                            </div>
                        </button>

                        <button onClick={() => setActiveTab('about')}
                            className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors group text-left w-full">
                            <span className="text-2xl">🏆</span>
                            <div>
                                <div className="font-bold text-slate-800 group-hover:text-blue-600">Our Expertise</div>
                                <div className="text-xs text-slate-500">Built on Experience</div>
                            </div>
                        </button>

                        <button onClick={() => setActiveTab('security')}
                            className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors group text-left w-full">
                            <span className="text-2xl">🔐</span>
                            <div>
                                <div className="font-bold text-slate-800 group-hover:text-blue-600">Data Security</div>
                                <div className="text-xs text-slate-500">Your Data Fortress</div>
                            </div>
                        </button>

                        <button onClick={() => setActiveTab('guide')}
                            className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors group text-left w-full">
                            <span className="text-2xl">💡</span>
                            <div>
                                <div className="font-bold text-blue-800">Current Step Guide</div>
                                <div className="text-xs text-blue-600">Help for "{currentHelp.title}"</div>
                            </div>
                        </button>
                    </div>
                );
            case 'guide':
                return (
                    <div>
                        <button onClick={() => setActiveTab('menu')} className="text-xs text-blue-600 hover:underline mb-4">← Back to Menu</button>
                        <h3 className="text-lg font-bold mb-2">{currentHelp.title}</h3>
                        <div className="text-slate-600 leading-relaxed text-sm">
                            {currentHelp.content}
                        </div>
                    </div>
                );
            case 'contact':
                return (
                    <div>
                        <button onClick={() => setActiveTab('menu')} className="text-xs text-blue-600 hover:underline mb-4">← Back to Menu</button>
                        <div dangerouslySetInnerHTML={{
                            __html: `
                            <div style="font-family: inherit; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e1e1e1; margin: 0 auto;">
                                <div style="background: #2c3e50; color: white; padding: 30px 20px; text-align: center;">
                                    <h2 style="margin: 0; font-weight: 700; font-size: 1.5em;">Get in Touch</h2>
                                    <p style="margin-top: 10px; opacity: 0.9; font-size: 0.9em;">We reply within 1 hour during business days.</p>
                                </div>
                                <div style="display: grid; gap: 15px; padding: 20px;">
                                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #eee;">
                                        <div style="font-size: 1.5em; margin-bottom: 5px;">📱</div>
                                        <h3 style="margin: 0 0 5px; font-size: 1em; color: #2c3e50;">Call or Text</h3>
                                        <a href="tel:4844828660" style="display: block; background: #27ae60; color: white; padding: 8px; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 0.9em;">(484) 482-8660</a>
                                    </div>
                                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #eee;">
                                        <div style="font-size: 1.5em; margin-bottom: 5px; color: #25D366;">💬</div>
                                        <h3 style="margin: 0 0 5px; font-size: 1em; color: #2c3e50;">WhatsApp</h3>
                                        <a href="https://wa.me/19179120585" style="display: block; background: #25D366; color: white; padding: 8px; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 0.9em;">Start Chat</a>
                                    </div>
                                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #eee;">
                                        <div style="font-size: 1.5em; margin-bottom: 5px;">✉️</div>
                                        <h3 style="margin: 0 0 5px; font-size: 1em; color: #2c3e50;">Email</h3>
                                        <a href="mailto:ben@housingPA.com" style="display: block; background: #34495e; color: white; padding: 8px; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 0.9em;">ben@housingPA.com</a>
                                    </div>
                                </div>
                                <div style="background: #f4f6f7; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                                    <h3 style="margin: 0 0 5px; color: #2c3e50; font-size: 1em;">Visit Our Office</h3>
                                    <p style="margin: 0; color: #555; font-size: 0.85em;">
                                        <strong>American Vista Real Estate</strong><br>11907 Bustleton Ave.<br>Philadelphia, PA 19116
                                    </p>
                                </div>
                            </div>
                        ` }} />
                    </div>
                );
            case 'about':
                return (
                    <div>
                        <button onClick={() => setActiveTab('menu')} className="text-xs text-blue-600 hover:underline mb-4">← Back to Menu</button>
                        <div dangerouslySetInnerHTML={{
                            __html: `
                            <div style="font-family: inherit; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e1e1e1; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px 20px; text-align: center;">
                                    <h2 style="margin: 0; font-weight: 700; font-size: 1.4em;">Built on Experience.</h2>
                                    <p style="margin-top: 10px; opacity: 0.9; font-size: 0.9em;">HousingPA AI is the innovation arm of <strong>American Vista Real Estate</strong>.</p>
                                </div>
                                <div style="padding: 20px;">
                                    <h3 style="color: #2c3e50; margin-top: 0; font-size: 1.1em;">Not Just a Tech Company</h3>
                                    <p style="color: #666; font-size: 0.9em; line-height: 1.6; margin-bottom: 15px;">
                                        We apply the financial rigor of <strong>Commercial Real Estate</strong> to the residential market. The result? A system that sells your home with Wall Street efficiency and family business care.
                                    </p>
                                    <div style="background: #f8f9fa; border-left: 4px solid #27ae60; padding: 15px; border-radius: 4px;">
                                        <h4 style="margin: 0 0 10px; color: #2c3e50; font-size: 0.95em;">The American Vista Advantage</h4>
                                        <ul style="padding-left: 20px; color: #555; font-size: 0.85em; margin: 0;">
                                            <li>In-House Maintenance Crews</li>
                                            <li>Asset Management Focus</li>
                                            <li>Compliance Experts (Leases, Zoning)</li>
                                        </ul>
                                    </div>
                                </div>
                                <div style="background: #f4f6f7; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                                    <h3 style="color: #2c3e50; margin-top: 0; font-size: 1em;">Real Estate Expertise.</h3>
                                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 15px;">
                                        <div style="background: white; padding: 10px; border-radius: 8px; flex: 1; min-width: 100px;">
                                            <div style="font-size: 1.5em;">🛠️</div>
                                            <strong style="color: #2c3e50; display: block; font-size: 0.8em;">In-House Crew</strong>
                                        </div>
                                        <div style="background: white; padding: 10px; border-radius: 8px; flex: 1; min-width: 100px;">
                                            <div style="font-size: 1.5em;">⚖️</div>
                                            <strong style="color: #2c3e50; display: block; font-size: 0.8em;">Legal Shield</strong>
                                        </div>
                                        <div style="background: white; padding: 10px; border-radius: 8px; flex: 1; min-width: 100px;">
                                            <div style="font-size: 1.5em;">🏢</div>
                                            <strong style="color: #2c3e50; display: block; font-size: 0.8em;">Local Roots</strong>
                                        </div>
                                    </div>
                                </div>
                                <div style="background: #2c3e50; color: white; padding: 15px; text-align: center; font-size: 0.8em;">
                                    <p style="margin: 0;">HousingPA AI is a service of <strong>American Vista Real Estate</strong><br>License #AB069631 · Philadelphia, PA</p>
                                </div>
                            </div>
                        ` }} />
                    </div>
                );
            case 'security':
                return (
                    <div>
                        <button onClick={() => setActiveTab('menu')} className="text-xs text-blue-600 hover:underline mb-4">← Back to Menu</button>
                        <div dangerouslySetInnerHTML={{
                            __html: `
                            <div style="font-family: inherit; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e1e1e1; margin: 0 auto;">
                                <div style="background: #2c3e50; color: white; padding: 30px 20px; text-align: center;">
                                    <h2 style="margin: 0; font-weight: 700; font-size: 1.5em;">Your Data Fortress</h2>
                                    <p style="margin-top: 10px; opacity: 0.9; font-size: 0.9em;">We treat your info with the same security standards as online banks.</p>
                                </div>
                                <div style="padding: 20px;">
                                    <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                                        <div style="font-size: 1.8em; color: #27ae60;">🔐</div>
                                        <div>
                                            <h3 style="margin: 0 0 5px; color: #2c3e50; font-size: 1em;">End-to-End Encryption</h3>
                                            <p style="margin: 0; color: #666; font-size: 0.85em; line-height: 1.5;">AES-256 bit encryption (Top Secret standard) for data at rest and in transit.</p>
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 15px;">
                                        <div style="font-size: 1.8em; color: #2980b9;">☁️</div>
                                        <div>
                                            <h3 style="margin: 0 0 5px; color: #2c3e50; font-size: 1em;">AWS GovCloud Standards</h3>
                                            <p style="margin: 0; color: #666; font-size: 0.85em; line-height: 1.5;">Hosted on Amazon Web Services (AWS) with redundant, secure architecture.</p>
                                        </div>
                                    </div>
                                </div>
                                <div style="background: #f8f9fa; padding: 20px; border-top: 1px solid #eee; border-bottom: 1px solid #eee;">
                                    <h3 style="text-align: center; color: #2c3e50; margin: 0 0 15px; font-size: 1em;">Data Segregation</h3>
                                    <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd; margin-bottom: 10px;">
                                        <h4 style="color: #2c3e50; margin: 0 0 5px; font-size: 0.9em;">🌍 Public Marketing Data</h4>
                                        <p style="font-size: 0.85em; color: #666; margin: 0;">Photos, Address, SqFt (Sent to Zillow/MLS)</p>
                                    </div>
                                    <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
                                        <h4 style="color: #c0392b; margin: 0 0 5px; font-size: 0.9em;">🔒 Protected Financial Data</h4>
                                        <p style="font-size: 0.85em; color: #666; margin: 0;">Mortgage Balance, SSN, Net Sheet (NEVER Public)</p>
                                    </div>
                                </div>
                                <div style="padding: 20px; text-align: center;">
                                    <h3 style="color: #2c3e50; margin: 0 0 5px; font-size: 1em;">🚫 We Do Not Sell Your Data</h3>
                                    <p style="color: #666; font-size: 0.85em; margin: 0;">We don't run a "lead farm". We earn from the 1% listing fee, not by selling your number.</p>
                                </div>
                            </div>
                        ` }} />
                    </div>
                );
        }
    };

    return (
        <>
            <div
                className="help-assistant-trigger"
                onClick={handleOpen}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    zIndex: 900,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer'
                }}
            >
                <div className="bg-white px-3 py-1 rounded-full text-xs font-bold shadow-md mb-2 border transition-all hover:scale-105" style={{ color: color, borderColor: color }}>
                    Support
                </div>
                <div className="w-14 h-14 rounded-full border-4 shadow-lg overflow-hidden bg-slate-100 transition-all hover:scale-110 hover:shadow-xl" style={{ borderColor: color }}>
                    <img
                        src="/Ben-Hen-Head.jpg"
                        alt="Help"
                        className="w-full h-full object-cover"
                    />
                </div>
            </div>

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="HousingPA Support">
                {renderContent()}
            </Modal>
        </>
    );
}

// Dummy export to keep file valid if other exports existed, though default is usually enough.

