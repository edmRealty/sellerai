"use client";

import { usePathname } from "next/navigation";
import { HelpAssistant } from "./help-assistant";

export function HelpAssistantWrapper() {
    const pathname = usePathname();

    // Hide on landing page ('/')
    if (pathname === '/') {
        return null;
    }

    return <HelpAssistant />;
}
