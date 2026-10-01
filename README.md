# CanvasPro

CanvasPro is a productivity platform built for college students who want a faster, cleaner, and more organized way to manage their coursework. It brings assignments, classes, deadlines, and daily priorities into one streamlined experience so students can spend less time navigating between pages and more time getting work done.

CanvasPro integrates with Canvas LMS and is designed to provide a more focused student experience across web and iOS. The platform emphasizes speed, simplicity, clean design, and practical tools that help students understand what they need to complete next.

## Features

- View Canvas courses and assignments in one place
- Track completed and upcoming assignments
- Organize coursework by class and deadline
- Create a personalized daily plan
- Identify what assignment should be worked on next
- Customize class names and preferences
- Sync supported account data across devices
- Access CanvasPro through both web and iOS
- Manage account and subscription settings
- Clean, responsive interface designed specifically for students

## Getting Started

### 1. Create an Account

Open CanvasPro and create an account using your email address.

During setup, you may be asked to provide basic profile information such as:

- First name
- Last name
- Graduation year
- Major

### 2. Connect Canvas

CanvasPro connects to Canvas LMS using your personal Canvas API access token.

To connect your account:

1. Sign in to your school's Canvas website.
2. Open **Account**.
3. Select **Settings**.
4. Scroll to **Approved Integrations**.
5. Select **New Access Token**.
6. Create a token for CanvasPro.
7. Copy the generated token.
8. Return to CanvasPro.
9. Paste the token into the Canvas connection field.
10. Save your settings.

CanvasPro will then use the connection to retrieve supported course and assignment information from your Canvas account.

> Keep your Canvas API token private. Do not post it publicly, commit it to GitHub, or share it with other users.

## Local Development

### Requirements

Before running CanvasPro locally, make sure you have:

- Node.js
- npm
- Git
- A Supabase project
- Required environment variables
- Access to the Canvas LMS API

### Clone the Repository

```bash
git clone <repository-url>
cd canvaspro
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create the appropriate environment configuration file for your development environment.

Example:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Additional environment variables may be required depending on the features you are working with.

Do not commit production secrets, private API keys, Stripe secret keys, service-role keys, or user credentials to the repository.

### Start the Development Server

```bash
npm run dev
```

The development server will provide a local URL that you can open in your browser.

### Production Build

To create a production build:

```bash
npm run build
```

## Project Structure

The project is separated into web, backend, and platform-specific functionality.

Major areas include:

- Authentication
- Canvas API integration
- Dashboard
- Assignments
- Courses
- Daily productivity tools
- User profile and settings
- Subscription management
- Supabase backend services
- iOS application

## Backend

CanvasPro uses Supabase for backend functionality including authentication, database storage, and server-side operations.

Sensitive operations should always be validated server-side rather than relying on values supplied directly by the client.

## iOS

CanvasPro also includes a native iOS experience designed to provide the same core functionality as the web application while following native iOS interface conventions.

The web and iOS versions should remain functionally aligned so users do not receive significantly different feature sets depending on the platform they use.

## Security

When contributing to CanvasPro:

- Never commit API tokens
- Never expose Supabase service-role keys
- Never expose Stripe secret keys
- Do not store user passwords manually
- Validate privileged operations on the server
- Keep production and development environments separated
- Review authentication and authorization before deploying backend changes

If credentials are accidentally committed, revoke and rotate them immediately.

## Contributing

When making changes:

1. Create or switch to the appropriate development branch.
2. Pull the latest changes.
3. Install dependencies if necessary.
4. Make your changes.
5. Test the affected functionality.
6. Verify that no credentials or private data are included.
7. Commit the changes with a clear commit message.
8. Push the branch.
9. Open a pull request when appropriate.

Example:

```bash
git checkout -b feature/example-feature
git add .
git commit -m "Add example feature"
git push origin feature/example-feature
```

## Disclaimer

CanvasPro is an independent product and is not affiliated with, endorsed by, sponsored by, or officially associated with Instructure, Inc. or Canvas LMS.

Canvas and Canvas LMS are trademarks of their respective owners.

## Website

**[https://canvaspro.app](https://canvaspro.app)**
