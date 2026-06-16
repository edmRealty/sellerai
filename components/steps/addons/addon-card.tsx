import React from 'react';
import { ServiceItem } from '../../../lib/data/services-db';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface AddonCardProps {
    service: ServiceItem;
    isSelected?: boolean;
    quantity?: number;
    onToggle?: (id: string, quantity: number) => void;
    isSmart?: boolean;
}

export const AddonCard: React.FC<AddonCardProps> = ({ service, isSelected, quantity, onToggle, isSmart }) => {
    return (
        <div
            onClick={() => {
                if (!service.allowQuantity) {
                    onToggle && onToggle(service.id, isSelected ? 0 : 1);
                } else if (!isSelected) {
                    onToggle && onToggle(service.id, 1);
                }
            }}
            className={cn(
                "relative flex flex-col justify-between p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 ease-out transform hover:-translate-y-1",
                isSelected
                    ? "border-transparent bg-white shadow-xl ring-2 ring-indigo-500 ring-offset-2"
                    : "border-slate-100 bg-white hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10",
                isSmart && !isSelected && "border-blue-200 bg-gradient-to-br from-blue-50 to-white",
                isSmart && isSelected && "ring-blue-500"
            )}
        >
            {/* Selection Badge */}
            <div className={cn(
                "absolute top-4 right-4 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 scale-100",
                isSelected
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 border-transparent shadow-lg scale-110"
                    : "bg-white border-slate-200",
                isSmart && isSelected && "from-blue-500 to-cyan-500"
            )}>
                {isSelected && <Check className="w-4 h-4 text-white font-bold" />}
            </div>

            {/* Smart Badge */}
            {isSmart && (
                <div className="absolute -top-3 left-6 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-full shadow-lg shadow-blue-500/30 tracking-wide uppercase">
                    ✨ Recommended
                </div>
            )}

            <div className="space-y-3">
                <h3 className={cn("font-bold text-lg pr-8 transition-colors", isSelected ? "text-indigo-900" : "text-slate-800")}>{service.name}</h3>
                <p className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700">
                    {service.price_display}
                </p>
                {service.description && (
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">{service.description}</p>
                )}
            </div>

            {/* Visual Spacer / Footer */}
            <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                {service.allowQuantity && isSelected ? (
                    <div className="flex items-center gap-3 bg-slate-100 rounded-full px-1 py-1" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow text-slate-600 hover:text-indigo-600 font-bold"
                            onClick={() => onToggle && onToggle(service.id, (quantity || 1) - 1)}
                        >-</button>
                        <span className="font-bold text-slate-900 w-4 text-center">{quantity || 1}</span>
                        <button
                            className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow text-slate-600 hover:text-indigo-600 font-bold"
                            onClick={() => onToggle && onToggle(service.id, (quantity || 1) + 1)}
                        >+</button>
                    </div>
                ) : (
                    <span className={cn("text-xs font-bold uppercase tracking-wider", isSelected ? "text-indigo-600" : "text-slate-400")}>
                        {isSelected ? "Added to Bundle" : "Click to Add"}
                    </span>
                )}
            </div>
        </div>
    );
};
