# Instagram Publishing Setup

This application now supports automatic Instagram post publishing using the Instagram Graph API. When you click "Publish" on an Instagram post, it will:

1. Upload images to Cloudinary
2. Automatically publish the post to Instagram
3. Store Instagram post IDs for future reference

## Prerequisites

1. **Facebook Developer Account**: You need a Facebook Developer account
2. **Instagram Business/Creator Account**: Your Instagram account must be connected to a Facebook page
3. **Facebook App**: Create a Facebook app with Instagram Basic Display permissions

## Setup Steps

### 1. Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or use an existing one
3. Add "Instagram Basic Display" product to your app
4. Configure Instagram Basic Display settings

### 2. Get Instagram User Token

1. In your Facebook app, go to Instagram Basic Display > Basic Display
2. Add your Instagram account as a test user
3. Generate a user token with the following permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
   - `pages_manage_posts`

### 3. Configure in App Settings

1. Open the app Settings
2. Enter your **Instagram User Token**
3. Save settings

**Note**: The app will automatically fetch your Instagram account details using the user token.

## How It Works

### Single Image Post
- Creates a media container with `image_url` and `caption`
- Publishes the container to Instagram

### Multiple Image Post (Carousel)
- **Step 3a**: Creates individual containers for each image with `is_carousel_item=true`
- **Step 3b**: Creates a carousel container with `media_type: 'CAROUSEL'` and `children` parameter containing the child container IDs
- Publishes the carousel to Instagram

### API Flow (Exact Implementation)
1. **Get Page(s) and a Page access token**: `GET /me/accounts?access_token={user_token}`
2. **Get IG User ID from the Page**: `GET /{page_id}?fields=instagram_business_account&access_token={user_token}`
3. **Create media container(s)**:
   - **Single Image**: `POST /{instagram_user_id}/media` with `image_url` and `caption`
   - **Carousel**: 
     - **Step 3a**: `POST /{instagram_user_id}/media` with `image_url` and `is_carousel_item=true` for each image
     - **Step 3b**: `POST /{instagram_user_id}/media` with `media_type=CAROUSEL`, `children={child_id_1},{child_id_2}`, and `caption`
4. **Publish the media**: `POST /{instagram_user_id}/media_publish`

## Publishing Logic

- **Post Status**: Posts are only marked as "published" when BOTH Cloudinary upload AND Instagram publishing succeed
- **Partial Success**: If Cloudinary succeeds but Instagram fails, the post remains in "new" status with Cloudinary images
- **Complete Success**: Only when Instagram publishing succeeds does the post get marked as "published"

## Error Handling

- If Instagram publishing fails, the post remains unpublished (Cloudinary success is recorded separately)
- Instagram errors are logged and displayed to the user
- Missing credentials will skip Instagram publishing with a warning

## Debugging & Logging

The application now includes comprehensive logging for Instagram publishing. When you click "Publish", check the browser console for detailed information about each step:

### Console Logs You'll See

1. **🚀 Post Upload: Starting Instagram publishing workflow...**
2. **🔍 Instagram API: Step 1 - Getting pages and access tokens...**
3. **✅ Instagram API: Step 1 completed successfully**
4. **🔍 Instagram API: Step 2 - Getting Instagram business account from page...**
5. **✅ Instagram API: Step 2 completed successfully**
6. **🔍 Instagram API: Step 3 - Creating media container...**
   - **Single Image**: Direct container creation
   - **Carousel**: 
     - **Step 3a**: Creating individual carousel item containers
     - **Step 3b**: Creating carousel container with children
7. **✅ Instagram API: Step 3 completed successfully - Container created**
8. **🔍 Instagram API: Step 4 - Publishing media...**
9. **✅ Instagram API: Step 4 completed successfully - Media published!**
10. **🎉 Instagram API: Complete publishing workflow successful!**

### What to Look For

- **✅ Green checkmarks**: Successful steps
- **❌ Red X marks**: Failed steps with detailed error information
- **📤 Request bodies**: What data is being sent to Instagram
- **📸 Response data**: What Instagram is sending back
- **🔑 Token information**: Partial tokens for security

## Troubleshooting

### Common Issues

1. **"No Facebook pages found"**
   - Ensure your Instagram account is connected to a Facebook page
   - Check that your user token has the correct permissions

2. **"Instagram API error: (#100) Invalid parameter"**
   - Ensure the image URLs from Cloudinary are accessible
   - Check that your Instagram account is properly connected to Facebook

3. **"Permission denied"**
   - Check that your user token includes `instagram_content_publish` permission
   - Verify your app is approved for Instagram publishing

### Debugging Steps

1. **Open Browser Console** (F12 → Console tab)
2. **Click Publish** on an Instagram post
3. **Look for the step-by-step logs** with emojis
4. **Identify which step fails** and what the error message is
5. **Check the request/response data** for clues about what went wrong

### Testing

1. Create a test Instagram post with a single image
2. Click "Publish" and monitor the console for API calls
3. Check your Instagram account for the published post
4. Verify the post shows "Instagram Published" badge in the app

## Security Notes

- User tokens are stored locally in the browser
- Never share your user token publicly
- Tokens may expire and need to be refreshed
- Consider implementing token refresh logic for production use
