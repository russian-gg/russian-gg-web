# Speaking games

The `games` branch adds four voice-first games without replacing Arra or Rod Runner. The server owns availability, lesson prerequisites, question selection, deadlines, scoring and saved results. The existing admin Games screen controls each new game's enabled switch.

| Route | Game | Session |
| --- | --- | --- |
| `/games/tez-gapir` | Speak fast | 3-5 rounds, 30 seconds each; 34 source topics |
| `/games/error-hunt` | Error hunter | 10 sentences, 10 seconds each; 105 source sentences |
| `/games/first-reaction` | First reaction | 7 situations, 5 seconds each; 60 source situations |
| `/games/ice-mystery` | Mystery of the ice city | 5 locations, up to 10 questions per location, 5 clues and a spoken accusation |

## Running together

Use the `games` branch of both the frontend and backend. Apply all three new backend speaking-game migrations through the existing deployment/database workflow before using the new endpoints. No production database has been migrated by these changes. The backend API document also records a pre-existing `GoogleSubject` migration-history gap that must be checked separately when bootstrapping a completely new database.

Enable the required games in the existing admin Games screen. All new switches start off. The learner must also satisfy the lesson prerequisites returned by the backend. The new route remains subject to the existing authentication and phone-verification gate.

The frontend uses `/api/speaking-games`. See `docs/speaking-games-api.md` in the backend repository for request and response contracts. Use the normal local API proxy configuration; do not put provider secrets in frontend environment variables.

## Voice and recovery

- Microphone permission and recognition startup happen before the server starts the round clock.
- Only these games use the isolated `GameSpeech` adapter. Existing lesson voice code is unchanged.
- Russian speech recognition supports both standard and prefixed browser implementations. Final results are deduplicated by result index. Android final hypotheses with zero or missing confidence replace provisional text instead of accumulating as spoken words; confirmed repetitions at distinct result indices are preserved.
- An automatic recognizer restart preserves already spoken text. Ending a round waits briefly for the last final transcript. Leaving the route stops recognition and playback.
- Tez gapir and Error hunt stop microphone capture at their 30-second and 10-second deadlines, then wait up to 5 seconds for the recognizer to finalize audio already captured. Their server allows 15 seconds after the deadline for finalization and transport; other games keep their existing timing. Recognized, relevant words earn credit even after initial silence or in the last second.
- Browsers without recognition offer explicitly labelled written practice. Browser recognition is not a pronunciation or acoustic-emotion measurement system.
- Prompt and feedback audio comes from the authenticated backend TTS endpoint, respecting the existing mute and playback-speed preferences.
- Each answer has a stable request ID. A failed submission retries that same answer rather than adding another result. A stale version refreshes server state. Actual evaluation failures remain errors, not fabricated grades.
- The session ID in the URL is a resume reference, not an authorization token. The backend checks ownership on every request.

## UI and content

Tez gapir setup asks for a companion, level and round count, not a topic. The server shuffles distinct topics from the chosen level and reveals each one when that round begins. Resuming an unfinished session preserves its existing topic plan, level, companion and round count rather than drawing a new plan.

Controls and explanations about using the UI are available in Uzbek, Russian and English. Exercises and quoted corrections remain in Russian. Tez gapir and Error hunt give feedback prose and companion replies in Uzbek, regardless of UI language; the other games retain Russian replies. Both use the dedicated arcade companion artwork in `public/games/characters`; other games and lesson/landing artwork continue using the original `public/characters` images. Missing example GIF assets are replaced by local vector illustrations, with no external image dependency. See `game-companion-assets.md` for generation prompts.

Tez gapir and Error hunt feedback and saved round reviews show the recognized answer and actual language corrections, without word/criterion point badges or scoring explanations. The total score and leaderboard remain. Both use the same scoring: one point per distinct accepted word/phrase, plus two per distinct accepted complete sentence. Repeated or unclassified text earns zero, with no penalties. Error hunt has no speed or rule-explanation point bonus; zero-point achievement metadata is preserved. Its setup rules describe how to correct sentences or identify sentences without errors, without timing or point arithmetic. Old Tez rule-only feedback is labelled as lacking a detailed language review rather than inventing corrections. Recognition supplies text only, so the feedback does not claim pronunciation was evaluated.

Weekly/all-time leaderboards, best scores, once-only achievements, daily challenges and game-city rewards are available within the games. Multiplayer invitations, seasonal case packs and alternative detective scenarios were ideas in the document rather than supplied playable content; this implementation uses the supplied missing-fish case.

## Validation

```sh
npm run typecheck
npm run build
npm run build:admin
node scripts/test-game-speech.cjs
npm run dev -- --host 127.0.0.1 --port 5181 --strictPort
# In another terminal, while the local dev server is running:
node scripts/test-speaking-games.cjs
```

Browser regression coverage is in `scripts/test-speaking-games.cjs`. It uses a local Vite server, mocked API responses and a simulated microphone, not production accounts or billable AI calls. Real microphone/browser permission behavior and the configured live Gemini provider still require device and deployment-environment smoke tests.

The existing workflows deploy `main`, `staging` and `demostage`; this change does not add a production deployment trigger for `games`.
