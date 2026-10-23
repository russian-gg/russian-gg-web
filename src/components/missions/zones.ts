import {
  Apple,
  Briefcase,
  Bus,
  CarTaxiFront,
  Cat,
  Clapperboard,
  Coffee,
  ConciergeBell,
  Croissant,
  Dumbbell,
  Flower2,
  Fuel,
  GraduationCap,
  HeartPulse,
  House,
  KeyRound,
  Landmark,
  Library,
  Mail,
  Palette,
  PhoneCall,
  Pill,
  Pizza,
  Plane,
  Receipt,
  Scissors,
  Shirt,
  ShoppingBasket,
  Signpost,
  Smile,
  Sparkles,
  Stethoscope,
  Store,
  Syringe,
  TrainFront,
  Trophy,
  Truck,
  Users,
  UtensilsCrossed,
  WashingMachine,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { MissionSummary, MissionTopic } from '../../lib/types'

/**
 * The parts of town the road passes through. Purely how the map is drawn: a zone is read off
 * the mission's own topic, and it never moves, opens or closes a mission.
 */
export type MissionZone = 'neighborhood' | 'shopping' | 'dining' | 'transport' | 'health' | 'city'

const ZONE_BY_TOPIC: Record<MissionTopic, MissionZone> = {
  Introductions: 'neighborhood',
  PhoneCall: 'neighborhood',
  Housing: 'neighborhood',
  Celebrations: 'neighborhood',
  Shopping: 'shopping',
  CafeRestaurant: 'dining',
  Delivery: 'dining',
  Taxi: 'transport',
  Directions: 'transport',
  Hotel: 'transport',
  Pharmacy: 'health',
  Doctor: 'health',
  Gym: 'health',
  Bank: 'city',
  WorkAndProfession: 'city',
  Unset: 'city',
}

export function zoneOf(mission: Pick<MissionSummary, 'topic'>): MissionZone {
  return ZONE_BY_TOPIC[mission.topic] ?? 'city'
}

/** What each zone is when a mission has no picture of its own. */
export const ZONE_ICON: Record<MissionZone, LucideIcon> = {
  neighborhood: House,
  shopping: Store,
  dining: UtensilsCrossed,
  transport: Bus,
  health: Stethoscope,
  city: Landmark,
}

/**
 * One small marker per mission, keyed by its published slug — the place in a glance, beside
 * the node. A mission missing here falls back to its zone's marker.
 */
const MISSION_ICON: Record<string, LucideIcon> = {
  'mission-01-meet-neighbour': House,
  'mission-02-ask-the-way': Signpost,
  'mission-03-buy-bread': Croissant,
  'mission-04-order-tea': Coffee,
  'mission-05-call-a-friend': PhoneCall,
  'mission-06-my-profession': Briefcase,
  'mission-07-buy-clothes': Shirt,
  'mission-08-doctor-appointment': Stethoscope,
  'mission-09-bus-ticket': Bus,
  'mission-10-order-taxi': CarTaxiFront,
  'mission-11-hairdresser': Scissors,
  'mission-12-fitness-club': Dumbbell,
  'mission-13-enrol-on-course': GraduationCap,
  'mission-14-job-interview': Users,
  'mission-15-rent-a-flat': KeyRound,
  'mission-16-buy-groceries': ShoppingBasket,
  'mission-17-order-pizza': Pizza,
  'mission-18-pharmacy': Pill,
  'mission-19-bank': Landmark,
  'mission-20-post-office': Mail,
  'mission-21-cinema': Clapperboard,
  'mission-22-restaurant': UtensilsCrossed,
  'mission-23-petrol-station': Fuel,
  'mission-24-hotel': ConciergeBell,
  'mission-25-doctor-home-visit': HeartPulse,
  'mission-26-train-ticket': TrainFront,
  'mission-27-plane-ticket': Plane,
  'mission-28-library': Library,
  'mission-29-stadium': Trophy,
  'mission-30-museum': Palette,
  'mission-31-utility-bills': Receipt,
  'mission-32-dentist': Smile,
  'mission-33-prescription-medicine': Syringe,
  'mission-34-dry-cleaner': WashingMachine,
  'mission-35-repair-shop': Wrench,
  'mission-36-food-delivery': Truck,
  'mission-37-pet-shop': Cat,
  'mission-38-market': Apple,
  'mission-39-flower-shop': Flower2,
  'mission-40-manicure': Sparkles,
}

export function missionIcon(mission: Pick<MissionSummary, 'slug' | 'topic'>): LucideIcon {
  return MISSION_ICON[mission.slug] ?? ZONE_ICON[zoneOf(mission)]
}
