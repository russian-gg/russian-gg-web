/**
 * Screens where the learner is in the middle of something: a lesson, a conversation, a game,
 * a test, the level test. Dialogs that ask for attention — the welcome gift, the lesson
 * check-in, the phone prompt — wait until they come out, and land on the result instead.
 */
export function isBusyPath(pathname: string) {
  if (pathname.startsWith('/missions/')) return !pathname.endsWith('/result')
  if (pathname.startsWith('/tests/blocks/')) return !pathname.endsWith('/review')
  return ['/lessons/', '/games/', '/onboarding'].some((prefix) => pathname.startsWith(prefix))
}
