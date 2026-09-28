# SellerAI local communication containment

Source: edmRealty/sellerai at 31ec11016a8504b85406dc28e637da5b77e48b77.
No remote repository, deployed website, provider, data, or schema was changed.

The previous e-sign endpoint returned fabricated sent/envelope success. The
previous email endpoint accepted arbitrary recipients without authentication,
returned activation values, and disclosed raw provider failures.

Both routes now use the existing server-side getAuthContext resolver and a
shared fail-closed gate. Missing configuration/authentication fails safely;
even authenticated callers receive an explicit unavailable response. Neither
route parses caller content or imports/activates a delivery provider.

This deliberately disables legacy email activation and e-sign workflows.
It is containment, not a working email/e-sign integration or public launch.
Future implementation needs server-bound recipient/flow authorization,
approval/version binding, durable idempotency, safe provider receipts, and
verified document lifecycle before either route can be reopened.

Tests require Node >=22.6 and use synthetic injected auth contexts only.
Existing getAuthContext uses Supabase auth.getUser, not unverified getSession:
https://supabase.com/docs/reference/javascript/auth-getuser
No live Supabase query or account access was used for this local patch.

Remaining major gates: framework dependency security, server-authoritative
compliance/release state, browser-local fallback policy, durable versioned
document storage, full seller/agent workflow acceptance and deployment approval.
Rollback is the two original route files at the recorded source revision.
