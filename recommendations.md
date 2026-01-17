# UI/UX Upgrade Recommendations

This document outlines 50 meticulous recommendations to align the app with the new Teal/Slate branding, improve typography consistency, and significantly enhance the mobile user experience.

## Global Branding & Theme (Teal & Slate)
1.  **Primary Accent:** Replace all instances of `amber-500` (Orange) with `teal-500` as the primary action color to match the landing page.
2.  **Secondary Accent:** Use `slate-900` (Dark) for strong contrast elements instead of lighter greys or secondary oranges.
3.  **Backgrounds:** Shift from warm/orange-tinted backgrounds (e.g., `bg-amber-50`) to cool/neutral backgrounds (`bg-slate-50`, `bg-teal-50`) for a modern, professional feel.
4.  **Buttons:** Standardize primary buttons to `bg-slate-900 text-white` (Professional) or `bg-teal-500 text-white` (Call to Action), replacing inconsistent Orange/Blue buttons.
5.  **Borders:** Change focus states from `focus:border-amber-400` to `focus:border-teal-400` globally.
6.  **Success States:** Ensure success messages/icons use `emerald-500` or `teal-600` consistently, rather than mixing greens.
7.  **Warning States:** Reserve `amber` *only* for warnings (not branding), distinct from the primary brand color.
8.  **Gradients:** Remove any orange-to-yellow gradients; replace with subtle Slate-to-Teal or pure flat colors for a cleaner look.
9.  **Selection Highlights:** Update `::selection` CSS to use a Teal tint instead of default or orange.
10. **Shadows:** Use cool-toned shadows (`shadow-slate-200`) instead of warm ones.

## Typography & Hierarchy
11. **Page Titles:** Standardize all page titles (e.g., "Job Packs", "Invoices") to `text-2xl md:text-4xl font-black text-slate-900 tracking-tight` (matching the Home page style).
12. **Section Headings:** Enforce `text-lg font-black uppercase tracking-widest text-slate-500` for all subsection headers.
13. **Card Titles:** Standardize card titles to `text-base font-bold text-slate-900`.
14. **Label Text:** Increase all form labels from `text-[10px]` to `text-xs (12px)` font-bold uppercase for better readability.
15. **Input Text:** Set global input text size to `text-base (16px)` to prevent iOS zoom and improve readability.
16. **Font Weight:** maintain `font-black` for headers but ensure body text is `font-medium` or `font-normal` for contrast.
17. **Line Height:** Increase line height in descriptions and notes to `leading-relaxed` for better readability on mobile.
18. **Truncation:** Review all `truncate` classes on mobile; replace with multi-line clamping (`line-clamp-2`) where context is lost.

## Mobile Experience & Usability
19. **Touch Targets:** Enforce a minimum height of **44px** for all buttons, inputs, and clickable icons.
20. **Input Padding:** Increase vertical padding in inputs (`py-3` or `py-4`) to make them "chunkier" and easier to tap.
21. **Spacing:** Increase whitespace between form groups (`space-y-6` instead of `space-y-4`) to reduce visual clutter.
22. **Full Width:** On mobile (`<md`), force all inputs and buttons to `w-full` (100% width) to avoid cramped layouts.
23. **Modals:** Ensure all modals have a close button that is large and easily accessible (top right, min 44px).
24. **Bottom Sheet:** Convert center-modals to bottom-sheet drawers on mobile for better ergonomic reach.
25. **Keyboard:** Ensure appropriate `inputMode` (numeric, email, tel) is set for all relevant inputs to trigger the correct mobile keyboard.
26. **Safe Areas:** Verify `safe-area-inset-bottom` is respected in the mobile navigation bar and fixed action buttons.
27. **Sticky Headers:** Implement sticky headers for long lists (e.g., Invoices) so context is not lost while scrolling.
28. **Haptics:** Ensure `hapticTap` is triggered on all significant interactions (saving, deleting, navigating).

## Component Specifics: Home / Dashboard
29. **Daily Brief:** Update "Daily Brief" text color to `text-slate-900` (remove any orange).
30. **Quick Actions:** Redesign "Quick Actions" grid. Use `slate-100` backgrounds with `teal-600` icons, or solid `teal-500` buttons. Remove the rainbow effect if it clashes with the strictly professional brand.
31. **Next Job Card:** Change the "Next Job" card border from `border-amber-600` to `border-teal-500`.
32. **Stats Overview:** Update financial stats icons to use the Teal/Slate palette.
33. **Search Bar:** Make the search bar on Home larger and more prominent (`h-12` or `h-14`).

## Component Specifics: Quote & Invoice Creator
34. **Form Layout:** Switch from 2-column grid to 1-column stack on mobile for "Client", "Date", and "Project" fields.
35. **Add Items:** Make the "Add Item" button full-width, large, and distinct (`bg-slate-100` or `dashed border`).
36. **Section Headers:** Increase size of "Work Section" headers; make them collapsible to save screen space.
37. **Price Inputs:** alignment of price inputs should be clear; add explicit "£" prefix visual inside the input box.
38. **Discount/Tax:** Move these to a dedicated "Summary" card at the bottom rather than hidden fields.
39. **Save Bar:** Ensure the sticky "Save" bar at the bottom has a high z-index and stands out from the content.
40. **Client Picker:** Improve the client dropdown to be a full-screen selection list on mobile.

## Component Specifics: Lists (Job Packs, Invoices)
41. **Card Styling:** Update list cards to have `rounded-2xl` or `rounded-3xl` with `border-slate-200`. Remove orange hover borders.
42. **Status Badges:** Standardize status badges (Paid, Pending, Active) to use consistent colors (e.g., Green for Paid, Slate for Draft, Teal for Sent).
43. **Empty States:** Improve "No items found" states with larger icons and clear "Create New" CTAs.
44. **Filters:** If filters exist, ensure they are horizontally scrollable chips (large targets) rather than small dropdowns.

## Navigation & Layout
45. **Sidebar (Desktop):** Ensure the "TradeSync" logo text uses the new Teal accent (`text-teal-500`).
46. **Active State:** Sidebar items should highlight with `bg-teal-500/10 text-teal-500` or `bg-teal-500 text-white`.
47. **Mobile Bottom Bar:** Increase height to **60px** + safe area.
48. **Mobile Icons:** Ensure active tab icons in the bottom bar are filled/bold and use `text-teal-500`.
49. **Profile:** Update the user profile section in the sidebar to match the slate/teal theme.
50. **Global Font:** Verify the font family is consistent (likely Inter or similar sans-serif) and legible at all weights.
