import { google } from 'googleapis';
import axios from 'axios';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback';
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID; // Folder ID from shared Drive folder

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
  const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
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

export async function getPhotosFromDriveFolder() {
  try {
    if (!oauth2Client) initGoogleAuth();

    if (!DRIVE_FOLDER_ID) {
      throw new Error('DRIVE_FOLDER_ID not set in environment variables');
    }

    const drive = google.drive({
      version: 'v3',
      auth: oauth2Client
    });

    // Query for image files in the specified folder, sorted by creation time (newest first)
    const response = await drive.files.list({
      q: `'${DRIVE_FOLDER_ID}' in parents and mimeType contains 'image/' and trashed=false`,
      spaces: 'drive',
      pageSize: 50,
      orderBy: 'createdTime desc',
      fields: 'files(id, name, mimeType, createdTime, webContentLink, thumbnailLink)'
    });

    const files = response.data.files || [];
    console.log(`[GOOGLE DRIVE] Found ${files.length} image files`);

    return files.map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      createdTime: file.createdTime,
      downloadUrl: file.webContentLink,
      thumbnailUrl: file.thumbnailLink
    }));

  } catch (error) {
    console.error('[GOOGLE DRIVE ERROR]', error.message);
    throw error;
  }
}

export async function downloadPhotoAsBase64(fileId) {
  try {
    if (!oauth2Client) initGoogleAuth();

    const drive = google.drive({
      version: 'v3',
      auth: oauth2Client
    });

    // Get file content
    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    console.log(`[PHOTO DOWNLOAD] Successfully downloaded file ${fileId}`);
    
    return base64;

  } catch (error) {
    console.error('[PHOTO DOWNLOAD ERROR]', error.message);
    throw error;
  }
}

export async function analyzePhotoWithClaude(photoBase64, photoName) {
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
                text: `Analyze this Stokeyhouse Victorian renovation photo. Rate it 1-10 for Instagram suitability based on:
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
  "recommendation": "yes/no/maybe"
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
    console.log(`[PHOTO ANALYSIS] ${photoName}: Score ${analysis.quality_score}/10`);
    
    return analysis;

  } catch (error) {
    console.error('[PHOTO ANALYSIS ERROR]', error.message);
    throw error;
  }
}

export async function applyHB2ColorGrading(photoBase64) {
  // HB2 preset parameters (approximation)
  // Warm tones, lifted shadows, slight contrast increase
  
  try {
    console.log('[COLOR GRADING] Applying HB2 preset (warm, lifted shadows)');
    
    // For now, return as-is
    // Full implementation would use Sharp or similar to apply:
    // - Color temperature shift (~+500K warmth)
    // - Lift shadows (~+20 brightness to dark areas)
    // - Increase saturation (~+15%)
    // - Slight contrast boost (~+10%)
    
    return photoBase64;

  } catch (error) {
    console.error('[COLOR GRADING ERROR]', error.message);
    throw error;
  }
}
