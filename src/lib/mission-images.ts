/**
 * One illustration per mission, keyed by the mission's published slug.
 *
 * Keyed by slug rather than id because a mission's id changes with every new version of it,
 * and the slug does not. Nothing here says anything about the mission's state: the picture is
 * the place, whether the learner has been there or not.
 *
 * Every mission has a file name here, whether or not the file has been delivered yet. The files
 * live in `public/images/missions/` (see `public/README.md`); until one arrives, the panel keeps
 * showing the stand-in street scene it draws under every picture, so a missing file never shows
 * as a broken image.
 */
const MISSION_IMAGES: Record<string, string> = {
  'mission-01-meet-neighbour': 'neighbor-introduction',
  'mission-02-ask-the-way': 'ask-the-way',
  'mission-03-buy-bread': 'bakery',
  'mission-04-order-tea': 'cafe',
  'mission-05-call-a-friend': 'call-a-friend',
  'mission-06-my-profession': 'my-profession',
  'mission-07-buy-clothes': 'clothing-store',
  'mission-08-doctor-appointment': 'doctor-appointment',
  'mission-09-bus-ticket': 'bus-ticket',
  'mission-10-order-taxi': 'taxi',
  'mission-11-hairdresser': 'hairdresser',
  'mission-12-fitness-club': 'fitness-club',
  'mission-13-enrol-on-course': 'course-enrolment',
  'mission-14-job-interview': 'job-interview',
  'mission-15-rent-a-flat': 'rent-a-flat',
  'mission-16-buy-groceries': 'grocery-store',
  'mission-17-order-pizza': 'pizza-order',
  'mission-18-pharmacy': 'pharmacy',
  'mission-19-bank': 'bank',
  'mission-20-post-office': 'post-office',
  'mission-21-cinema': 'cinema',
  'mission-22-restaurant': 'restaurant',
  'mission-23-petrol-station': 'petrol-station',
  'mission-24-hotel': 'hotel',
  'mission-25-doctor-home-visit': 'doctor-home-visit',
  'mission-26-train-ticket': 'train-ticket',
  'mission-27-plane-ticket': 'plane-ticket',
  'mission-28-library': 'library',
  'mission-29-stadium': 'stadium',
  'mission-30-museum': 'museum',
  'mission-31-utility-bills': 'utility-bills',
  'mission-32-dentist': 'dentist',
  'mission-33-prescription-medicine': 'prescription-medicine',
  'mission-34-dry-cleaner': 'dry-cleaner',
  'mission-35-repair-shop': 'repair-shop',
  'mission-36-food-delivery': 'food-delivery',
  'mission-37-pet-shop': 'pet-shop',
  'mission-38-market': 'market',
  'mission-39-flower-shop': 'flower-shop',
  'mission-40-manicure': 'manicure',
}

/** Width and height every illustration is exported at; the panel reserves this shape. */
export const MISSION_IMAGE_SIZE = { width: 960, height: 720 } as const

export function missionImage(slug: string): string | undefined {
  const name = MISSION_IMAGES[slug]
  return name ? `/images/missions/${name}.webp` : undefined
}
