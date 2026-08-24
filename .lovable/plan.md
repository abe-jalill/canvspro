# Tighten hero card padding and typography on small screens

## Current state

`src/components/dashboard-hero.tsx` uses the following responsive rules today:

- Card padding: `p-6 sm:p-8 md:p-10`
- Greeting: `text-[1.75rem] sm:text-4xl`
- Summary text: `text-sm sm:text-base`
- "Next up" text: `text-sm sm:text-base`
- Divider margin: `mt-7`
- Bottom section margin: `mt-5`

At 375px the card is readable but slightly heavy — the 28px greeting and 24px padding consume a lot of the narrow viewport and push the bottom action below the fold.

## Proposed change

1. **Smaller mobile padding.**
   - Change `p-6 sm:p-8 md:p-10` to `p-5 sm:p-8 md:p-10`.
   - This gives 20px internal padding on phones and restores the roomier feel at 640px+.

2. **Slightly smaller mobile greeting.**
   - Change `text-[1.75rem] sm:text-4xl` to `text-[1.5rem] sm:text-[1.75rem] md:text-4xl`.
   - 24px on phones keeps the headline prominent without crowding the card.

3. **Tighter vertical rhythm on mobile only.**
   - Change the divider from `mt-7` to `mt-6 sm:mt-7`.
   - Change the bottom section from `mt-5` to `mt-4 sm:mt-5`.
   - These small gains keep the card compact on short screens.

4. **Preserve existing "See more" sizing.**
   - The button already has a 44px min-height target, so no change is needed there.
   - Keep the `sm:self-auto` horizontal alignment on larger screens and the stacked mobile layout.

5. **Verify across breakpoints.**
   - Capture screenshots at 375px and 766px (the current preview viewport) after the edit.
   - Confirm nothing overflows, text remains readable, and the card does not feel cramped.

## Out of scope

- No changes to data fetching, logic, or color.
- No changes to the desktop layout beyond the graduation in greeting size.
