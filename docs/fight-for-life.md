# Помоги!

Route: `/games/fight-for-life`. The game uses the existing signed-in learner shell, game catalogue, and Gemini Live audio client. The server must contain the matching `FightForLife` module before an administrator enables the catalogue entry.

The catalogue entry is **disabled by default**. Enable `fight-for-life` in the existing admin Games screen. No seed or migration enables it. The shelf only renders enabled catalogue entries; a direct link to a disabled game displays its disabled state and cannot start microphone capture.

The supplied DeepSeek specification’s later rule replaces the numerical timer ring with the character’s aura. Ten consecutive seconds of silence end the round; surviving two minutes wins. Each full second of learner speech earns one crystal. Actual companion audio pauses silence, for at most eight consecutive seconds. The voice prompt asks for replies under twelve words / approximately four seconds. No grammar penalties are applied.

The browser uses the existing adaptive microphone RMS detector. Voice detection measures sound activity, not the semantic correctness of spoken Russian. The server checks ownership, state transitions, idempotency, elapsed time, score bounds, feature availability, and voice allowance. Results are unranked and grant no city or leaderboard rewards, because raw audio travels directly to Gemini.

The server catalogue supplies all 45 topics from the written request and linked concept. The first 30 retain the requested order; the additional 15 follow them. A1/A2 use the introductory group and B1 the intermediate group. Debate and monologue have distinct server-authored conversation instructions.

## Characters

Final assets are in `public/games/fight-for-life/characters/`. Existing character and Tez Gapir assets are unchanged.

| Character | Costume | Four poses |
| --- | --- | --- |
| Penguin | Familiar glasses and blue headset, black RGG turtleneck, leather boots, wristwatch | Crossed arms; lifts headset and gestures; checks watch; shivers with frost |
| Panda | Familiar pink bow and headset, pink hoodie with ears, tea mug, teal cushion | Calm; delighted with raised mug; worried; sleepy with cold tea |
| Pero | Familiar golden feather, round glasses, gloves, blue sneakers and headset | Crossed arms; animated magical gesture; yawns; droops on the ground |

These are transparent **3D-rendered raster illustrations**, animated with pose crossfades, breathing/floating transforms, sound-driven aura and equalizers, steam, particles, and frost. They are not rigged 3D meshes or Spine skeletons. Reduced-motion preferences disable decorative movement while retaining state changes.

`*-poses.webp` are equal 2×2 atlases: idle, speaking, worried, cold in reading order. Base portraits are 640×640; atlases are 1280×1280. Runtime WebP conversion uses Sharp, quality 90, alpha quality 100, contain fit with transparency.

## Image generation prompts

Mode: built-in image generation/editing, with the existing project character image supplied as an identity reference. Transparent output requested for every asset. Costume-only base edits were followed by four-pose atlas edits using each new base portrait.

Penguin base prompt: Preserve exactly the reference penguin’s identity, glasses, beak, black-and-white feathers and blue hemisphere headset. Replace only the sports outfit with a textured black turtleneck bearing the small white RGG logo, leather boots and wristwatch. Relaxed crossed flippers, confident expression, full body, premium 3D cartoon rendering, transparent background.

Panda base prompt: Preserve exactly the reference panda’s face, black-and-white fur, pink bow and headset. Dress her in an oversized cozy pink hoodie with ears. Seat her on a teal cushion holding a tea mug. Warm expression, detailed fur and fabric, full body, transparent background.

Pero base prompt: Preserve exactly the reference golden feather’s silhouette, face, gloves, blue sneakers and headset. Add stylish round glasses. Floating with folded arms, confident playful expression, polished gold, full body, transparent background.

Atlas prompt family: Use the new base image as the identity/costume reference. Create four independent full-body poses in an equal 2×2 square grid, consistent camera and scale, transparent background, no text or panel labels. Penguin: relaxed, speaking enthusiastically with lifted headset, worried checking watch with red headset light, cold and shivering. Panda: calm holding tea, happy raising tea/waving, worried clutching cold tea, sleepy. Pero: folded arms floating, lively magical gesture, tired yawn, drooping on the floor. Keep original identities and costumes in every cell.

Panda atlas cleanup prompt: Keep exactly the same four identities, costumes, bows, headsets, hoodies, cushions, mugs, expressions and poses. Correct only the atlas layout: four equal quadrants, full characters centered inside each quadrant, at most 76% width/height, at least 12% fully transparent padding on all sides. Nothing crosses center lines; no fragments from adjacent poses; clean transparent gutters, no speckles, text or lines.

## Validation

Start Vite with `npm run dev -- --host 127.0.0.1 --port 5181 --strictPort`, then run:

```text
node --test scripts/test-fight-for-life.cjs
npm run typecheck
npm run build
npm run build:admin
```

The browser test uses local API and voice mocks, blocks external network calls, and saves screenshots under the printed temporary directory. It never enables a production game or spends real provider credits.

| Requirement | Evidence |
| --- | --- |
| Ten-second silence, two-minute cap, fractional speech and NPC pause | Pure `LifeMeter` cases and corresponding server tests |
| Disabled by default and direct-link protection | Browser test plus real HTTP and service tests |
| Three characters and four poses | 390px mobile screenshots for speech, cold and results; desktop setup screenshot |
| Topics, levels, modes and locales | Browser selections and server catalogue test |
| Failure and cleanup | Microphone denial, dropped socket, pending heartbeat stop, navigation and BFCache restoration |
| Shared app compatibility | Scoped ESLint, learner/admin builds, existing voice and speaking-game server regressions |

Real Gemini WebSocket/audio quality and physical iOS/Android microphones require a configured provider and device smoke test. The automated browser checks simulate those events.
