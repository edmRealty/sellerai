import React, { useState, useEffect } from 'react';
import { AddonCard } from './addon-card';
import { getSmartServices, getExpansionServices, PropertyData } from '../../../lib/logic/smart-slot-logic';
import { ServiceItem } from '../../../lib/data/services-db';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SmartAddonsGridProps {
    propertyData: PropertyData;
    selectedServices: string[];
    onToggleService: (id: string, price: number) => void;
}

export const SmartAddonsGrid: React.FC<SmartAddonsGridProps> = ({
    propertyData,
    selectedServices,
    onToggleService
}) => {
    const [smartSlots, setSmartSlots] = useState<ServiceItem[]>([]);
    const [expansionServices, setExpansionServices] = useState<ServiceItem[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        // Load services on mount or property change
        const smart = getSmartServices(propertyData);
        const expansion = getExpansionServices();

        setSmartSlots(smart);
        setExpansionServices(expansion);
    }, [propertyData]); // Re-run if propertyData changes (e.g. going back steps)

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Main 3-Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {smartSlots.map((service) => (
                    <AddonCard
                        key={service.id}
                        service={service}
                        isSelected={selectedServices.includes(service.id)}
                        onToggle={(id) => onToggleService(id, service.price_value || 0)}
                        isSmart={service.display_logic === 'ai_trigger'}
                    />
                ))}
            </div>

            {/* Expansion Section */}
            <div className="pt-4 border-t border-dashed border-neutral-200">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center justify-center gap-2 py-4 text-neutral-500 hover:text-neutral-900 transition-colors group"
                >
                    <span className="font-medium text-sm">
                        {isExpanded ? "Hide optional services" : "See all optional services (Video, Signs, Marketing)"}
                    </span>
                    {isExpanded ? (
                        <ChevronUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                    ) : (
                        <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                    )}
                </button>

                {isExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 animate-in slide-in-from-top-2 duration-300">
                        {expansionServices.map((service) => (
                            <AddonCard
                                key={service.id}
                                service={service}
                                isSelected={selectedServices.includes(service.id)}
                                onToggle={(id) => onToggleService(id, service.price_value || 0)}
                            />
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
};
