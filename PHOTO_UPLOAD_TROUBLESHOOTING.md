# Photo Upload Troubleshooting Guide

## Current Status
Photo upload has been implemented but user reports it "does nothing". This guide helps diagnose the exact issue.

## How to Debug

### 1. Open Browser Console
- Open browser DevTools (F12 or right-click > Inspect)
- Go to Console tab
- Try uploading a photo
- Look for `[Photo Upload]` logs

### 2. Expected Log Sequence
```
[Photo Upload] Button clicked
[Photo Upload] File picker opened
[Photo Upload] File input changed
[Photo Upload] File selected: {name, size, type}
[Photo Upload] Starting upload for job pack: <id>
[Photo Upload] Upload successful, DB record: <object>
[Photo Upload] Signed URL generated: Success
[Photo Upload] Adding photo to state: <photo>
[Photo Upload] Project saved successfully
[Photo Upload] Upload process complete
```

### 3. Common Issues and Solutions

#### Issue A: No logs at all
**Symptom:** Console shows nothing when clicking button
**Cause:** Button not being clicked OR React not mounting component
**Check:**
- Is the Photos tab selected?
- Is the button visible and clickable?
- Check if `isUploadingPhoto` state is preventing clicks

#### Issue B: "Button clicked" but no "File picker opened"
**Symptom:** First log appears but file picker doesn't open
**Cause:** Browser blocking file picker
**Check:**
- Browser permissions
- PWA/iframe restrictions
- User gesture requirement

#### Issue C: "File picker opened" but no "File input changed"
**Symptom:** File picker opens but selecting file does nothing
**Cause:** File picker cancelled OR file type rejected
**Check:**
- User actually selected a file (didn't cancel)
- File type is image/* (jpg, png, etc.)

#### Issue D: "File selected" but fails before "Upload successful"
**Symptom:** File details logged but upload fails
**Possible Causes:**
1. **Authentication Error**
   - User not logged in
   - Session expired
   - Check: `await supabase.auth.getUser()` returns user

2. **File Validation Error**
   - File too large (>10MB)
   - Invalid MIME type
   - MIME type doesn't match extension
   - Check error message in console

3. **Supabase Storage Error**
   - Bucket doesn't exist
   - RLS policies blocking upload
   - Network error
   - Check Network tab for failed requests

#### Issue E: Upload succeeds but "Signed URL generated: Failed"
**Symptom:** DB record created but signedUrl is null
**Cause:** RLS policy blocking SELECT on storage.objects
**Check:**
- Verify storage RLS policies in Supabase dashboard
- Check if user_id in path matches auth.uid()

#### Issue F: Everything succeeds but photo not visible
**Symptom:** All logs show success but photo doesn't appear
**Cause:** State update issue or image rendering problem
**Check:**
- React DevTools to see if `project.photos` updated
- Network tab to see if signed URL loads
- Check if image URL is valid (not expired)

## Supabase Configuration Checklist

### 1. Storage Bucket Setup
```sql
-- Check if bucket exists
SELECT * FROM storage.buckets WHERE id = 'photos';
-- Should return: {id: 'photos', name: 'photos', public: false}
```

### 2. Storage RLS Policies
```sql
-- Check policies on storage.objects
SELECT * FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage';
```

Required policies for 'photos' bucket:
- ✅ Users can upload own photos (INSERT)
- ✅ Users can view own photos (SELECT)
- ✅ Users can delete own photos (DELETE)

Policy checks:
```sql
bucket_id = 'photos' AND
auth.uid()::text = (storage.foldername(name))[1]
```

### 3. Database RLS Policies
```sql
-- Check policies on site_photos table
SELECT * FROM pg_policies WHERE tablename = 'site_photos';
```

Required policies:
- ✅ Users can view photos for own job packs (SELECT)
- ✅ Users can insert photos for own job packs (INSERT)
- ✅ Users can update photos for own job packs (UPDATE)
- ✅ Users can delete photos for own job packs (DELETE)

### 4. Test Storage Upload Manually
Open browser console on the app and run:
```javascript
// Test if storage is accessible
const { data, error } = await supabase.storage
  .from('photos')
  .upload('test/test.txt', new Blob(['test']), {
    contentType: 'text/plain'
  });

console.log('Upload result:', { data, error });

// If successful, delete test file
await supabase.storage.from('photos').remove(['test/test.txt']);
```

### 5. Test Database Insert Manually
```javascript
// Get current user
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user);

// Get a job pack ID
const { data: jobPacks } = await supabase
  .from('job_packs')
  .select('id')
  .limit(1);
console.log('Job packs:', jobPacks);

// Try to insert a photo record
const { data, error } = await supabase
  .from('site_photos')
  .insert({
    job_pack_id: jobPacks[0].id,
    storage_path: 'test/test.jpg',
    caption: 'Test photo',
    tags: ['test'],
    is_drawing: false
  })
  .select()
  .single();

console.log('Insert result:', { data, error });

// If successful, delete test record
if (data) {
  await supabase.from('site_photos').delete().eq('id', data.id);
}
```

## Environment Variables Check

Verify these are set correctly:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Test in browser console:
```javascript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Anon Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
```

## Network Tab Analysis

When uploading, check Network tab for:
1. **POST to Supabase Storage**
   - URL: `https://[project].supabase.co/storage/v1/object/photos/[path]`
   - Status: Should be 200 OK
   - If 401: Authentication issue
   - If 403: RLS policy blocking
   - If 404: Bucket doesn't exist

2. **POST to site_photos table**
   - URL: `https://[project].supabase.co/rest/v1/site_photos`
   - Status: Should be 201 Created
   - If 401: Authentication issue
   - If 403: RLS policy blocking
   - If 409: Unique constraint violation

3. **POST for signed URL**
   - URL: `https://[project].supabase.co/storage/v1/object/sign/photos/[path]`
   - Status: Should be 200 OK
   - Response should contain `signedUrl`

## File Path Structure

Photos should be stored with this path:
```
{user_id}/{job_pack_id}/{timestamp}.{ext}
```

Example:
```
550e8400-e29b-41d4-a716-446655440000/7c9e6679-7425-40de-944b-e07fc1f90ae7/1737000000000.jpg
```

RLS policies check that first folder (`user_id`) matches `auth.uid()`.

## Next Steps if Still Failing

1. **Check all logs** - What's the last successful log before it fails?
2. **Check error object** - What's the exact error message and code?
3. **Test manually** - Run the manual tests above to isolate the issue
4. **Check Supabase dashboard** - Look at Storage tab, verify bucket exists
5. **Check RLS policies** - Verify all required policies are enabled
6. **Test with curl** - Try uploading directly to storage API with token

## Contact Points

If issue persists after all checks:
- Provide console logs (all `[Photo Upload]` lines)
- Provide error object details
- Provide Network tab screenshots
- Confirm which manual test fails
