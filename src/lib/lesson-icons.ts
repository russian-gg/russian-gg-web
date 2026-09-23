import {
  Armchair,
  Backpack,
  Banknote,
  Bed,
  Blinds,
  Building2,
  Coffee,
  DoorOpen,
  Flower2,
  Glasses,
  Headphones,
  House,
  Image,
  KeyRound,
  Lamp,
  Landmark,
  Laptop,
  Laugh,
  Plug,
  Route,
  School,
  ShoppingBag,
  Signpost,
  Smartphone,
  Sofa,
  Sprout,
  Store,
  Table2,
  TrainFront,
  Trees,
  Tv,
  Umbrella,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

/**
 * The pictogram beside a Russian noun in the lesson games.
 *
 * These were emoji, and emoji were the wrong tool for this particular job. Not on style
 * grounds — a picture next to a new word is exactly right, and that is why they were there —
 * but because the picture is load-bearing here: in the packing game the learner is choosing
 * what is *missing from the bag*, and a glyph the device cannot render turns the question
 * into a guess. Several of the ones in use (🫖, 🧶, the family sequence) are recent additions
 * to Unicode and render as an empty box on the Android versions much of this audience is on.
 *
 * Lucide draws them at any size, in the theme's own colour, on every device that can run the
 * app at all.
 *
 * Keyed by the Russian word, because the Russian word is the thing that does not change: the
 * Uzbek gloss beside it may be re-translated and the lesson may be reordered, but `ключи` is
 * `ключи`. A word with no entry here falls back to the game's own default rather than
 * rendering nothing.
 */
export const bagItemIcons: Record<string, LucideIcon> = {
  ключи: KeyRound,
  телефон: Smartphone,
  зарядник: Plug,
  кошелёк: Wallet,
  деньги: Banknote,
  зонт: Umbrella,
  очки: Glasses,
  наушники: Headphones,
}

/** The default when a lesson names an item this map has not been taught yet. */
export const bagFallbackIcon: LucideIcon = Backpack

/**
 * Places on the city map.
 *
 * `улица` and `мост` are the two with no literal icon in the set. A street is a route and a
 * bridge is a crossing, so both take the nearest honest sign rather than a loose picture —
 * the word underneath is what carries the meaning, and the mark only has to be told apart
 * from its nine neighbours.
 */
export const cityPlaceIcons: Record<string, LucideIcon> = {
  парк: Trees,
  музей: Landmark,
  кафе: Coffee,
  улица: Route,
  мост: Signpost,
  фонтан: Flower2,
  магазин: Store,
  школа: School,
  вокзал: TrainFront,
  театр: Laugh,
}

export const cityFallbackIcon: LucideIcon = Landmark

/**
 * Scenes in the picture-description game.
 *
 * Keyed by the Uzbek word rather than the Russian, because this game's prompts are the scene
 * names a learner is asked to describe, not vocabulary being taught.
 */
export const pictureSceneIcons: Record<string, LucideIcon> = {
  shahar: Building2,
  "bog'": Sprout,
  uy: House,
  "ko'cha": Route,
  "do'kon": Store,
  park: Trees,
}

/** The objects being placed, keyed by the Russian word. */
export const roomObjectIcons: Record<string, LucideIcon> = {
  стол: Table2,
  стул: Armchair,
  кровать: Bed,
  лампа: Lamp,
  шкаф: DoorOpen,
  телевизор: Tv,
  ковёр: Blinds,
  картина: Image,
  цветы: Flower2,
  компьютер: Laptop,
}

/** Where a thing goes in the room-builder. Keyed by the slot, not by the object. */
export const roomSlotIcons: Record<string, LucideIcon> = {
  'picture-wall': Image,
  'tv-wall': Tv,
  'near-window': Blinds,
  corner: DoorOpen,
  'room-centre': Sofa,
  'beside-wall': Bed,
  'beside-table': Armchair,
  'on-desk': Lamp,
  'computer-desk': Laptop,
  'on-floor': ShoppingBag,
}
