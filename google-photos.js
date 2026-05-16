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

async function getAccessToken() {
    const { token } = await oauth2Client.getAccessToken();
    return token;
}

export async function getPhotosFromAlbum() {
    try {
          if (!oauth2Client) initGoogleAuth();

      const accessToken = await getAccessToken();

      // Use the REST API directly — google.photoslibrary is not part of the googleapis npm package
      const response = await axios.post(
              'https://photoslibrary.googleapis.com/v1/mediaItems:search',
        {
                  pageSize: 50
        },
        {
                  headers: {
                              Authorization: `Bearer ${accessToken}`,
                              'Content-Type': 'application/json'
                  }
        }
            );

      const mediaItems = response.data.mediaItems || [];
          console.log(`[GOOGLE PHOTOS] Found ${mediaItems.length} photos`);

      return mediaItems.map(item => ({
              id: item.id,
              filename: item.filename,
              mimeType: item.mimeType,
              mediaMetadata: item.mediaMetadata,
              productUrl: item.productUrl,
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
                      model: 'claude-opus-4-5',
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
                                                          text: `You are helping create Instagram captions for @stokeyhouse, a Victorian house renovation in Stoke Newington, London. 

                                                          Analyze this renovation photo (${photoFilename}) and provide:
                                                          1. A brief description of what's shown
                                                          2. The renovation stage (e.g., demolition, structural, plastering, electrical, plumbing, finishing)
                                                          3. Key features visible

                                                          Keep your response concise and factual.`
                                        }
                                                    ]
                        }
                                ]
            },
            {
                      headers: {
                                  'x-api-key': process.env.CLAUDE_API_KEY,
                                  'anthropic-version': '2023-06-01',
                                  'Content-Type': 'application/json'
                      }
            }
                );

      const analysis = response.data.content[0].text;
          console.log('[CLAUDE ANALYSIS] Photo analyzed successfully');
          return analysis;

    } catch (error) {
          console.error('[CLAUDE ANALYSIS ERROR]', error.message);
          throw error;
    }
}

export async function applyHB2ColorGrading(imageBase64) {
    try {
          // HB2 film simulation: warm shadows, lifted blacks, slight fade
      // Since we can't use actual film LUTs without additional libraries,
      // we return the image as-is and note that color grading happens client-side
      console.log('[COLOR GRADING] Returning image for client-side HB2 processing');
          return imageBase64;
    } catch (error) {
          console.error('[COLOR GRADING ERROR]', error.message);
          throw error;
    }
}
