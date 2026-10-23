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

## images/missions/

One illustration per mission, shown in the selected mission's panel on the Missions tab.

- **Path:** `public/images/missions/<name>.webp`. The name is mapped to a mission's *slug* in
  `src/lib/mission-images.ts`; add a line there for each new picture. Never key a picture by
  mission id — the id changes with every new version of a mission, the slug does not.
- **Mapped (all 40 missions):** `neighbor-introduction`, `ask-the-way`, `bakery`, `cafe`, `call-a-friend`, `my-profession`, `clothing-store`, `doctor-appointment`, `bus-ticket`, `taxi`, `hairdresser`, `fitness-club`, `course-enrolment`, `job-interview`, `rent-a-flat`, `grocery-store`, `pizza-order`, `pharmacy`, `bank`, `post-office`, `cinema`, `restaurant`, `petrol-station`, `hotel`, `doctor-home-visit`, `train-ticket`, `plane-ticket`, `library`, `stadium`, `museum`, `utility-bills`, `dentist`, `prescription-medicine`, `dry-cleaner`, `repair-shop`, `food-delivery`, `pet-shop`, `market`, `flower-shop`, `manicure`.
- **Shape:** 4:3, exported at 960×720 or larger; the optimiser caps the longest edge at 960px.
  One separate image per mission — never a collage cropped into scenes.
- **Style:** the same 3D-cartoon look for all of them, soft light, one clear subject, simple
  background, and no text, numbers, logos or UI in the picture.
- **Missing file is safe:** the panel always draws a small street of the mission's part of
  town (`ZoneScene`) with the mission's marker on it, and the picture fades in over it once it
  has loaded. A file that is missing or fails never shows as a broken image.
- **Still needed:** all 40 pictures; none has been delivered yet.

The town behind the mission road is `src/assets/images/missionBg.webp` (built by Vite, not
served from here). The stand-in scene's pieces are SVG, in
`src/components/missions/scenery.tsx`.

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
