import { SERVICES_CATALOG as COMMISSIONS_DB, ServiceItem } from '../data/services-db';

// Define a minimal interface for Property Data based on our needs
export interface PropertyData {
    sqft?: number;
    isVacant?: boolean;
    isCluttered?: boolean; // This might be a simulated field
    propertyType?: string; // e.g. 'Single Family', 'Commercial', 'Land'
    lotAcres?: number;
    track?: 'residential' | 'commercial'; // Explicit track field if available
}

export function getSmartServices(propertyData: PropertyData): ServiceItem[] {
    // 1. Get ALL Universal Primary Slots (e.g. Photo, Zoom, Boost, Closing)
    const primarySlots = COMMISSIONS_DB.filter((s: ServiceItem) => s.display_logic === 'universal_primary');

    const smartSlots: ServiceItem[] = [...primarySlots];

    // 2. Determine Smart Slot (AI Triggers)
    let aiSlot: ServiceItem | undefined;
    const candidates = COMMISSIONS_DB.filter((s: ServiceItem) => s.display_logic === 'ai_trigger');

    // Logic Priority:
    if (propertyData.track === 'commercial' || propertyData.propertyType === 'Commercial') {
        aiSlot = candidates.find((s: ServiceItem) => s.trigger_rule?.track === 'commercial');
    }
    if (!aiSlot && propertyData.isCluttered) {
        aiSlot = candidates.find((s: ServiceItem) => s.trigger_rule?.clutter_detected === true);
    }
    if (!aiSlot && propertyData.isVacant) {
        const sqft = propertyData.sqft || 0;
        if (sqft > 3000) {
            aiSlot = candidates.find((s: ServiceItem) => s.trigger_rule?.min_sqft === 3001);
        } else if (sqft <= 2000) {
            aiSlot = candidates.find((s: ServiceItem) => s.trigger_rule?.max_sqft === 2000);
        }
    }
    if (!aiSlot && propertyData.lotAcres && propertyData.lotAcres >= 1.0) {
        aiSlot = candidates.find((s: ServiceItem) => s.trigger_rule?.min_lot_acres === 1.0);
    }

    // Add AI Slot if matched
    if (aiSlot) {
        smartSlots.push(aiSlot);
    }

    return smartSlots;
}

export function getExpansionServices(): ServiceItem[] {
    // Return ALL Secondary items (Special Photo, Open Houses) + any Hidden Defaults
    return COMMISSIONS_DB.filter((s: ServiceItem) =>
        s.display_logic === 'universal_secondary' || s.display_logic === 'hidden_default'
    );
}
