import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { buildListingDraft } from '../lib/listing-draft.ts';
import { computeReadiness } from '../lib/listing-status.ts';

const require = createRequire(import.meta.url);
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('OFFLINE_SYNTHETIC_ONLY'); };
test.after(() => { globalThis.fetch = originalFetch; });

function fixture(options = {}) {
  const events = [];
  const rows = options.rows ?? [];
  let writes = 0;
  const db = { from(table) {
    assert.equal(table, 'listings');
    const filters = [];
    let mode = 'read';
    let payload;
    let max = Infinity;
    const query = {
      select() { return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      neq(key, value) { filters.push(row => row[key] !== value); return query; },
      in(key, values) { filters.push(row => values.includes(row[key])); return query; },
      order() { return query; },
      limit(value) { max = value; return query; },
      insert(value) { mode = 'insert'; payload = value; return query; },
      update(value) { mode = 'update'; payload = value; return query; },
      single() { return query.maybeSingle(); },
      async maybeSingle() {
        if (options.readError && mode === 'read') return { data: null, error: { message: 'PRIVATE_DATABASE_DETAIL' } };
        if (mode === 'insert') {
          writes++;
          const row = { id: 'synthetic-new', status: 'draft', consumer_notice_status: 'not_sent', listing_agreement_status: 'not_sent', updated_at: 'r1', ...payload };
          rows.push(row);
          return { data: structuredClone(row), error: null };
        }
        if (mode === 'update') options.beforeUpdate?.(rows);
        const row = rows.filter(row => filters.every(filter => filter(row))).slice(0, max)[0];
        if (mode === 'update' && row) { Object.assign(row, structuredClone(payload)); writes++; }
        return { data: row ? structuredClone(row) : null, error: null };
      }
    };
    return query;
  } };
  const ctx = options.context ?? { configured: true, auth: { user: { id: 'synthetic-seller' }, role: 'seller', supabase: db } };
  const source = readFileSync(new URL('../app/api/listings/sync/route.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const imports = {
    'next/server': require('next/server'),
    '@/lib/auth': { getAuthContext: async () => ctx },
    '@/lib/listing-events': { recordListingEvent: async (_, event) => events.push(event) },
    '@/lib/api-safety': { guardRateLimit() {}, getClientId: () => 'synthetic', RateLimitError: class extends Error {}, rateLimitResponse() { throw new Error('Unexpected rate-limit path'); } },
    '@/lib/listing-draft': { buildListingDraft }
  };
  new vm.Script(`(function(require,exports){${code}\n})`).runInThisContext()(name => {
    if (!(name in imports)) throw new Error(`Unapproved test import ${name}`);
    return imports[name];
  }, exports);
  return { rows, events, writes: () => writes, async sync(body) {
    const response = await exports.POST(new Request('http://127.0.0.1/api/listings/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() };
  } };
}

const row = (extra = {}) => ({ id: 'synthetic-listing', seller_id: 'synthetic-seller', status: 'draft', step: 'confirm', updated_at: 'r1', working_price: 100, consumer_notice_status: 'signed', listing_agreement_status: 'not_sent', data: { address: 'Synthetic property', finalPrice: 100, paperwork: { consumerNoticeStatus: 'signed', consumerNoticeUrl: '/verified-document' } }, ...extra });

test('draft insert cannot promote browser signature, delivery URL or arbitrary authority fields', async () => {
  const f = fixture();
  const result = await f.sync({ data: { address: 'Synthetic new property', signed: true, status: 'published', paperwork: { consumerNoticeStatus: 'signed', listingAgreementStatus: 'signed', consumerNoticeUrl: '/forged', mailingAddress: 'Synthetic mailing address' } } });
  assert.equal(result.status, 200);
  assert.equal(f.writes(), 1);
  assert.equal(f.rows[0].status, 'draft');
  assert.equal(f.rows[0].data.signed, false);
  assert.equal(f.rows[0].data.status, undefined);
  assert.equal(f.rows[0].data.paperwork.consumerNoticeStatus, 'not_sent');
  assert.equal(f.rows[0].data.paperwork.listingAgreementStatus, 'not_sent');
  assert.equal(f.rows[0].data.paperwork.consumerNoticeUrl, undefined);
  assert.equal(f.rows[0].data.paperwork.mailingAddress, 'Synthetic mailing address');
});

test('existing draft save preserves server paperwork and updates normal fields', async () => {
  const f = fixture({ rows: [row()] });
  const result = await f.sync({ listingId: 'synthetic-listing', step: 'details', data: { description: 'Updated synthetic description', finalPrice: 250, paperwork: { consumerNoticeStatus: 'not_sent', listingAgreementStatus: 'signed', consumerNoticeUrl: '/forged', ownerRole: 'owner' } } });
  assert.equal(result.body.synced, true);
  assert.equal(f.rows[0].data.address, 'Synthetic property');
  assert.equal(f.rows[0].data.description, 'Updated synthetic description');
  assert.equal(f.rows[0].data.paperwork.consumerNoticeStatus, 'signed');
  assert.equal(f.rows[0].data.paperwork.listingAgreementStatus, 'not_sent');
  assert.equal(f.rows[0].data.paperwork.consumerNoticeUrl, '/verified-document');
  assert.equal(f.rows[0].working_price, 250);
  assert.equal(f.events.some(e => /status_changed/.test(e.type)), false);
});

test('explicit missing or foreign ID never falls back to another owned listing', async () => {
  for (const listingId of ['missing', 'foreign']) {
    const f = fixture({ rows: [row(), row({ id: 'foreign', seller_id: 'someone-else' })] });
    const result = await f.sync({ listingId, data: { address: 'Wrong target' } });
    assert.equal(result.status, 404);
    assert.equal(f.writes(), 0);
    assert.equal(f.rows[0].data.address, 'Synthetic property');
  }
});

test('lookup failure never creates a replacement or reveals backend detail', async () => {
  for (const listingId of ['synthetic-listing', undefined]) {
    const f = fixture({ rows: [row()], readError: true });
    const result = await f.sync({ listingId, data: { address: 'Synthetic property' } });
    assert.equal(result.status, 503);
    assert.equal(f.writes(), 0);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_DATABASE_DETAIL/);
  }
});

test('concurrent staff update wins; stale seller write gets conflict and no false audit', async () => {
  const f = fixture({ rows: [row()], beforeUpdate: rows => { rows[0].updated_at = 'r2'; rows[0].listing_agreement_status = 'signed'; rows[0].data.paperwork.listingAgreementStatus = 'signed'; } });
  const result = await f.sync({ listingId: 'synthetic-listing', data: { address: 'Stale edit' } });
  assert.equal(result.status, 409);
  assert.equal(result.body.synced, false);
  assert.equal(f.writes(), 0);
  assert.equal(f.events.length, 0);
  assert.equal(f.rows[0].listing_agreement_status, 'signed');
});

test('published and later workflow states cannot be changed by draft sync', async () => {
  for (const status of ['approved', 'published', 'off_market', 'under_contract', 'sold', 'archived']) {
    const f = fixture({ rows: [row({ status })] });
    assert.equal((await f.sync({ listingId: 'synthetic-listing', data: { address: 'Synthetic overwrite' } })).status, 409);
    assert.equal(f.writes(), 0);
  }
});

test('unconfigured and unauthenticated requests make no writes', async () => {
  for (const context of [{ configured: false, auth: null }, { configured: true, auth: null }]) {
    const f = fixture({ context });
    const result = await f.sync({ data: { address: 'Synthetic property' } });
    assert.equal(result.body.synced, false);
    assert.equal(f.writes(), 0);
  }
});

test('new client-session draft does not overwrite another session draft', async () => {
  const f = fixture({ rows: [row({ client_session_id: 'other-session' })] });
  const result = await f.sync({ clientSessionId: 'new-session', data: { address: 'Synthetic new draft' } });
  assert.equal(result.body.listingId, 'synthetic-new');
  assert.equal(f.rows[0].data.address, 'Synthetic property');
});

test('readiness does not accept signature assertions from untrusted JSON fallback', () => {
  const list = computeReadiness({ data: { paperwork: { consumerNoticeStatus: 'signed', listingAgreementStatus: 'signed' } } }, []);
  assert.equal(list.find(item => item.key === 'consumer_notice').ok, false);
  assert.equal(list.find(item => item.key === 'listing_agreement').ok, false);
});
