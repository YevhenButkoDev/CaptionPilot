# Cloudinary Integration Setup

This application now includes Cloudinary integration for uploading Instagram and Pinterest post images to the cloud. This allows you to store image URLs that can be used later for creating actual posts on social media platforms.

## Setup Instructions

### 1. Create a Cloudinary Account

1. Go to [Cloudinary](https://cloudinary.com/) and sign up for a free account
2. Verify your email address
3. Log in to your Cloudinary dashboard

### 2. Get Your Cloudinary Credentials

From your Cloudinary dashboard, you'll need:

- **Cloud Name**: Found in the top-left corner of your dashboard
- **API Key**: Found in the "Account Details" section
- **Upload Preset**: You'll need to create this

### 3. Create an Upload Preset

1. In your Cloudinary dashboard, go to **Settings** → **Upload**
2. Scroll down to **Upload presets**
3. Click **Add upload preset**
4. Set the following:
   - **Preset name**: Choose a name (e.g., `social-media-uploads`)
   - **Signing Mode**: Set to **Unsigned** (for client-side uploads)
   - **Folder**: Set to `social-media-posts` (optional)
5. Click **Save**

### 4. Configure the Application

1. Open the application and go to **Settings**
2. Fill in your Cloudinary credentials:
   - **Cloudinary Cloud Name**: Your cloud name from step 2
   - **Cloudinary Upload Preset**: The preset name you created in step 3
   - **Cloudinary API Key**: Your API key from step 2
3. Click **Save Settings**

## Usage

### Uploading Images to Cloudinary

Once configured, you can upload images to Cloudinary in several ways:

#### 1. Using the CloudinaryUploadExample Component

```tsx
import CloudinaryUploadExample from './components/CloudinaryUploadExample';

// In your component
<CloudinaryUploadExample 
  post={draftPost} 
  onUploadComplete={(result) => {
    if (result.success) {
      console.log('Images uploaded:', result.cloudinaryImages);
    }
  }}
/>
```

#### 2. Programmatically Upload Images

```tsx
import { uploadPostImages } from './lib/postUpload';

// Upload images for a post
const result = await uploadPostImages(post, imageFiles, {
  folder: 'instagram-posts',
  tags: ['social-media', 'automated'],
  transformation: 'f_auto,q_auto,w_1080'
});

if (result.success) {
  console.log('Upload successful:', result.cloudinaryImages);
} else {
  console.error('Upload failed:', result.error);
}
```

### Image Transformations

Cloudinary supports various image transformations. Since we use unsigned uploads for security, transformations are applied when generating URLs, not during upload:

#### Available Transformations
- `f_auto,q_auto` - Automatic format and quality optimization
- `w_1080` - Resize to 1080px width
- `h_1080` - Resize to 1080px height
- `c_fill,g_auto` - Fill crop with automatic gravity
- `f_jpg,q_80` - Convert to JPEG with 80% quality

#### Using Transformations
```tsx
import { getTransformedCloudinaryUrls } from './lib/postUpload';

// Get optimized URLs for Instagram (1080px width, auto format/quality)
const instagramUrls = getTransformedCloudinaryUrls(post, 'f_auto,q_auto,w_1080');

// Get optimized URLs for Pinterest (auto format/quality)
const pinterestUrls = getTransformedCloudinaryUrls(post, 'f_auto,q_auto');
```

### Folder Organization

Images are automatically organized into folders:
- Instagram posts: `instagram-posts/`
- Pinterest posts: `pinterest-posts/`
- You can override this with the `folder` option

## Database Schema

The application now stores Cloudinary image information in the database:

```typescript
interface CloudinaryImage {
  publicId: string;      // Cloudinary public ID
  secureUrl: string;     // HTTPS URL for the image
  width: number;         // Image width
  height: number;        // Image height
  format: string;        // Image format (jpg, png, etc.)
  bytes: number;         // File size in bytes
}
```

This information is stored in the `cloudinaryImages` field of both `DraftPost` and `PinterestPost` types.

## Security Considerations

- **Upload Preset**: Use unsigned uploads for client-side applications
- **API Key**: The API key is stored locally and used only for deletion operations
- **Folder Restrictions**: Consider setting folder restrictions in your Cloudinary settings
- **Transformations**: Use transformations to limit image sizes and formats

## Error Handling

The integration includes comprehensive error handling:

- Configuration validation
- Upload error reporting
- Network error handling
- File validation

## Future Enhancements

- Batch upload progress tracking
- Image optimization before upload
- Automatic retry on failed uploads
- Image metadata extraction
- Bulk operations for multiple posts

## Troubleshooting

### Common Issues

1. **"Cloudinary configuration not found"**
   - Check that you've configured your settings in the Settings page
   - Verify that Cloud Name and Upload Preset are set

2. **"Upload failed"**
   - Check your internet connection
   - Verify your Cloudinary credentials
   - Ensure your upload preset allows unsigned uploads

3. **Images not appearing**
   - Check the browser console for errors
   - Verify that the upload was successful
   - Check that the database was updated

### Getting Help

If you encounter issues:
1. Check the browser console for error messages
2. Verify your Cloudinary configuration
3. Test with a simple image file first
4. Check your Cloudinary dashboard for upload logs
