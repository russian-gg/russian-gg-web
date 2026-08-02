# public/

Files served as-is from the site root. Nothing here is processed by Vite, so a missing file
is a 404 at runtime rather than a build error — which is deliberate for the avatar below.

## tutor-avatar.jpg

The face shown beside the AI tutor's messages in the mission player.

- **Path:** `public/tutor-avatar.jpg`
- **Shape:** square; it is rendered in a circle at 36px, so keep the face centred
- **Size:** 256×256, JPEG, ~23 KB. It is **not** worth shipping the full-resolution export:
  the source was 760×760 PNG at 736 KB for a 36px circle, which is 32× the bytes for no
  visible gain — and this audience is on mobile data. To replace it:

  ```bash
  sips -Z 256 source.png --out /tmp/a.png
  sips -s format jpeg -s formatOptions 82 /tmp/a.png --out public/tutor-avatar.jpg
  ```

- **Missing file is safe:** `TutorMark` in `src/routes/MissionPlayer.tsx` falls back to the
  abstract signal mark, so the lesson still renders. Keep the `.jpg` name, or update
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
