import express from 'express';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { initDB, getLastPost, savePost } from './db.js';
import { generateInstagramPost } from './claude.js';
import { scheduleToBuffer } from './buffer.js';
import { 
  initGoogleAuth, 
  getAuthUrl, 
  handleAuthCallback,
  setRefreshToken,
  getPhotosFromAlbum,
  downloadPhotoAsBase64,
  analyzePhotoWithClaude,
  applyHB2ColorGrading
} from './google-photos.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize database and Google auth
initDB();
initGoogleAuth();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OAuth callback endpoint
app.get('/auth/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).json({ error: 'No authorization code provided' });
    }

    const tokens = await handleAuthCallback(code);
    res.json({ 
      success: true, 
      message: 'Google Photos authorized successfully',
      refresh_token: tokens.refresh_token
    });

    console.log('[AUTH] Authorization successful. Save this refresh token in Railway Variables: GOOGLE_REFRESH_TOKEN');

  } catch (error) {
    console.error('[AUTH ERROR]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get authorization URL
app.get('/auth/start', (req, res) => {
  const authUrl = getAuthUrl();
  res.json({ 
    auth_url: authUrl,
    message: 'Visit this URL to authorize Google Photos access'
  });
});

// Manual post generation endpoint with photo
app.post('/generate-post', async (req, res) => {
  try {
    console.log('[API] Generating post with photo (POST)...');
    const post = await generateInstagramPostWithPhoto();
    res.json({ success: true, post });
  } catch (error) {
    console.error('[ERROR] Post generation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET endpoint for easy testing in browser
app.get('/generate-post', async (req, res) => {
  try {
    console.log('[API] Generating post with photo (GET)...');
    const post = await generateInstagramPostWithPhoto();
    res.json({ success: true, post });
  } catch (error) {
    console.error('[ERROR] Post generation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function generateInstagramPostWithPhoto() {
  try {
    // Step 1: Generate caption
    console.log('[POST GEN] Step 1: Generating caption...');
    const captionPost = await generateInstagramPost();

    // Step 2: Fetch photos from Google Photos
    console.log('[POST GEN] Step 2: Fetching photos from Google Photos...');
    const photos = await getPhotosFromAlbum();
    
    if (!photos || photos.length === 0) {
      throw new Error('No photos found in Google Photos album');
    }

    // Step 3: Analyze each photo and pick the best
    console.log('[POST GEN] Step 3: Analyzing photos...');
    let bestPhoto = null;
    let bestScore = 0;
    let bestAnalysis = null;

    for (const photo of photos.slice(0, 10)) { // Check latest 10 photos
      try {
        const photoBase64 = await downloadPhotoAsBase64(photo.baseUrl);
        const analysis = await analyzePhotoWithClaude(photoBase64, photo.filename);
        
        if (analysis.quality_score > bestScore && analysis.recommendation !== 'no') {
          bestScore = analysis.quality_score;
          bestPhoto = { ...photo, base64: photoBase64 };
          bestAnalysis = analysis;
        }
      } catch (err) {
        console.warn(`[POST GEN] Skipping photo ${photo.filename}: ${err.message}`);
      }
    }

    if (!bestPhoto) {
      throw new Error('No suitable photos found for posting');
    }

    // Step 4: Apply color grading
    console.log('[POST GEN] Step 4: Applying HB2 color grading...');
    const gradedBase64 = await applyHB2ColorGrading(bestPhoto.base64);

    // Step 5: Return complete post with photo
    const completePost = {
      ...captionPost,
      photo: {
        filename: bestPhoto.filename,
        base64: gradedBase64,
        description: bestAnalysis.description,
        quality_score: bestAnalysis.quality_score,
        before_after: bestAnalysis.before_after
      }
    };

    console.log('[POST GEN] Complete post ready with photo');
    return completePost;

  } catch (error) {
    console.error('[POST GEN ERROR]', error.message);
    throw error;
  }
}

// Schedule daily post generation with photo
function schedulePostGeneration() {
  // Generate a random minute between 45-75 (17:45 to 18:15)
  const randomMinute = Math.floor(Math.random() * 31) + 45;
  const hour = Math.floor(randomMinute / 60) + 17;
  const minute = randomMinute % 60;
  
  // Cron format: minute hour * * * (every day)
  const cronExpression = `${minute} ${hour} * * *`;
  
  console.log(`[SCHEDULER] Post generation scheduled for ${hour}:${String(minute).padStart(2, '0')} UK time daily`);
  
  cron.schedule(cronExpression, async () => {
    console.log(`[SCHEDULER] Executing post generation at ${new Date().toISOString()}`);
    try {
      const post = await generateInstagramPostWithPhoto();
      
      // Schedule to Buffer with photo
      const bufferResult = await scheduleToBuffer(post);
      
      // Save to database
      savePost({
        caption: post.caption,
        narrativeBeat: post.narrative_beat,
        photoGuidance: post.photo_guidance,
        postingTime: post.posting_time,
        photoFilename: post.photo.filename,
        bufferScheduleId: bufferResult.buffer_id,
        timestamp: new Date().toISOString()
      });
      
      console.log(`[SUCCESS] Post with photo scheduled to Buffer: ${bufferResult.buffer_id}`);
    } catch (error) {
      console.error(`[ERROR] Daily post generation failed: ${error.message}`);
    }
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`[SERVER] Stokeyhouse automation running on port ${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Set refresh token if provided
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    setRefreshToken(process.env.GOOGLE_REFRESH_TOKEN);
    console.log('[SERVER] Google Photos refresh token loaded');
  } else {
    console.log('[SERVER] Visit /auth/start to authorize Google Photos');
  }
  
  schedulePostGeneration();
});

export default app;
