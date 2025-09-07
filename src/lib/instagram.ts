import logger, {LogContext} from "./logger.ts";

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
    logger.debug(LogContext.INSTAGRAM_API, 'Step 1 - Getting pages and access tokens');
    
    // Get page access token
    const response = await fetch(
      `https://graph.facebook.com/v23.0/me/accounts?access_token=${userToken}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(LogContext.INSTAGRAM_API, 'Failed to get pages', errorText, { status: response.status });
      throw new Error(`Failed to get pages. HTTP status: ${response.status}`);
    }
    
    const data = await response.json();
    logger.debug(LogContext.INSTAGRAM_API, 'Pages response received', { data });
    
    if (data.error) {
      logger.error(LogContext.INSTAGRAM_API, 'API error getting pages', data.error);
      throw new Error(`Instagram API error: ${data.error.message} (Code: ${data.error.code})`);
    }

    if (!data.data || data.data.length === 0) {
      logger.error(LogContext.INSTAGRAM_API, 'No Facebook pages found in response');
      throw new Error('No Facebook pages found. Make sure your Instagram account is connected to a Facebook page.');
    }
    
    const pageAccessToken = data.data[0].access_token;
    const pageId = data.data[0].id;
    const pageName = data.data[0].name;
    
    logger.info(LogContext.INSTAGRAM_API, 'Step 1 completed successfully', {
      pageId,
      pageName,
      tokenPreview: pageAccessToken.substring(0, 20) + '...'
    });
    
    // Step 2: Get IG User ID from the Page
    logger.debug(LogContext.INSTAGRAM_API, 'Step 2 - Getting Instagram business account from page');
    
    const instagramResponse = await fetch(
      `https://graph.facebook.com/v23.0/${pageId}?fields=instagram_business_account&access_token=${userToken}`
    );
    
    if (!instagramResponse.ok) {
      const errorText = await instagramResponse.text();
      logger.error(LogContext.INSTAGRAM_API, 'Failed to get Instagram business account', errorText, { status: instagramResponse.status });
      throw new Error(`Failed to get Instagram business account. HTTP status: ${instagramResponse.status}`);
    }
    
    const instagramData = await instagramResponse.json();
    logger.debug(LogContext.INSTAGRAM_API, 'Instagram business account response received', { data: instagramData });
    
    if (instagramData.error) {
      logger.error(LogContext.INSTAGRAM_API, 'API error getting Instagram business account', instagramData.error);
      throw new Error(`Instagram API error: ${instagramData.error.message} (Code: ${instagramData.error.code})`);
    }
    
    if (!instagramData.instagram_business_account || !instagramData.instagram_business_account.id) {
      logger.error(LogContext.INSTAGRAM_API, 'No Instagram business account found in response');
      throw new Error('No Instagram business account found. Make sure your Facebook page is connected to an Instagram account.');
    }
    
    const instagramUserId = instagramData.instagram_business_account.id;
    const instagramUsername = instagramData.instagram_business_account.username;
    
    logger.info(LogContext.INSTAGRAM_API, 'Step 2 completed successfully');
    logger.debug(LogContext.INSTAGRAM_API, 'Instagram User ID and Username', { instagramUserId, instagramUsername });
    
    return {
      pageAccessToken,
      pageId,
      instagramUserId
    };
  } catch (error) {
    logger.error(LogContext.INSTAGRAM_API, 'Failed to get page info', error);
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
    logger.debug(LogContext.INSTAGRAM_API, 'Step 3 - Creating single image media container', {
      userId,
      imageUrl: imageUrl.substring(0, 50) + '...',
      captionLength: caption.length
    });
    
    const requestBody = {
      image_url: imageUrl,
      caption: caption,
      access_token: pageAccessToken,
    };
    
    logger.debug(LogContext.INSTAGRAM_API, 'Single image container request body', { requestBody });
    
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
      logger.error(LogContext.INSTAGRAM_API, 'Failed to create single image container', errorText, { status: response.status });
      throw new Error(`Failed to create single image container. HTTP status: ${response.status}`);
    }
    
    const data = await response.json();
    logger.debug(LogContext.INSTAGRAM_API, 'Single image container response', { data });
    
    if (data.error) {
      logger.error(LogContext.INSTAGRAM_API, 'API error creating single image container', data.error);
      throw new Error(`Instagram API error: ${data.error.message} (Code: ${data.error.code})`);
    }
    
    logger.info(LogContext.INSTAGRAM_API, 'Step 3 completed successfully - Single image container created', { containerId: data.id });
    
    return data;
  } catch (error) {
    logger.error(LogContext.INSTAGRAM_API, 'Failed to create single image container', error);
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
    logger.debug(LogContext.INSTAGRAM_API, 'Step 3a - Creating individual carousel item containers', {
      userId,
      imageCount: imageUrls.length
    });
    
    const containerIds: string[] = [];
    
    // Create a container for each image with is_carousel_item=true
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      logger.debug(LogContext.INSTAGRAM_API, `Creating container for image ${i + 1}`, { 
        imageUrl: imageUrl.substring(0, 50) + '...' 
      });
      
      const requestBody = {
        image_url: imageUrl,
        is_carousel_item: true,
        access_token: pageAccessToken,
      };
      
      logger.debug(LogContext.INSTAGRAM_API, `Carousel item ${i + 1} request body`, { requestBody });
      
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
        logger.error(LogContext.INSTAGRAM_API, `Failed to create carousel item ${i + 1}`, errorText, { status: response.status });
        throw new Error(`Failed to create carousel item ${i + 1}. HTTP status: ${response.status}`);
      }
      
      const data = await response.json();
      logger.debug(LogContext.INSTAGRAM_API, `Carousel item ${i + 1} response`, { data });
      
      if (data.error) {
        logger.error(LogContext.INSTAGRAM_API, `API error creating carousel item ${i + 1}`, data.error);
        throw new Error(`Instagram API error: ${data.error.message} (Code: ${data.error.code})`);
      }
      
      containerIds.push(data.id);
      logger.debug(LogContext.INSTAGRAM_API, `Carousel item ${i + 1} container created`, { containerId: data.id });
    }
    
    logger.info(LogContext.INSTAGRAM_API, 'Step 3a completed successfully - All carousel item containers created', { containerIds });
    
    return containerIds;
  } catch (error) {
    logger.error(LogContext.INSTAGRAM_API, 'Failed to create carousel item containers', error);
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
    logger.debug(LogContext.INSTAGRAM_API, 'Step 3b - Creating carousel container with children', {
      userId,
      childContainerCount: childContainerIds.length,
      captionLength: caption.length,
      childContainerIds
    });
    
    const requestBody = {
      media_type: 'CAROUSEL',
      children: childContainerIds.join(','),
      caption: caption,
      access_token: pageAccessToken,
    };
    
    logger.debug(LogContext.INSTAGRAM_API, 'Carousel container request body', { requestBody });
    
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
      logger.error(LogContext.INSTAGRAM_API, 'Failed to create carousel container', errorText, { status: response.status });
      throw new Error(`Failed to create carousel container. HTTP status: ${response.status}`);
    }
    
    const data = await response.json();
    logger.debug(LogContext.INSTAGRAM_API, 'Carousel container response', { data });
    
    if (data.error) {
      logger.error(LogContext.INSTAGRAM_API, 'API error creating carousel container', data.error);
      throw new Error(`Instagram API error: ${data.error.message} (Code: ${data.error.code})`);
    }
    
    logger.info(LogContext.INSTAGRAM_API, 'Step 3b completed successfully - Carousel container created', { containerId: data.id });
    
    return data;
  } catch (error) {
    logger.error(LogContext.INSTAGRAM_API, 'Failed to create carousel container', error);
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
    logger.debug(LogContext.INSTAGRAM_API, 'Step 4 - Publishing media container', {
      userId,
      creationId
    });
    
    const requestBody = {
      creation_id: creationId,
      access_token: pageAccessToken,
    };
    
    logger.debug(LogContext.INSTAGRAM_API, 'Publish request body', { requestBody });
    
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
      logger.error(LogContext.INSTAGRAM_API, 'Failed to publish media container', errorText, { status: response.status });
      throw new Error(`Failed to publish media container. HTTP status: ${response.status}`);
    }
    
    const data = await response.json();
    logger.debug(LogContext.INSTAGRAM_API, 'Publish response', { data });
    
    if (data.error) {
      logger.error(LogContext.INSTAGRAM_API, 'API error publishing media container', data.error);
      throw new Error(`Instagram API error: ${data.error.message} (Code: ${data.error.code})`);
    }
    
    logger.info(LogContext.INSTAGRAM_API, 'Step 4 completed successfully - Media published', { publishedPostId: data.id });
    
    return data;
  } catch (error) {
    logger.error(LogContext.INSTAGRAM_API, 'Failed to publish media container', error);
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
    logger.info(LogContext.INSTAGRAM_API, 'Starting complete publishing workflow', {
      imageCount: imageUrls.length,
      captionLength: caption.length,
      hasUserToken: !!config.userToken
    });
    
    // Step 1: Get Page(s) and a Page access token
    // Step 2: Get IG User ID from the Page
    logger.debug(LogContext.INSTAGRAM_API, 'Executing Steps 1 & 2 - Getting page info and Instagram user ID');
    const { pageAccessToken, pageId, instagramUserId } = await getPageInfo(config.userToken);
    
    logger.info(LogContext.INSTAGRAM_API, 'Steps 1 & 2 completed successfully', {
      pageId,
      instagramUserId
    });
    
    // Step 3: Create media container(s) (children first if carousel)
    logger.debug(LogContext.INSTAGRAM_API, 'Executing Step 3 - Creating media container');
    let container: InstagramMediaContainer;
    
    if (imageUrls.length === 1) {
      logger.debug(LogContext.INSTAGRAM_API, 'Creating single image container');
      container = await createSingleImageContainer(
        instagramUserId,
        pageAccessToken,
        imageUrls[0],
        caption
      );
    } else {
      logger.debug(LogContext.INSTAGRAM_API, 'Creating carousel', { imageCount: imageUrls.length });
      
      // Step 3a: Create individual carousel item containers first
      logger.debug(LogContext.INSTAGRAM_API, 'Step 3a - Creating individual carousel item containers');
      const childContainerIds = await createCarouselItemContainers(
        instagramUserId,
        pageAccessToken,
        imageUrls
      );
      
      // Step 3b: Create carousel container with children
      logger.debug(LogContext.INSTAGRAM_API, 'Step 3b - Creating carousel container with children');
      container = await createCarouselContainer(
        instagramUserId,
        pageAccessToken,
        childContainerIds,
        caption
      );
    }
    
    logger.info(LogContext.INSTAGRAM_API, 'Step 3 completed successfully', { containerId: container.id });
    
    // Step 4: Publish the media
    logger.debug(LogContext.INSTAGRAM_API, 'Executing Step 4 - Publishing media');
    const publishedPost = await publishMediaContainer(
      instagramUserId,
      pageAccessToken,
      container.id
    );
    
    logger.info(LogContext.INSTAGRAM_API, 'Step 4 completed successfully', { publishedPostId: publishedPost.id });
    
    logger.info(LogContext.INSTAGRAM_API, 'Complete publishing workflow successful', {
      containerId: container.id,
      publishedPostId: publishedPost.id
    });
    
    return {
      containerId: container.id,
      publishedPostId: publishedPost.id
    };
  } catch (error) {
    logger.error(LogContext.INSTAGRAM_API, 'Complete publishing workflow failed', error, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}
