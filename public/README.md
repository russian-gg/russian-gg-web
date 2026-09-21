# public/

Files served as-is from the site root. Nothing here is processed by Vite, so a missing file
is a 404 at runtime rather than a build error — which is deliberate for the avatar below.

Because Vite does not touch it, nothing here is optimised by the build either. Drop new
artwork or a new recording in at whatever size it was exported, then run:

```bash
node scripts/optimize-assets.mjs           # write .webp / .opus / .mp3 beside the sources
node scripts/optimize-assets.mjs --prune   # …and remove the sources afterwards
```

The per-directory size caps and the reasoning behind each live at the top of that script. The
icons are skipped on purpose: installers and crawlers read them, and several still do not
accept WebP.

## tutor-avatar.webp

The face shown beside the AI tutor's messages in the mission player.

- **Path:** `public/tutor-avatar.webp`
- **Shape:** square; it is rendered in a circle at 36px, so keep the face centred
- **Size:** 192×192, WebP, ~4 KB. It is **not** worth shipping the full-resolution export:
  the delivered file was 740×740 at 91 KB for a 36px circle, which is twenty times the bytes
  for no visible gain — and this audience is on mobile data. To replace it, drop the new
  export in as `tutor-avatar.jpg` or `.png` and run the optimiser above; the rule for this
  file resizes it to 192px and re-encodes it.
- **Missing file is safe:** `TutorMark` in `src/routes/MissionPlayer.tsx` falls back to the
  abstract signal mark, so the lesson still renders. Keep the `.webp` name, or update
  `TUTOR_AVATAR_SRC` alongside it.

### Before shipping a real person's photo

This is not a styling question, so it is written down rather than left to memory:

1. **Rights.** The image must be one the project is licensed to use *as a product persona*.
   Many stock licences allow editorial or decorative use but forbid presenting the person as
   endorsing, or being, a service. A model release covering this use is required.
2. **Consent.** If it is a real, identifiable individual, they must have agreed to their face
   being the identity of an AI tutor — not merely to the photo being taken.
3. **Never imply a human.** The alt text stays "AI repetitor" and the AI's feedback keeps its
   "Bu AI izohi, rasmiy baholash emas" line. The product must not let a learner believe a
   person is listening to them.

If any of the three is unsettled, prefer a commissioned illustration or the abstract mark:
both avoid the question entirely.
