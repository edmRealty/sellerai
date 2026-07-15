insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies: application routes authorize ownership with
-- listing RLS before using the server-side storage client.
