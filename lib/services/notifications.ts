const unavailable = () => ({ success: false as const, status: 'unavailable' as const, error: 'email_delivery_unavailable' });

export const notificationService = {
    sendTaskCompletionEmail: async (_email: string) => unavailable(),
    sendOnMarketEmail: async (_email: string, _address: string) => unavailable(),
    checkUncompletedTasks: async (_email: string, _pendingCount: number) => unavailable(),
    sendWelcomeEmail: async (_email: string) => unavailable(),
};
