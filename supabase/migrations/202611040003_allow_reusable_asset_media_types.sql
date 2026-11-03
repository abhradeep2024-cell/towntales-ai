-- Common production-library asset formats. The bucket remains private.
update storage.buckets
set allowed_mime_types = array[
  'video/mp4',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'font/woff',
  'font/woff2'
]
where id = 'towntales-assets';

do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'towntales-assets' and public = false
  ) then
    raise exception 'Expected private Supabase bucket towntales-assets was not found.';
  end if;
end;
$$;
