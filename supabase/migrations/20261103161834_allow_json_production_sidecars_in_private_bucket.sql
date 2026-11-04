-- The private production bucket stores the MP4 plus JSON manifests,
-- word alignments and technical/creative QA sidecars.
update storage.buckets
set allowed_mime_types = array['video/mp4', 'application/json']
where id = 'towntales-assets';
