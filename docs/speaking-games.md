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
- Russian speech recognition supports both standard and prefixed browser implementations. Final results are deduplicated by result index, while legitimate repeated spoken words remain in the transcript for scoring.
- An automatic recognizer restart preserves already spoken text. Ending a round waits briefly for the last final transcript. Leaving the route stops recognition and playback.
- Browsers without recognition offer explicitly labelled written practice. Browser recognition is not a pronunciation or acoustic-emotion measurement system.
- Prompt and feedback audio comes from the authenticated backend TTS endpoint, respecting the existing mute and playback-speed preferences.
- Each answer has a stable request ID. A failed submission retries that same answer rather than adding another result. A stale version refreshes server state. Actual evaluation failures remain errors, not fabricated grades.
- The session ID in the URL is a resume reference, not an authorization token. The backend checks ownership on every request.

## UI and content

Controls and explanations about using the UI are available in Uzbek, Russian and English. Russian exercises, character replies and correction explanations remain in Russian. Existing platform character artwork is reused; missing example GIF assets are replaced by local vector illustrations, with no external image dependency.

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
