import { getAuthContext } from '@/lib/auth';
import { unavailableCommunication } from '@/lib/communication-gate';

export const runtime = 'nodejs';

export async function POST() {
    return unavailableCommunication(getAuthContext, 'esign');
}
