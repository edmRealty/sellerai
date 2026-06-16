"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Script from 'next/script';

interface GoogleAddressSearchProps {
    onAddressSelect: (address: string) => void;
}

declare global {
    interface Window {
        google?: any;
        initGoogleAutocomplete?: () => void;
    }
}

export function GoogleAddressSearch({ onAddressSelect }: GoogleAddressSearchProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const autocompleteRef = useRef<any>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.initGoogleAutocomplete = () => {
            if (!inputRef.current || !window.google?.maps?.places?.Autocomplete) return;
            if (autocompleteRef.current && window.google?.maps?.event?.clearInstanceListeners) {
                window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
            }
            const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
                types: ['address'],
                componentRestrictions: { country: 'us' },
                fields: ['formatted_address', 'geometry', 'name']
            });

            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place?.formatted_address) {
                    setInputValue(place.formatted_address);
                    setIsLoading(true);
                    setTimeout(() => {
                        onAddressSelect(place.formatted_address);
                        setIsLoading(false);
                    }, 800);
                }
            });
            autocompleteRef.current = autocomplete;
        };
    }, [onAddressSelect]);

    return (
        <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-gray-200 dark:border-zinc-800 p-2 flex items-center gap-2">
            <Script
                src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async&callback=initGoogleAutocomplete`}
                strategy="lazyOnload"
            />
            {/* <button className="p-3 text-muted-foreground hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors" title="Attach documents">
                <Paperclip className="h-5 w-5" />
            </button> REMOVED PER PHASE 3 */}

            <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent border-none outline-none text-lg px-2 text-foreground placeholder:text-muted-foreground/50"
                placeholder="Enter full property address..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
            />

            <button
                className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-all flex items-center gap-2 min-w-[120px] justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => onAddressSelect(inputValue)}
                disabled={isLoading || inputValue.length < 5}
            >
                {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    <span>Get my estimate</span>
                )}
            </button>
        </div>
    );
}
