import express from 'express';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { initDB, getLastPost, savePost } from './db.js';
import { generateInstagramPost } from './claude.js';
import { scheduleToBuffer } from './buffer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize database
initDB();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Manual post generation endpoint (for testing)
app.post('/generate-post', async (req, res) => {
  try {
    console.log('[API] Generating post manually...');
    const post = await generateInstagramPost();
    res.json({ success: true, post });
  } catch (error) {
    console.error('[ERROR] Post generation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Schedule daily post generation
// Runs at a random time between 17:45 and 18:15 UK time every day
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
      const post = await generateInstagramPost();
      
      // Schedule to Buffer
      const bufferResult = await scheduleToBuffer(post);
      
      // Save to database
      savePost({
        caption: post.caption,
        narrativeBeat: post.narrative_beat,
        photoGuidance: post.photo_guidance,
        postingTime: post.posting_time,
        bufferScheduleId: bufferResult.buffer_id,
        timestamp: new Date().toISOString()
      });
      
      console.log(`[SUCCESS] Post scheduled to Buffer: ${bufferResult.buffer_id}`);
    } catch (error) {
      console.error(`[ERROR] Daily post generation failed: ${error.message}`);
    }
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`[SERVER] Stokeyhouse automation running on port ${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
  schedulePostGeneration();
});

export default app;
