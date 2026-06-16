"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [adminEmail, setAdminEmail] = useState('');
    const [adminToken, setAdminToken] = useState('');
    const [adminBusy, setAdminBusy] = useState(false);

    // Form State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    useEffect(() => {
        // Hydrate
        const savedData = localStorage.getItem('propertyData');
        if (savedData) {
            const parsed = JSON.parse(savedData);
            setData(parsed);

            // Populate form
            setFirstName(parsed.seller?.name?.split(' ')[0] || '');
            setLastName(parsed.seller?.name?.split(' ').slice(1).join(' ') || '');
            setEmail(parsed.seller?.email || '');
            setPhone(parsed.seller?.phone || '');
        }
    }, []);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        // Mock API delay
        setTimeout(() => {
            // Update local storage
            const updatedData = {
                ...data,
                seller: {
                    ...data.seller,
                    name: `${firstName} ${lastName}`,
                    email: email,
                    phone: phone
                }
            };
            localStorage.setItem('propertyData', JSON.stringify(updatedData));
            setData(updatedData);
            setIsSaving(false);
            alert("Profile updated successfully!");
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-slate-50 pt-24 pb-12 px-4">
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="mb-6 text-slate-500 hover:text-slate-800 flex items-center gap-2 transition-colors"
                >
                    ← Back to Dashboard
                </button>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left Column: Settings */}
                    <div className="md:col-span-2 space-y-6">

                        {/* Personal Info Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center gap-6">
                                <div className="relative group cursor-pointer">
                                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-slate-200">
                                        {/* Avatar Logic */}
                                        {data?.seller?.avatar ? (
                                            <img src={data.seller.avatar} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-2xl text-slate-400">👤</div>
                                        )}
                                    </div>
                                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white text-xs font-bold">Edit</span>
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    const base64 = reader.result as string;
                                                    // Update Local State immediate
                                                    setData((prev: any) => ({
                                                        ...prev,
                                                        seller: { ...prev.seller, avatar: base64 }
                                                    }));
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Personal Information</h2>
                                    <p className="text-sm text-slate-500">Update your photo and personal details.</p>
                                </div>
                            </div>
                            <form onSubmit={handleSave} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                                        <input
                                            value={firstName}
                                            onChange={e => setFirstName(e.target.value)}
                                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                                        <input
                                            value={lastName}
                                            onChange={e => setLastName(e.target.value)}
                                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    >
                                        {isSaving ? "Saving..." : "Save Changes"}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Security Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold text-slate-900">Security</h2>
                                <p className="text-sm text-slate-500">Manage your password and account security.</p>
                            </div>
                            <div className="p-6 space-y-4">
                                <button className="text-blue-600 font-medium hover:underline">Change Password</button>
                                <div className="border-t border-slate-100 pt-4 mt-2">
                                    <button className="text-red-500 font-medium hover:underline text-sm">Delete Account</button>
                                </div>
                            </div>
                        </div>

                        {/* Admin Tools */}
                        <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
                            <div className="p-6 border-b border-red-100">
                                <h2 className="text-xl font-bold text-red-700">Admin Tools</h2>
                                <p className="text-sm text-slate-500">Danger zone. Use for testing only.</p>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">User Email to Delete</label>
                                    <input
                                        type="email"
                                        value={adminEmail}
                                        onChange={(e) => setAdminEmail(e.target.value)}
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                        placeholder="user@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Admin Token</label>
                                    <input
                                        type="password"
                                        value={adminToken}
                                        onChange={(e) => setAdminToken(e.target.value)}
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                        placeholder="ADMIN_ACTION_TOKEN"
                                    />
                                </div>
                                <button
                                    disabled={adminBusy}
                                    onClick={async () => {
                                        if (!adminEmail || !adminEmail.includes('@')) {
                                            alert("Enter a valid email.");
                                            return;
                                        }
                                        if (!adminToken) {
                                            alert("Enter the admin token.");
                                            return;
                                        }
                                        if (!confirm(`Delete user ${adminEmail}? This cannot be undone.`)) return;
                                        setAdminBusy(true);
                                        try {
                                            const res = await fetch('/api/admin/delete-user', {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Authorization': `Bearer ${adminToken}`
                                                },
                                                body: JSON.stringify({ email: adminEmail })
                                            });
                                            const payload = await res.json();
                                            if (res.ok && payload?.success) {
                                                alert(`Deleted: ${payload.email}`);
                                                setAdminEmail('');
                                            } else {
                                                alert(payload?.error || "Delete failed.");
                                            }
                                        } catch (err: any) {
                                            alert(err?.message || "Delete failed.");
                                        } finally {
                                            setAdminBusy(false);
                                        }
                                    }}
                                    className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                    {adminBusy ? "Deleting..." : "Delete User"}
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Property Summary */}
                    <div className="space-y-6">
                        <div className="bg-slate-900 text-white rounded-xl shadow-lg p-6">
                            <h3 className="font-bold text-lg mb-4">Your Property</h3>
                            <div className="mb-4">
                                <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Address</div>
                                <div className="font-medium">{data?.address || "No address found"}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Est. Value</div>
                                    <div className="font-medium text-green-400">${data?.price?.toLocaleString() || "---"}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Type</div>
                                    <div className="font-medium capitalize">{data?.details?.propertyType || "---"}</div>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-700">
                                <button className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                                    View Live Listing (Draft)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
