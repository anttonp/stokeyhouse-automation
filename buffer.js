import axios from 'axios';

// All API keys come from environment variables (.env)
// Never commit secrets to the repository
const BUFFER_API_URL = 'https://api.bufferapp.com/1';

export async function scheduleToBuffer(post) {
    // Check API key inside the function so a missing key throws a proper error
  // instead of crashing the whole server at startup
  const BUFFER_API_KEY = process.env.BUFFER_API_KEY;
    if (!BUFFER_API_KEY) {
          throw new Error('BUFFER_API_KEY not set in environment variables');
    }

  try {
        // Get Buffer profile ID (Instagram account)
      // This assumes you've already connected your Instagram account to Buffer
      const profilesResponse = await axios.get(`${BUFFER_API_URL}/profiles.json`, {
              params: { access_token: BUFFER_API_KEY }
      });

      const instagramProfile = profilesResponse.data.find(p => p.service === 'instagram');

      if (!instagramProfile) {
              throw new Error('No Instagram profile connected to Buffer');
      }

      console.log(`[BUFFER] Using profile: ${instagramProfile.id}`);

      // Parse posting time and convert to ISO format
      const [hour, minute] = post.posting_time.split(':');
        const now = new Date();
        let scheduleTime = new Date(now);
        scheduleTime.setHours(parseInt(hour), parseInt(minute), 0, 0);

      // If the time has already passed today, schedule for tomorrow
      if (scheduleTime <= now) {
              scheduleTime.setDate(scheduleTime.getDate() + 1);
      }

      // Schedule the post
      const scheduleResponse = await axios.post(
              `${BUFFER_API_URL}/updates/create.json`,
        {
                  profile_ids: [instagramProfile.id],
                  text: post.caption,
                  media: {
                              link: 'https://stokeyhouse.example.com/image.jpg'
                  },
                  scheduled_at: Math.floor(scheduleTime.getTime() / 1000),
                  service: 'instagram'
        },
        {
                  params: { access_token: BUFFER_API_KEY }
        }
            );

      console.log('[BUFFER] Post scheduled:', scheduleResponse.data.id);

      return {
              buffer_id: scheduleResponse.data.id,
              scheduled_time: scheduleTime.toISOString(),
              profile_id: instagramProfile.id
      };

  } catch (error) {
        console.error('[BUFFER ERROR]', error.message);
        throw error;
  }
}
