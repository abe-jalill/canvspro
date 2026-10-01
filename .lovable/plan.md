# Settings section pages

## What will change
- Turn `/settings` into a short overview containing one clear row for each settings area.
- Each row opens a dedicated page with the full controls and a visible **Back to Settings** link.
- Split the current controls into these pages: Appearance, Profile, Canvas connection, Notifications, Announcements, Class settings, AI assistant, and Account.
- Preserve every existing save, validation, loading, class rename/show-hide, notification, and account-deletion behavior.
- Keep the existing Settings item in the main menu active throughout all settings pages, and update profile/Canvas links to open the correct detail page directly.

## Technical details
- Promote `settings.tsx` to a layout route that renders an outlet.
- Move the overview to `settings.index.tsx` and add one typed child route per section.
- Extract the existing settings forms into reusable section components so behavior is not duplicated.
- Give every new page unique title, description, Open Graph, and Twitter metadata.

## Verification
- Check every overview row opens the correct page and Back returns to all settings.
- Verify the profile shortcut opens Profile and Canvas warnings open Canvas connection.
- Test desktop and phone layouts, browser back navigation, all controls, and the production build.
