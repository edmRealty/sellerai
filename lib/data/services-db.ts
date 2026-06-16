export type AddonLogic = 'universal_primary' | 'universal_secondary' | 'ai_trigger' | 'hidden_default';

export interface TriggerRule {
    min_sqft?: number;
    max_sqft?: number;
    is_vacant?: boolean;
    clutter_detected?: boolean;
    track?: 'residential' | 'commercial';
    min_lot_acres?: number;
}

export interface ServiceItem {
    id: string;
    name: string;
    price_display: string; // e.g., "$250", "$45/photo", "Custom"
    price_value?: number; // Numeric value for calculation
    description?: string;
    display_logic: AddonLogic;
    trigger_rule?: TriggerRule;
    allowQuantity?: boolean; // New: Allow user to multiply this item (e.g. hours)
}

export const SERVICES_CATALOG: ServiceItem[] = [
    // 1. Professional Photography ($450) - Highly Recommended / AI Trigger?
    // User order: Pro Photo, Zoom, Boost, Closing, Special Photo, Open House.
    {
        id: 'pro_photo',
        name: 'Professional HDR Photography',
        price_display: '$450',
        price_value: 450,
        display_logic: 'universal_primary', // Visible by default
        description: '35+ High-dynamic range photos to make your listing shine.',
    },

    // 2. 1Hr Agent on Zoom ($99) - Quantity Enabled
    {
        id: 'zoom_agent',
        name: 'Agent Consultation (Hourly)',
        price_display: '$99/hr',
        price_value: 99,
        display_logic: 'universal_primary',
        allowQuantity: true,
        description: 'Video call for strategy, negotiation advice, or Q&A.',
    },

    // 3. Boost Marketing ($79/mo)
    {
        id: 'boost_marketing',
        name: 'Social Boost Campaign',
        price_display: '$79/mo',
        price_value: 79,
        display_logic: 'universal_primary',
        description: 'Paid ads on Facebook & Instagram targeting local buyers.',
    },

    // 4. Agent at Closing ($249)
    {
        id: 'agent_closing',
        name: 'Agent at Closing',
        price_display: '$249',
        price_value: 249,
        display_logic: 'universal_primary',
        description: 'Representation at the settlement table to review docs.',
    },

    // 5. Special Photography ($750)
    {
        id: 'special_photo',
        name: 'Platinum Visuals Package',
        price_display: '$750',
        price_value: 750,
        display_logic: 'universal_secondary', // Expansion
        description: 'Includes Drone, 3D Matterport, and Twilight Photography.',
    },

    // 6. Open House Options (Split for simplicity)
    {
        id: 'open_house_basic',
        name: 'Hosted Open House (Basic)',
        price_display: '$99',
        price_value: 99,
        display_logic: 'universal_secondary',
        description: '2-hour hosted event with digital sign-in.',
    },
    {
        id: 'open_house_party',
        name: 'Open House "Event" Party',
        price_display: '$350',
        price_value: 350,
        display_logic: 'universal_secondary',
        description: 'Includes snacks (brownies!), balloons, music, and printed materials.',
    }
];
