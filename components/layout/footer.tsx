import Link from 'next/link';

export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="w-full bg-slate-950 text-slate-500 text-xs py-8 border-t border-slate-900 mt-auto">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                        <h4 className="text-slate-200 font-bold mb-4">Flat Fee Listing</h4>
                        <p className="mb-4 max-w-sm">
                            Real estate brokerage services provided by our licensed partner brokerage.
                            Not a solicitation if your property is already listed.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-slate-900 gap-4">
                    <div className="flex gap-6">
                        <Link href="https://housingpa.com/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
                        <Link href="https://housingpa.com/privacy-policy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
                        <Link href="/fair-housing" className="hover:text-slate-300 transition-colors">Fair Housing</Link>
                        <Link href="/dmca" className="hover:text-slate-300 transition-colors">DMCA</Link>
                    </div>
                    <div className="flex flex-col items-center md:items-end gap-1">
                        <div>© {currentYear} Flat Fee AI. All rights reserved.</div>
                        <div className="text-[10px] text-slate-600">Build v4.1</div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
