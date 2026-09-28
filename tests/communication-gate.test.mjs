import test from 'node:test';
import assert from 'node:assert/strict';
import { unavailableCommunication } from '../lib/communication-gate.ts';
import { readFile } from 'node:fs/promises';
import { notificationService } from '../lib/services/notifications.ts';

test('legacy notification helpers report unavailable rather than simulated sent', async () => {
    for (const send of Object.values(notificationService)) {
        assert.deepEqual(await send('synthetic@example.invalid', 'synthetic'), {
            success: false, status: 'unavailable', error: 'email_delivery_unavailable',
        });
    }
});

for (const kind of ['email', 'esign']) {
    test(kind + ': missing configuration fails closed', async () => {
        const response = await unavailableCommunication(async () => ({ configured: false, auth: null }), kind);
        assert.equal(response.status, 503);
        assert.equal((await response.json()).success, false);
    });
    test(kind + ': unauthenticated requests fail closed', async () => {
        const response = await unavailableCommunication(async () => ({ configured: true, auth: null }), kind);
        assert.equal(response.status, 401);
        assert.equal(response.headers.get('cache-control'), 'no-store');
    });
    test(kind + ': authenticated requests cannot activate a provider or claim success', async () => {
        const response = await unavailableCommunication(async () => ({ configured: true, auth: { role: 'admin' } }), kind);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), {
            success: false, status: 'unavailable',
            error: kind === 'email' ? 'email_delivery_unavailable' : 'esign_unavailable',
        });
    });
    test(kind + ': authentication errors reveal no provider details', async () => {
        const response = await unavailableCommunication(async () => { throw new Error('private-token-example'); }, kind);
        assert.equal(response.status, 503);
        assert.doesNotMatch(await response.text(), /private-token|activationCode|activationUrl|envelopeId/);
    });
}

test('both exact routes call the gate with server-side authentication and no provider import', async () => {
    for (const route of ['../app/api/send-email/route.ts', '../app/api/esign/create/route.ts']) {
        const source = await readFile(new URL(route, import.meta.url), 'utf8');
        assert.match(source, /getAuthContext/);
        assert.match(source, /unavailableCommunication\(getAuthContext/);
        assert.doesNotMatch(source, /nodemailer|DocuSignService|fetch\(|req\.json|Math\.random/);
    }
});
