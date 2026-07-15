-- Signed seller documents are private. The service role writes files and the
-- application issues short-lived signed URLs only after its listing RLS check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Intentionally no storage.objects policies. All document reads and writes
-- pass through server routes using the service role after an application RLS
-- authorization check.
