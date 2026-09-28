type AuthResolver = () => Promise<{ configured: boolean; auth: unknown | null }>;

export async function unavailableCommunication(resolveAuth: AuthResolver, kind: 'email' | 'esign'): Promise<Response> {
    const reply = (error: string, status: number) => Response.json(
        { success: false, status: 'unavailable', error },
        { status, headers: { 'Cache-Control': 'no-store' } },
    );
    try {
        const context = await resolveAuth();
        if (!context.configured) return reply('authentication_unavailable', 503);
        if (!context.auth) return reply('unauthenticated', 401);
        // Reopening requires verified recipients, server-side approval and a staged adapter.
        return reply(kind === 'email' ? 'email_delivery_unavailable' : 'esign_unavailable', 503);
    } catch {
        return reply('authentication_unavailable', 503);
    }
}
