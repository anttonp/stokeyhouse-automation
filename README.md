# Stokeyhouse Instagram Automation Backend

Automated daily Instagram posting for the Stokeyhouse Victorian renovation project.

## Features

- **Daily automation**: Generates and schedules posts at 6pm UK time (±15 mins for algorithm optimization)
- **Claude-powered captions**: Uses Claude API to generate contextual, narrative-driven captions
- **Narrative continuity**: Each post builds on the previous day's story
- **Buffer integration**: Automatically schedules posts to your Instagram account via Buffer
- **Post history**: SQLite database tracks all generated posts for analytics and context

## Architecture

```
Daily Scheduler (node-cron)
  ↓
Claude API (caption generation with project context)
  ↓
Buffer API (schedule to Instagram)
  ↓
SQLite Database (store history for narrative continuity)
```

## Setup Instructions

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/stokeyhouse-automation.git
cd stokeyhouse-automation
npm install
```

### 2. Environment Variables

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Fill in your credentials:
- `CLAUDE_API_KEY`: Your Anthropic Claude API key
- `BUFFER_API_KEY`: Your Buffer API token
- `GOOGLE_CLIENT_ID`: From Google Cloud credentials
- `GOOGLE_CLIENT_SECRET`: From Google Cloud credentials
- `GOOGLE_ALBUM_URL`: Your Google Photos shared album URL

### 3. Connect Buffer Account

1. Go to https://buffer.com/app/instagram
2. Connect your Instagram account (if not already connected)
3. Get your Buffer API key from Settings → Developer
4. Add to `.env`

### 4. Local Testing

```bash
npm run dev
```

Visit: http://localhost:3000/health

Manually trigger a post:
```bash
curl -X POST http://localhost:3000/generate-post
```

### 5. Deploy to Railway.app

#### Step 1: Create Railway Account
- Go to https://railway.app
- Sign up with GitHub account
- Authorize Railway to access your repos

#### Step 2: Push Code to GitHub
```bash
git init
git add .
git commit -m "Initial commit: Stokeyhouse automation"
git branch -M main
git remote add origin https://github.com/yourusername/stokeyhouse-automation.git
git push -u origin main
```

#### Step 3: Connect to Railway
1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Choose your stokeyhouse-automation repo
5. Railway will automatically detect it's Node.js

#### Step 4: Add Environment Variables
1. Go to your Railway project
2. Click "Variables"
3. Add all variables from `.env`:
   - CLAUDE_API_KEY
   - BUFFER_API_KEY
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - GOOGLE_ALBUM_URL
   - NODE_ENV=production

#### Step 5: Deploy
1. Click "Deploy"
2. Wait for build to complete (2-3 mins)
3. Check logs for "Stokeyhouse automation running"

#### Step 6: Verify
- Railway will give you a public URL
- Visit `https://your-railway-url.railway.app/health`
- Should return `{"status":"ok",...}`

## How It Works

### Daily Flow
1. **17:45-18:15 UK time**: Scheduler triggers post generation
2. **Claude API**: Generates caption based on project context + previous post
3. **Buffer API**: Schedules to Instagram at the calculated time
4. **Database**: Saves post record for narrative continuity

### Narrative Continuity
Each post receives context about:
- Full project timeline (2025-2026)
- Key discoveries (floorboards, corbels, cornicing)
- Owners' story (married during buying, baby during reno)
- Previous post caption (to build on yesterday's narrative)

### Caption Tone
- Slightly catastrophic ("brutal," "shock," "nightmare")
- But believable and humble ("honestly," "small wins")
- British, conversational, genuine
- Reflects the emotional journey of a young couple building their dream home

## API Endpoints

### Health Check
```bash
GET /health
```

### Manual Post Generation
```bash
POST /generate-post
```
Response:
```json
{
  "success": true,
  "post": {
    "narrative_beat": "...",
    "caption": "...",
    "photo_guidance": "...",
    "posting_time": "18:03"
  }
}
```

## Troubleshooting

### Posts not generating
- Check Claude API key is valid
- Check Buffer API key is valid
- Check logs in Railway dashboard

### Posts not scheduling to Buffer
- Verify Instagram account is connected in Buffer
- Check Buffer API rate limits (100 posts/month free)

### Database errors
- Railway includes free SQLite support
- Database is persisted in `/data` directory

## Future Enhancements

- [ ] Integrate Google Photos API to fetch actual renovation photos
- [ ] Implement HB2 VSCO color grading on photos
- [ ] Add image analysis to pick best photo from album
- [ ] Track engagement metrics and optimize posting time
- [ ] Add web dashboard to view post history
- [ ] Implement photo caption suggestions based on visual analysis

## Support

For issues or questions about the automation, check the logs:
```bash
# In Railway dashboard, click "Logs" to see real-time output
```

## License

MIT
