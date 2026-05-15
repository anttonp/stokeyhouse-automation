import axios from 'axios';
import { getLastPost } from './db.js';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

const PROJECT_CONTEXT = `
You are the Instagram strategist for Stokeyhouse, a Victorian house renovation in Stoke Newington, London.

PROPERTY & TIMELINE:
- Built: ~1840 Victorian house, originally one building, split into two flats
- Acquisition: First viewing April 2025, purchased Nov 4, 2025 (6-month process)
- Work started: End November 2025
- Strip-out: December 2025
- Discoveries: 
  * Back floor/joists completely removed (unplanned) - December surprise
  * Concrete slab removal required (humidity issue)
  * Both discoveries delayed project ~3 months
- Rebuilding phases:
  * January: Floor rebuilding
  * Mid-January: Master joist discovery (perforated, bending) - emergency upstairs strip-out and structural strengthening
  * February: Extension foundation
  * March-April: Extension build
  * Current (May 2026): Ongoing rebuild

AMAZING DISCOVERIES:
- Original floorboards hidden under 7 layers of carpet (reveal moment)
- Plasterboard corbels
- Original cornicing (collapsed, will rebuild)

OWNERS: Antton & Lucy
- Young couple with newborn baby
- Got married while buying the house
- Living elsewhere during renovation
- Looking forward to moving in
- This is their family home

INSTAGRAM STRATEGY:
- Account: @stokeyhouse
- Goal: Build large following (dream house seekers, DIYers, renovation enthusiasts, design-curious, real estate interested, Grant J Bates-style followers)
- Tone: Slightly catastrophic (make issues feel big), but natural British, believable, humble
- Reflect: Genuine hard work, excitement, humility of a young couple building their dream home
- Photos: Mix of wide room shots + closeups + progress sequences
- Only post if there's genuine narrative
- Build continuity day-to-day (reference previous posts)

POSTING STRATEGY:
- Target: 6pm UK time, fluctuate ±15 minutes daily (vary by 3-8 mins each day, never exact)
- Optimize for algorithm engagement based on recent post performance
- Post daily
`;

export async function generateInstagramPost() {
  try {
    // Get last post for narrative continuity
    const lastPost = getLastPost();
    const lastCaption = lastPost ? lastPost.caption : null;

    const systemPrompt = `${PROJECT_CONTEXT}

${lastCaption ? `PREVIOUS POST (for narrative continuity):\n"${lastCaption}"\n\nGenerate today's post that builds on this narrative.` : 'This is the first post. Set the tone and introduce the project.'}

Generate ONLY a JSON response (no other text) with these fields:
{
  "narrative_beat": "One sentence describing the key moment/message",
  "caption": "Instagram caption (150-300 words, conversational, slightly catastrophic but humble)",
  "photo_guidance": "What type of photo would work best (wide shot, before/after, detail, sequence, etc.)",
  "posting_time": "HH:MM format between 17:45-18:15 UK time",
  "why_this_works": "2-3 sentences explaining why this post advances the narrative"
}`;

    const response = await axios.post(
      CLAUDE_API_URL,
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: 'Generate today\'s Instagram post for Stokeyhouse.'
          }
        ]
      },
      {
        headers: {
          'x-api-key': CLAUDE_API_KEY,
          'content-type': 'application/json'
        }
      }
    );

    const content = response.data.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Failed to parse Claude response as JSON');
    }

    const post = JSON.parse(jsonMatch[0]);
    console.log('[CLAUDE] Post generated:', post.narrative_beat);
    
    return post;

  } catch (error) {
    console.error('[CLAUDE ERROR]', error.message);
    throw error;
  }
}
