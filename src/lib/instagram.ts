export interface InstagramConfig {
  userToken: string;
}

export interface InstagramMediaContainer {
  id: string;
  status_code?: string;
}

export interface InstagramPublishResult {
  id: string;
  status_code?: string;
}

export interface InstagramError {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

/**
 * Step 1: Get Page(s) and a Page access token
 */
export async function getPageInfo(userToken: string): Promise<{ pageAccessToken: string; pageId: string; instagramUserId: string }> {
  try {
    console.log('🔍 Instagram API: Step 1 - Getting pages and access tokens...');
    
    // Get page access token
    const response = await fetch(
      `https://graph.facebook.com/v23.0/me/accounts?access_token=${userToken}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Instagram API: Failed to get pages. HTTP status:', response.status, 'Response:', errorText);
      throw new Error(`Failed to get pages. HTTP status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📄 Instagram API: Pages response:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('❌ Instagram API: API error getting pages:', data.error);
      throw new Error(`Instagram API error: ${data.error.message} (Code: ${data.error.code})`);
    }
    
    if (!data.data || data.data.length === 0) {
      console.error('❌ Instagram API: No Facebook pages found in response');
      throw new Error('No Facebook pages found. Make sure your Instagram account is connected to a Facebook page.');
    }
    
    const pageAccessToken = data.data[0].access_token;
    const pageId = data.data[0].id;
    const pageName = data.data[0].name;
    
    console.log('✅ Instagram API: Step 1 completed successfully');
    console.log('   📍 Page ID:', pageId);
    console.log('   📍 Page Name:', pageName);
    console.log('   🔑 Page Access Token:', pageAccessToken.substring(0, 20) + '...');
    
    // Step 2: Get IG User ID from the Page
    console.log('🔍 Instagram API: Step 2 - Getting Instagram business account from page...');
    
    const instagramResponse = await fetch(
      `https://graph.facebook.com/v23.0/${pageId}?fields=instagram_business_account&access_token=${userToken}`
    );
    
    if (!instagramResponse.ok) {
      const errorText = await instagramResponse.text();
      console.error('❌ Instagram API: Failed to get Instagram business account. HTTP status:', instagramResponse.status, 'Response:', errorText);
      throw new Error(`Failed to get Instagram business account. HTTP status: ${instagramResponse.status}`);
    }
    
    const instagramData = await instagramResponse.json();
    console.log('📸 Instagram API: Instagram business account response:', JSON.stringify(instagramData, null, 2));
    
    if (instagramData.error) {
      console.error('❌ Instagram API: API error getting Instagram business account:', instagramData.error);
      throw new Error(`Instagram API error: ${instagramData.error.message} (Code: ${instagramData.error.code})`);
    }
    
    if (!instagramData.instagram_business_account || !instagramData.instagram_business_account.id) {
      console.error('❌ Instagram API: No Instagram business account found in response');
      throw new Error('No Instagram business account found. Make sure your Facebook page is connected to an Instagram account.');
    }
    
    const instagramUserId = instagramData.instagram_business_account.id;
    const instagramUsername = instagramData.instagram_business_account.username;
    
    console.log('✅ Instagram API: Step 2 completed successfully');
    console.log('   📸 Instagram User ID:', instagramUserId);
    console.log('   📸 Instagram Username:', instagramUsername);
    
    return {
      pageAccessToken,
      pageId,
      instagramUserId
    };
  } catch (error) {
    console.error('❌ Instagram API: Failed to get page info:', error);
    throw error;
  }
}

/**
 * Step 3: Create media container(s) (single image)
 */
export async function createSingleImageContainer(
  userId: string,
  pageAccessToken: string,
  imageUrl: string,
  caption: string
): Promise<InstagramMediaContainer> {
  try {
    console.log('🔍 Instagram API: Step 3 - Creating single image media container...');
    console.log('   📸 Instagram User ID:', userId);
    console.log('   🖼️  Image URL:', imageUrl.substring(0, 50) + '...');
    console.log('   📝 Caption length:', caption.length, 'characters');
    
    const requestBody = {
      image_url: imageUrl,
      caption: caption,
      access_token: pageAccessToken,
    };
    
    console.log('📤 Instagram API: Single image container request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${userId}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Instagram API: Failed to create single image container. HTTP status:', response.status, 'Response:', errorText);
      throw new Error(`Failed to create single image container. HTTP status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📸 Instagram API: Single image container response:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('❌ Instagram API: API error creating single image container:', data.error);
      throw new Error(`Instagram API error: ${data.error.message} (Code: ${data.error.code})`);
    }
    
    console.log('✅ Instagram API: Step 3 completed successfully - Single image container created');
    console.log('   🆔 Container ID:', data.id);
    
    return data;
  } catch (error) {
    console.error('❌ Instagram API: Failed to create single image container:', error);
    throw error;
  }
}

/**
 * Step 3a: Create individual carousel item containers
 */
export async function createCarouselItemContainers(
  userId: string,
  pageAccessToken: string,
  imageUrls: string[]
): Promise<string[]> {
  try {
    console.log('🔍 Instagram API: Step 3a - Creating individual carousel item containers...');
    console.log('   📸 Instagram User ID:', userId);
    console.log('   🖼️  Number of images:', imageUrls.length);
    
    const containerIds: string[] = [];
    
    // Create a container for each image with is_carousel_item=true
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      console.log(`   🖼️  Creating container for image ${i + 1}:`, imageUrl.substring(0, 50) + '...');
      
      const requestBody = {
        image_url: imageUrl,
        is_carousel_item: true,
        access_token: pageAccessToken,
      };
      
      console.log(`   📤 Instagram API: Carousel item ${i + 1} request body:`, JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(
        `https://graph.facebook.com/v23.0/${userId}/media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Instagram API: Failed to create carousel item ${i + 1}. HTTP status:`, response.status, 'Response:', errorText);
        throw new Error(`Failed to create carousel item ${i + 1}. HTTP status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`📸 Instagram API: Carousel item ${i + 1} response:`, JSON.stringify(data, null, 2));
      
      if (data.error) {
        console.error(`❌ Instagram API: API error creating carousel item ${i + 1}:`, data.error);
        throw new Error(`Instagram API error: ${data.error.message} (Code: ${data.error.code})`);
      }
      
      containerIds.push(data.id);
      console.log(`✅ Instagram API: Carousel item ${i + 1} container created with ID:`, data.id);
    }
    
    console.log('✅ Instagram API: Step 3a completed successfully - All carousel item containers created');
    console.log('   🆔 Container IDs:', containerIds);
    
    return containerIds;
  } catch (error) {
    console.error('❌ Instagram API: Failed to create carousel item containers:', error);
    throw error;
  }
}

/**
 * Step 3b: Create carousel container with children
 */
export async function createCarouselContainer(
  userId: string,
  pageAccessToken: string,
  childContainerIds: string[],
  caption: string
): Promise<InstagramMediaContainer> {
  try {
    console.log('🔍 Instagram API: Step 3b - Creating carousel container with children...');
    console.log('   📸 Instagram User ID:', userId);
    console.log('   🖼️  Number of child containers:', childContainerIds.length);
    console.log('   📝 Caption length:', caption.length, 'characters');
    console.log('   🆔 Child container IDs:', childContainerIds);
    
    const requestBody = {
      media_type: 'CAROUSEL',
      children: childContainerIds.join(','),
      caption: caption,
      access_token: pageAccessToken,
    };
    
    console.log('📤 Instagram API: Carousel container request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${userId}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Instagram API: Failed to create carousel container. HTTP status:', response.status, 'Response:', errorText);
      throw new Error(`Failed to create carousel container. HTTP status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📸 Instagram API: Carousel container response:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('❌ Instagram API: API error creating carousel container:', data.error);
      throw new Error(`Instagram API error: ${data.error.message} (Code: ${data.error.code})`);
    }
    
    console.log('✅ Instagram API: Step 3b completed successfully - Carousel container created');
    console.log('   🆔 Container ID:', data.id);
    
    return data;
  } catch (error) {
    console.error('❌ Instagram API: Failed to create carousel container:', error);
    throw error;
  }
}

/**
 * Step 4: Publish the media
 */
export async function publishMediaContainer(
  userId: string,
  pageAccessToken: string,
  creationId: string
): Promise<InstagramPublishResult> {
  try {
    console.log('🔍 Instagram API: Step 4 - Publishing media container...');
    console.log('   📸 Instagram User ID:', userId);
    console.log('   🆔 Creation ID:', creationId);
    
    const requestBody = {
      creation_id: creationId,
      access_token: pageAccessToken,
    };
    
    console.log('📤 Instagram API: Publish request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${userId}/media_publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Instagram API: Failed to publish media container. HTTP status:', response.status, 'Response:', errorText);
      throw new Error(`Failed to publish media container. HTTP status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📸 Instagram API: Publish response:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('❌ Instagram API: API error publishing media container:', data.error);
      throw new Error(`Instagram API error: ${data.error.message} (Code: ${data.error.code})`);
    }
    
    console.log('✅ Instagram API: Step 4 completed successfully - Media published!');
    console.log('   🆔 Published Post ID:', data.id);
    
    return data;
  } catch (error) {
    console.error('❌ Instagram API: Failed to publish media container:', error);
    throw error;
  }
}

/**
 * Complete Instagram post publishing workflow following the exact flow:
 * 1. Get Page(s) and a Page access token
 * 2. Get IG User ID from the Page
 * 3. Create media container(s) (children first if carousel)
 * 4. Publish the media
 */
export async function publishInstagramPost(
  config: InstagramConfig,
  imageUrls: string[],
  caption: string
): Promise<{ containerId: string; publishedPostId: string }> {
  try {
    console.log('🚀 Instagram API: Starting complete publishing workflow...');
    console.log('   📸 Number of images:', imageUrls.length);
    console.log('   📝 Caption length:', caption.length, 'characters');
    console.log('   🔑 User token provided:', !!config.userToken);
    
    // Step 1: Get Page(s) and a Page access token
    // Step 2: Get IG User ID from the Page
    console.log('🔍 Instagram API: Executing Steps 1 & 2 - Getting page info and Instagram user ID...');
    const { pageAccessToken, pageId, instagramUserId } = await getPageInfo(config.userToken);
    
    console.log('✅ Instagram API: Steps 1 & 2 completed successfully');
    console.log('   📍 Page ID:', pageId);
    console.log('   📸 Instagram User ID:', instagramUserId);
    
    // Step 3: Create media container(s) (children first if carousel)
    console.log('🔍 Instagram API: Executing Step 3 - Creating media container...');
    let container: InstagramMediaContainer;
    
    if (imageUrls.length === 1) {
      console.log('📸 Instagram API: Creating single image container...');
      container = await createSingleImageContainer(
        instagramUserId,
        pageAccessToken,
        imageUrls[0],
        caption
      );
    } else {
      console.log('🖼️  Instagram API: Creating carousel with', imageUrls.length, 'images...');
      
      // Step 3a: Create individual carousel item containers first
      console.log('🔍 Instagram API: Step 3a - Creating individual carousel item containers...');
      const childContainerIds = await createCarouselItemContainers(
        instagramUserId,
        pageAccessToken,
        imageUrls
      );
      
      // Step 3b: Create carousel container with children
      console.log('🔍 Instagram API: Step 3b - Creating carousel container with children...');
      container = await createCarouselContainer(
        instagramUserId,
        pageAccessToken,
        childContainerIds,
        caption
      );
    }
    
    console.log('✅ Instagram API: Step 3 completed successfully');
    console.log('   🆔 Container ID:', container.id);
    
    // Step 4: Publish the media
    console.log('🔍 Instagram API: Executing Step 4 - Publishing media...');
    const publishedPost = await publishMediaContainer(
      instagramUserId,
      pageAccessToken,
      container.id
    );
    
    console.log('✅ Instagram API: Step 4 completed successfully');
    console.log('   🆔 Published Post ID:', publishedPost.id);
    
    console.log('🎉 Instagram API: Complete publishing workflow successful!');
    console.log('   📸 Container ID:', container.id);
    console.log('   🆔 Published Post ID:', publishedPost.id);
    
    return {
      containerId: container.id,
      publishedPostId: publishedPost.id
    };
  } catch (error) {
    console.error('❌ Instagram API: Complete publishing workflow failed:', error);
    console.error('   📍 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}
