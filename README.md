# CanvasPro

CanvasPro is a productivity platform built for college students who want a faster, cleaner, and more organized way to manage their coursework. It brings assignments, courses, deadlines, and daily priorities into one streamlined experience.

## Features

- View Canvas courses and assignments
- Track upcoming and completed work
- Organize assignments by course and deadline
- Build a personalized daily plan
- Customize course names and preferences
- Sync supported data across devices
- Web and native iOS support

## Getting Started

1. Create a CanvasPro account.
2. Sign in to your school's Canvas website.
3. Go to **Account → Settings → Approved Integrations**.
4. Select **New Access Token** and generate a token.
5. Copy the token and enter it into CanvasPro.
6. CanvasPro will automatically load your supported Canvas courses and assignments.

> Never share your Canvas API token or publish it publicly.

## Local Development

```bash
git clone <repository-url>
cd canvaspro
npm install
npm run dev
```

Create your environment configuration and add the required Supabase and other service credentials before starting the application.

Never commit API keys, service-role keys, Stripe secrets, or other private credentials to GitHub.

## Tech

CanvasPro uses modern web technologies with Supabase for authentication, database functionality, and backend services. A native iOS version provides the same core CanvasPro experience for iPhone users.

## Disclaimer

CanvasPro is an independent product and is not affiliated with, endorsed by, or sponsored by Instructure, Inc. or Canvas LMS.

## Website

**https://canvaspro.app**
