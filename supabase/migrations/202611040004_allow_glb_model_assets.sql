-- Allow binary glTF assets for reusable 3D scene props and environments.
update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'model/gltf-binary')
where id = 'towntales-assets'
  and not ('model/gltf-binary' = any(allowed_mime_types));

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
