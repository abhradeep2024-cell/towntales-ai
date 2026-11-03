-- Real Factory intake stores the original source file and extracted text in the
-- existing private production bucket. Keep the bucket private and bounded.
update storage.buckets
set allowed_mime_types = array[
  'video/mp4',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]
where id = 'towntales-assets';

-- Do not silently create or make public a bucket if the expected private bucket
-- is absent. Deployment must provision it explicitly before applying intake.
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
