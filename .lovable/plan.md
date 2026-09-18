# Mobile polish pass + traffic-light sidebar toggle

## What you'll see

### 1. Mac-style traffic-light sidebar control (phone + web)
A small frosted pill with the three red/yellow/green dots from your reference image, sitting at the top right of the sidebar panel on desktop, and in the mobile top bar on phones. Each dot does something:

- **Red** — fully closes the sidebar; a tiny floating pill with the three dots stays in the corner so you can always bring it back.
- **Yellow** — middle state: collapses the sidebar to a slim rail (narrow strip showing just a colored dot or first letter per page/class), keeping one-tap navigation while freeing screen space.
- **Green** — expands back to the full sidebar.

Everything animates smoothly: the sidebar width and the main content's offset transition together (~300ms ease), so content slides rather than jumps. The chosen state is remembered across page loads and devices.

On phones, tapping a dot opens/closes the drop-down menu with the same smooth expand/collapse animation (instead of the menu appearing instantly as it does today). The existing hamburger button is replaced by the traffic-light pill so there's one consistent control.

### 2. Mobile breathing-room and overlap audit
I'll drive the app at phone size with a browser script, screenshot every page (Dashboard, Focus, Calendar, Class Schedule, Grades, Assignments, Announcements, class detail pages, Notifications, Billing, Settings), and fix whatever I find:

- **Nothing escapes the screen** — every card, grid, and header constrained so nothing overflows or clips; long class names and headings truncate instead of pushing widgets off-screen.
- **More breathing space** — slightly smaller text, tighter but consistent card padding, and even gaps between widgets on small screens, so pages feel airy instead of cramped.
- **Headers that behave** — page title rows wrap cleanly and never collide with buttons/badges next to them.
- **The weekly schedule grid** gets special attention since it was the last place times misaligned.
- Touch targets stay at least ~44px so nothing becomes harder to tap.

You'll be able to flip the preview to the phone view with the device button above it to check each page.

## Technical details

- New `sidebar-state` hook (mode: `full | rail | hidden`, persisted per account in localStorage via the existing scoped storage), shared between `AppSidebar`, `MobileNav`, and the `_authenticated` layout so the main content margin animates in sync.
- New `TrafficLights` component: frosted glass pill, three colored dots with the × / − / + glyphs visible on hover (like macOS), press animation, aria-labels for accessibility.
- Desktop layout switches from a fixed `md:pl-64` to a mode-aware padding with `transition-[padding,width]`.
- Mobile menu panel gets a height/opacity transition instead of conditional mount/unmount.
- No new dependencies; no changes to Canvas data fetching, auth, or billing.
