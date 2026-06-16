const sentWelcomeEmails = new Set<string>();

export const notificationService = {
    sendTaskCompletionEmail: async (email: string) => {
        console.log(`[📧 EMAIL SENT] To: ${email} | Subject: Listing Optimized! | Body: All tasks complete. Marketing begins in 24h.`);
        // In real app: call /api/send-email
    },

    sendOnMarketEmail: async (email: string, address: string) => {
        const zillowLink = `https://www.zillow.com/homes/${address.replace(/ /g, '-')}_rb/`;
        console.log(`[📧 EMAIL SENT] To: ${email} | Subject: You're Live! | Body: View on Zillow: ${zillowLink}`);
    },

    checkUncompletedTasks: async (email: string, pendingCount: number) => {
        if (pendingCount > 0) {
            console.log(`[📧 EMAIL SENT] To: ${email} | Subject: Action Required | Body: You have ${pendingCount} pending tasks.`);
        }
    },

    sendWelcomeEmail: async (email: string) => {
        if (sentWelcomeEmails.has(email)) {
            console.log(`[🚫 EMAIL SKIPPED] Welcome email already sent to ${email}`);
            return;
        }

        sentWelcomeEmails.add(email);
        console.log(`[📧 EMAIL SENT] To: ${email} | Subject: Welcome to housingPA | Body: Your account is ready. We've saved your listing progress.`);

        try {
            await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: email,
                    name: 'Guest', // Default name
                    address: 'Your Property', // Default context, or pass as arg in future
                    propertyData: {}
                })
            });
        } catch (error) {
            console.error("Failed to send welcome email API call:", error);
        }
    }
};
