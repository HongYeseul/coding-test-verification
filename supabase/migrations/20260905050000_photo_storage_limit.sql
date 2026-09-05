-- 기존 사진의 조회·검수·취소는 유지하고 새 업로드만 제한합니다.
-- src/lib/proof-input.ts의 MAX_PHOTO_BYTES와 함께 변경합니다.
update storage.buckets
set file_size_limit = 307200,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'proof-evidence';
