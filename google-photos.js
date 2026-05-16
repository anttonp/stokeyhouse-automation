import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback';

let oauth2Client = null;

export function initGoogleAuth() {
  oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
  console.log('[GOOGLE AUTH] Initialized');
}

export function getAuthUrl() {
  const scopes = ['https://www.googleapis.com/auth/photoslibrary.readonly'];
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  return authUrl;
}

export async function handleAuthCallback(code) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Save refresh token to environment or file
    console.log('[GOOGLE AUTH] Tokens obtained. Refresh token:', tokens.refresh_token);
    
    return tokens;
  } catch (error) {
    console.error('[GOOGLE AUTH ERROR]', error);
    throw error;
  }
}

export async function setRefreshToken(refreshToken) {
  if (!oauth2Client) initGoogleAuth();
  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });
  console.log('[GOOGLE AUTH] Refresh token set');
}

export async function getPhotosFromAlbum() {
  try {
    if (!oauth2Client) initGoogleAuth();

    const photosLibrary = google.photoslibrary({
      version: 'v1',
      auth: oauth2Client
    });

    // Search for all photos in library (in production, filter by album)
    const response = await photosLibrary.mediaItems.search({
      requestBody: {
        pageSize: 50,
        orderBy: 'NEWEST_FIRST'
      }
    });

    const mediaItems = response.data.mediaItems || [];
    console.log(`[GOOGLE PHOTOS] Found ${mediaItems.length} photos`);

    return mediaItems.map(item => ({
      id: item.id,
      filename: item.filename,
      mimeType: item.mimeType,
      mediaMetadata: item.mediaMetadata,
      productUrl: item.productUrl,
      // Construct download URL with access token
      baseUrl: item.baseUrl
    }));

  } catch (error) {
    console.error('[GOOGLE PHOTOS ERROR]', error.message);
    throw error;
  }
}

export async function downloadPhotoAsBase64(photoUrl) {
  try {
    // Add parameters for download
    const downloadUrl = `${photoUrl}=w1200-h1200`;
    
    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });

    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    console.log('[PHOTO DOWNLOAD] Successfully downloaded and converted to base64');
    
    return base64;

  } catch (error) {
    console.error('[PHOTO DOWNLOAD ERROR]', error.message);
    throw error;
  }
}

export async function analyzePhotoWithClaude(photoBase64, photoFilename) {
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: photoBase64
                }
              },
              {
                type: 'text',
                text: `Analyze this Stokeyhouse renovation photo. Rate it 1-10 for Instagram suitability based on:
- Visual clarity and composition
- Shows renovation progress/narrative
- Before/after potential
- Overall interest level

Respond ONLY with JSON:
{
  "quality_score": 1-10,
  "description": "What the photo shows",
  "narrative_fit": "How this fits the renovation story",
  "before_after": true/false,
  "recommendation": "Post this?" (yes/no/maybe)
}`
              }
            ]
          }
        ]
      },
      {
        headers: {
          'x-api-key': process.env.CLAUDE_API_KEY,
          'content-type': 'application/json'
        }
      }
    );

    const content = response.data.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Failed to parse Claude vision response');
    }

    const analysis = JSON.parse(jsonMatch[0]);
    console.log(`[PHOTO ANALYSIS] ${photoFilename}: Score ${analysis.quality_score}/10`);
    
    return analysis;

  } catch (error) {
    console.error('[PHOTO ANALYSIS ERROR]', error.message);
    throw error;
  }
}

export async function applyHB2ColorGrading(photoBase64) {
  // HB2 preset parameters (approximation based on VSCO HB2 characteristics)
  // Warm tones, lifted shadows, slight contrast increase
  
  try {
    // For now, we'll use a placeholder
    // In production, you'd integrate with a color processing library like:
    // - Sharp (for basic adjustments)
    // - OpenCV (for advanced color grading)
    // - Cloud Vision API (for color detection)
    
    console.log('[COLOR GRADING] Applying HB2 preset (warm, lifted shadows)');
    
    // Return the base64 as-is for now
    // Full implementation would apply actual color adjustments
    return photoBase64;

  } catch (error) {
    console.error('[COLOR GRADING ERROR]', error.message);
    throw error;
  }
}
