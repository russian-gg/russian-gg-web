import type { MissionCharacter, MissionTopic } from '../../../lib/types'

/*
 * The missions the tour shows, copied from the server's seed
 * (`russian-gg-server/.../Seed/DialogueMissionSeed.cs`) — the same titles, in the three
 * languages the seed has them in, so the landing page shows exactly what a learner meets.
 *
 * `ROAD` is the start of the practice road in the order the app lays it out
 * (`buildMissionRows`: by `TOPIC_ORDER`, the seed's order inside a topic): the one
 * introduction, the shopping missions, the café ones, the taxi, then the directions.
 */

export type DemoMission = {
  slug: string
  topic: Exclude<MissionTopic, 'Unset'>
  title: { uz: string; ru: string; en: string }
}

export const ROAD: DemoMission[] = [
  { slug: 'mission-01-meet-neighbour', topic: 'Introductions', title: { uz: "Qo'shni bilan tanishish", ru: 'Познакомиться с соседом', en: 'Meeting a neighbour' } },
  { slug: 'mission-03-buy-bread', topic: 'Shopping', title: { uz: "Do'kondan non sotib olish", ru: 'Купить хлеб в магазине', en: 'Buying bread in a shop' } },
  { slug: 'mission-07-buy-clothes', topic: 'Shopping', title: { uz: "Do'kondan kiyim sotib olish", ru: 'Купить одежду в магазине', en: 'Buying clothes in a shop' } },
  { slug: 'mission-16-buy-groceries', topic: 'Shopping', title: { uz: 'Oziq-ovqat sotib olish', ru: 'Купить продукты', en: 'Buying groceries' } },
  { slug: 'mission-37-pet-shop', topic: 'Shopping', title: { uz: 'Zoomagazinda', ru: 'В зоомагазине', en: 'At the pet shop' } },
  { slug: 'mission-38-market', topic: 'Shopping', title: { uz: 'Bozorda', ru: 'На рынке', en: 'At the market' } },
  { slug: 'mission-39-flower-shop', topic: 'Shopping', title: { uz: "Gul do'konida", ru: 'В цветочном магазине', en: 'At the flower shop' } },
  { slug: 'mission-04-order-tea', topic: 'CafeRestaurant', title: { uz: 'Kafeda choy buyurtma qilish', ru: 'Заказать чай в кафе', en: 'Ordering tea in a café' } },
  { slug: 'mission-22-restaurant', topic: 'CafeRestaurant', title: { uz: 'Restoranda', ru: 'В ресторане', en: 'At the restaurant' } },
  { slug: 'mission-10-order-taxi', topic: 'Taxi', title: { uz: 'Taksi chaqirish', ru: 'Заказать такси', en: 'Ordering a taxi' } },
  { slug: 'mission-02-ask-the-way', topic: 'Directions', title: { uz: "Yo'lni so'rash", ru: 'Спросить дорогу', en: 'Asking the way' } },
  { slug: 'mission-09-bus-ticket', topic: 'Directions', title: { uz: 'Avtobusga chipta sotib olish', ru: 'Купить билет на автобус', en: 'Buying a bus ticket' } },
  { slug: 'mission-26-train-ticket', topic: 'Directions', title: { uz: 'Poyezdga chipta sotib olish', ru: 'Купить билет на поезд', en: 'Buying a train ticket' } },
  { slug: 'mission-27-plane-ticket', topic: 'Directions', title: { uz: 'Aviachipta sotib olish', ru: 'Заказать авиабилет', en: 'Buying a plane ticket' } },
]

/** Everything in the practice library, for the heading's «0 / 40». */
export const LIBRARY_SIZE = 40

/** The mission the tour opens: number 1 on the road, the neighbour on the second floor. */
export const NEIGHBOUR = {
  ...ROAD[0],
  character: 'Penguin' as MissionCharacter,
  level: 'A1',
  /** `EstimatedMinutes`, and the three-minute cap on the conversation (`ConversationSeconds`). */
  minutes: 3,
  passScore: 80,
  objective: {
    uz: "Yangi qo'shningiz bilan tanishing: o'zingizni tanishtiring, qayerdan ekaningizni va qayerda yashashingizni ayting, choyga kelishib oling.",
    ru: 'Познакомиться с соседом: представиться, сказать, откуда вы и где живёте, и договориться о чае.',
    en: 'Get to know your neighbour: introduce yourself, say where you are from and where you live, and agree to tea.',
  },
  /** The mission's target phrases, Russian and the Uzbek meaning, in the seed's order. */
  phrases: [
    ['Здравствуйте! Я ваш сосед.', 'Assalomu alaykum! Men sizning qo‘shningizman.'],
    ['Меня зовут… А вас?', 'Mening ismim… Sizning ismingiz?'],
    ['Очень приятно!', 'Tanishganimdan xursandman!'],
    ['Вы откуда?', 'Siz qayerdansiz?'],
    ['Я из Самарканда.', 'Men Samarqanddanman.'],
    ['Давно здесь?', 'Bu yerda ko‘pdanmi?'],
    ['Недавно, только вчера переехал.', 'Yaqinda, kechagina ko‘chib keldim.'],
    ['Я живу на … этаже.', 'Men … qavatda yashayman.'],
    ['У вас есть ключ?', 'Kalitingiz bormi?'],
    ['Заходите на чай.', 'Choyga kiring.'],
    ['С удовольствием!', 'Bajonidil!'],
    ['Давайте завтра.', 'Kel, ertaga.'],
    ['Обращайтесь!', 'Murojaat qiling!'],
    ['До встречи!', 'Ko‘rishguncha!'],
  ] as ReadonlyArray<readonly [ru: string, uz: string]>,
  /**
   * How the penguin opens each of the four goals (the seed's `Example` lines); the fifth beat is
   * the goodbye.
   */
  lines: [
    'Я Пингвин. Живу на втором этаже. А вас как зовут?',
    'Очень приятно! Вы откуда приехали?',
    'Понятно. А на каком этаже вы живёте?',
    'Слушайте, может, зайдёте на чай? Я как раз заварю.',
  ],
  beats: 5,
} as const
