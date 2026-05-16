import axios from 'axios';
import FormData from 'form-data';

const BUFFER_API_KEY = process.env.BUFFER_API_KEY;
const BUFFER_API_URL = 'https://api.bufferapp.com/1';

export async function scheduleToBuffer(post) {
  try {
    // Get Buffer profile ID (Instagram account)
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

    // If post has a photo, upload it
    let photoUrl = null;
    if (post.photo && post.photo.base64) {
      console.log('[BUFFER] Uploading photo...');
      photoUrl = await uploadPhotoToBuffer(post.photo.base64, instagramProfile.id);
      console.log('[BUFFER] Photo uploaded:', photoUrl);
    }

    // Schedule the post with caption and photo
    const scheduleResponse = await axios.post(
      `${BUFFER_API_URL}/updates/create.json`,
      {
        profile_ids: [instagramProfile.id],
        text: post.caption,
        ...(photoUrl && { media: { link: photoUrl } }),
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
      profile_id: instagramProfile.id,
      photo_filename: post.photo?.filename || null
    };

  } catch (error) {
    console.error('[BUFFER ERROR]', error.message);
    throw error;
  }
}

async function uploadPhotoToBuffer(base64Data, profileId) {
  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Create FormData with the image
    const form = new FormData();
    form.append('file', buffer, 'stokeyhouse-photo.jpg');
    form.append('profile_id', profileId);

    const response = await axios.post(
      `${BUFFER_API_URL}/media/upload.json`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${BUFFER_API_KEY}`
        },
        params: {
          access_token: BUFFER_API_KEY
        }
      }
    );

    return response.data.media.url;

  } catch (error) {
    console.error('[BUFFER UPLOAD ERROR]', error.message);
    // If upload fails, continue without the photo
    return null;
  }
}
