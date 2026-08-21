export type Mascot = 'penguin' | 'panda' | 'pero'

export type Quiz = {
  question: string
  options: string[]
  correct: number
  feedback: string
}

export type RuleBlock = {
  title: string
  mascot: Mascot
  lead: string
  body: string[]
  examples: string[]
}

export type Phrase = {
  ru: string
  uz: string
  pronunciation?: string
  example: string
  icon: string
}

export type Vocab = {
  ru: string
  uz: string
  example: string
  icon: string
}

export type LessonData = {
  day: number
  titleRu: string
  titleUz: string
  tests: [Quiz, Quiz]
  phonetics: RuleBlock
  grammar: RuleBlock
  phrases: Phrase[]
  game: {
    kind?: 'matching' | 'family-crossword'
    title: string
    instruction: string
    pairs: Array<{ left: string; right: string }>
    clues?: Array<{ clue: string; answer: string }>
  }
  dialogue: string[]
  questions: Array<{ question: string; answer: string }>
  vocabulary: Vocab[]
  exercise: { title: string; instruction: string; starter: string }
  outcomes: Array<{ title: string; translation: string; tone: 'yellow' | 'blue' | 'red' }>
  sceneImage?: string
}

const p = (ru: string, uz: string, icon: string, example = ru, pronunciation?: string): Phrase => ({
  ru, uz, icon, example, pronunciation,
})

const v = (ru: string, uz: string, icon: string, example: string): Vocab => ({ ru, uz, icon, example })

const lesson1: LessonData = {
  day: 1,
  titleRu: 'Знакомство с соседом',
  titleUz: 'Qo‘shni bilan tanishuv',
  tests: [
    {
      question: 'Qaysi variantda «мама» so‘zi to‘g‘ri talaffuz qilingan?',
      options: ['ма́ма — urg‘u birinchi bo‘g‘inda', 'мама́ — urg‘u ikkinchi bo‘g‘inda'],
      correct: 0,
      feedback: '«мама» so‘zida urg‘u birinchi bo‘g‘inga tushadi: ма́ма.',
    },
    {
      question: '«квартира» so‘zi qaysi rodga kiradi?',
      options: ['Мужской род', 'Женский род', 'Средний род'],
      correct: 1,
      feedback: '«квартира» — женский род. Uning o‘zagi qizil rang bilan belgilanadi.',
    },
  ],
  phonetics: {
    title: 'Urg‘uli unlini aniq va cho‘ziq ayting',
    mascot: 'pero',
    lead: 'Rus tilida urg‘uli unli kuchliroq va aniqroq eshitiladi.',
    body: [
      'А tovushida og‘iz keng ochiladi; О tovushida lablar dumaloqlanadi; У tovushida lablar oldinga cho‘ziladi.',
      'Audio tugmasini bosing, qoidani eshiting va misollarni birga takrorlang.',
    ],
    examples: ['А', 'И', 'У', 'ма́ма', 'па́па', 'па́нда', 'до́м', 'сто́л', 'по́рт', 'сту́л', 'му́ж'],
  },
  grammar: {
    title: 'Rodlar haqida ertak',
    mascot: 'penguin',
    lead: 'Rodlar qirolliklariga hush kelibsiz!',
    body: [
      'Мужской род — ko‘k, женский род — alvon qizil, средний род — sariq. So‘zning o‘zagi shu rangda ko‘rsatiladi.',
      'Undosh bilan tugagan otlar ko‘pincha мужской род; -а/-я bilan tugaganlar женский род; -о/-е bilan tugaganlar средний род bo‘ladi.',
    ],
    examples: ['дом', 'стол', 'папа', 'мама', 'квартира', 'окно', 'море'],
  },
  phrases: [
    p('Здравствуйте!', 'Assalomu alaykum!', '👋', 'Здравствуйте! Я ваш сосед.', 'zdrástvuyte'),
    p('Меня зовут Али.', 'Mening ismim Ali.', '🪪', 'Меня зовут Али.', 'menyá zovút Ali'),
    p('А как вас зовут?', 'Ismingiz nima?', '❓', 'Здравствуйте! А как вас зовут?', 'a kak vas zovút'),
    p('Я ваш сосед.', 'Men sizning qo‘shningizman.', '🏠', 'Я ваш сосед.', 'ya vash soséd'),
    p('Это моя квартира.', 'Bu mening xonadonim.', '🏢', 'Это моя квартира.', 'éta mayá kvartíra'),
    p('А это мой дом.', 'Bu esa mening uyim.', '🏡', 'А это мой дом.', 'a éta moy dom'),
    p('Очень приятно!', 'Tanishganimdan xursandman!', '🤝', 'Очень приятно!', 'óchen priyátna'),
    p('Где вы живёте?', 'Qayerda yashaysiz?', '📍', 'Где вы живёте?', 'gde vy zhivyóte'),
    p('Я живу на пятом этаже.', 'Men beshinchi qavatda yashayman.', '5️⃣', 'Я живу на пятом этаже.', 'ya zhivú na pyátam etazhý'),
    p('А вы? А я на втором.', 'Sizchi? Men ikkinchi qavatda.', '2️⃣', 'А вы? А я на втором.', 'a vy? a ya na ftaróm'),
    p('Это ваш ключ?', 'Bu sizning kalitingizmi?', '🔑', 'Это ваш ключ?', 'éta vash klyuch'),
    p('Да, это мой ключ.', 'Ha, bu mening kalitim.', '✅', 'Да, это мой ключ.', 'da, éta moy klyuch'),
    p('Добро пожаловать!', 'Xush kelibsiz!', '🚪', 'Добро пожаловать в мой дом!', 'dabró pazhálavat'),
    p('Я хочу пригласить вас на чай.', 'Sizni choyga taklif qilmoqchiman.', '🫖', 'Я хочу пригласить вас на чай.', 'ya khachú priglasít vas na chay'),
    p('С удовольствием!', 'Mamnuniyat bilan!', '✨', 'С удовольствием!', 's udavólstviyem'),
  ],
  game: {
    title: 'Rangli uy',
    instruction: 'So‘zni bosing, keyin mos rangli uyni tanlang. Sudrash shart emas — telefonda hammasi ekranga sig‘adi.',
    pairs: [
      { left: 'дом', right: 'Мужской род' }, { left: 'квартира', right: 'Женский род' },
      { left: 'окно', right: 'Средний род' }, { left: 'сосед', right: 'Мужской род' },
      { left: 'дверь', right: 'Женский род' }, { left: 'море', right: 'Средний род' },
    ],
  },
  dialogue: [
    'Пингвин: Здравствуйте! Меня зовут Пингвин. Я ваш сосед.',
    'Панда: Очень приятно! А меня Панда. Это моя квартира.',
    'Пингвин: А это мой дом. Я живу на пятом этаже.',
    'Панда: А я на втором. Где вы живёте?',
    'Пингвин: На пятом. Это ваш ключ?',
    'Панда: Да, мой.',
    'Пингвин: Добро пожаловать! Я хочу пригласить вас на чай.',
    'Панда: С удовольствием!',
  ],
  questions: [
    { question: 'Как вас зовут?', answer: 'Меня зовут …' },
    { question: 'Кто вы?', answer: 'Я сосед. / Я ваш сосед.' },
    { question: 'Где вы живёте?', answer: 'Я живу на пятом этаже.' },
    { question: 'Это ваш ключ?', answer: 'Да, это мой ключ.' },
    { question: 'Что вы хотите?', answer: 'Я хочу пригласить вас на чай.' },
    { question: 'Вы согласны?', answer: 'С удовольствием!' },
  ],
  vocabulary: [
    v('здравствуйте', 'assalomu alaykum', '👋', 'Здравствуйте! Я ваш сосед.'),
    v('меня зовут', 'mening ismim', '🪪', 'Меня зовут Али.'),
    v('сосед', 'qo‘shni', '🧑', 'Это мой сосед.'),
    v('квартира', 'xonadon', '🏢', 'Это моя квартира.'),
    v('дом', 'uy', '🏠', 'Это мой дом.'),
    v('этаж', 'qavat', '5️⃣', 'Я живу на пятом этаже.'),
    v('ключ', 'kalit', '🔑', 'Это мой ключ.'),
    v('чай', 'choy', '🍵', 'Приглашаю вас на чай.'),
    v('добро пожаловать', 'xush kelibsiz', '🚪', 'Добро пожаловать в мой дом!'),
    v('с удовольствием', 'mamnuniyat bilan', '✨', 'С удовольствием!'),
  ],
  exercise: {
    title: 'Rasmli mashq',
    instruction: 'Qo‘shni bilan tanishuvni 3–4 gapda tasvirlang. Ism, uy, qavat va choyga taklifni ishlating.',
    starter: 'Здравствуйте! Меня зовут … Я ваш сосед. Я живу …',
  },
  outcomes: [
    { title: 'Знакомство', translation: 'tanishuv', tone: 'yellow' },
    { title: 'Дом и сосед', translation: 'uy va qo‘shni', tone: 'blue' },
    { title: 'Приглашение', translation: 'taklif', tone: 'yellow' },
  ],
}

const lesson2: LessonData = {
  day: 2,
  titleRu: 'Как дела?',
  titleUz: 'Telefon orqali suhbat',
  tests: [
    { question: 'Qaysi variantda «ты» to‘g‘ri talaffuz qilingan?', options: ['[ты] — qattiq Ы', '[ти] — yumshoq И'], correct: 0, feedback: '«ты» so‘zida qattiq, chuqur Ы aytiladi.' },
    { question: '«Сосед живёт рядом» gapida «сосед» o‘rniga qaysi olmosh keladi?', options: ['Я', 'Он', 'Она'], correct: 1, feedback: '«сосед» — мужской род, shuning uchun «он» ishlatiladi.' },
  ],
  phonetics: {
    title: 'Ы va И tovushlari farqi', mascot: 'pero',
    lead: 'И — til oldinda, Ы — til orqaroqda va tovush chuqurroq.',
    body: ['И aytganda lablar biroz yoyiladi va til pastki tishlarga yaqinlashadi.', 'Ы aytganda til orqaga tortiladi. и — ы juftligini sekin, keyin tabiiy tezlikda takrorlang.'],
    examples: ['мы', 'вы', 'ты', 'мир', 'лист', 'пить'],
  },
  grammar: {
    title: 'Shaxs olmoshlari', mascot: 'penguin',
    lead: 'Я, ты, он, она, оно, мы, вы, они — gapdagi shaxsni ko‘rsatadi.',
    body: ['«Вы» bir necha kishiga yoki bir kishiga hurmat bilan aytiladi; do‘stga «ты» ishlatiladi.', 'Olmosh otning rodiga mos keladi: он — erkak/мужской, она — ayol/женский, оно — средний род.'],
    examples: ['Я говорю.', 'Ты слышишь?', 'Он работает.', 'Она читает.', 'Мы понимаем.', 'Вы говорите?'],
  },
  phrases: [
    p('Алло!', 'Allo!', '📞'), p('Привет!', 'Salom!', '👋'), p('Как дела?', 'Ishlar qalay?', '❓'),
    p('У меня всё хорошо.', 'Menda hammasi yaxshi.', '😊'), p('А у тебя?', 'Senda-chi?', '↩️'),
    p('Тоже нормально.', 'Men ham yaxshiman.', '🙂'), p('Что ты делаешь?', 'Nima qilyapsan?', '💬'),
    p('Я читаю книгу.', 'Men kitob o‘qiyapman.', '📖'), p('А ты? Я работаю.', 'Senda-chi? Men ishlayapman.', '💼'),
    p('Ты говоришь по-русски?', 'Ruscha gapirasanmi?', '🗣️'), p('Да, немного.', 'Ha, ozgina.', '👌'),
    p('Я тебя понимаю.', 'Men seni tushunaman.', '💡'), p('Ты меня слышишь?', 'Meni eshityapsanmi?', '👂'),
    p('Перезвони позже.', 'Keyinroq qo‘ng‘iroq qil.', '🔁'), p('Пока! До связи!', 'Xayr! Bog‘lanamiz!', '👋'),
  ],
  game: {
    title: 'Tarjimasini top', instruction: 'Ruscha olmoshni bosing, keyin o‘zbekcha ma’nosini tanlang.',
    pairs: [{ left: 'Я', right: 'men' }, { left: 'Ты', right: 'sen' }, { left: 'Он', right: 'u (erkak)' }, { left: 'Она', right: 'u (ayol)' }, { left: 'Мы', right: 'biz' }, { left: 'Вы', right: 'siz' }],
  },
  dialogue: ['Пингвин: Алло! Привет, Панда! Как дела?', 'Панда: Привет! У меня всё хорошо. А у тебя?', 'Пингвин: Тоже нормально. Что ты делаешь?', 'Панда: Я читаю книгу. А ты?', 'Пингвин: Я работаю. Ты говоришь по-русски?', 'Панда: Да, немного.', 'Пингвин: Я тебя понимаю. Ты меня слышишь?', 'Панда: Да, слышу хорошо.', 'Пингвин: Перезвони позже.', 'Панда: Хорошо, договорились. Пока!', 'Пингвин: Пока! До связи!'],
  questions: [
    { question: 'Как дела?', answer: 'У меня всё хорошо. / Тоже нормально.' }, { question: 'Что ты делаешь?', answer: 'Я читаю книгу. / Я работаю.' },
    { question: 'Ты говоришь по-русски?', answer: 'Да, немного.' }, { question: 'Ты меня слышишь?', answer: 'Да, слышу хорошо.' },
    { question: 'Ты понимаешь меня?', answer: 'Да, я тебя понимаю.' },
  ],
  vocabulary: [
    v('говорить по телефону', 'telefonda gaplashmoq', '📞', 'Я говорю по телефону.'), v('мой телефон', 'mening telefonim', '📱', 'Это мой телефон.'),
    v('твой номер', 'sening raqaming', '🔢', 'Какой твой номер?'), v('ваш звонок', 'sizning qo‘ng‘irog‘ingiz', '🔔', 'Я жду ваш звонок.'),
    v('как дела?', 'ishlar qalay?', '❓', 'Привет! Как дела?'), v('всё хорошо', 'hammasi yaxshi', '😊', 'У меня всё хорошо.'),
    v('читать книгу', 'kitob o‘qimoq', '📖', 'Я читаю книгу.'), v('работать в офисе', 'ofisda ishlamoq', '💼', 'Я работаю в офисе.'),
    v('слушать музыку', 'musiqa tinglamoq', '🎵', 'Она слушает музыку.'), v('до связи', 'bog‘lanamiz', '👋', 'Пока! До связи!'),
  ],
  exercise: { title: 'Telefon dialogi', instruction: 'Do‘stingiz bilan 5–6 replikali telefon suhbatini yozing: salomlashish, ahvol, nima qilayotganingiz va xayrlashish.', starter: 'Алло, привет! Как дела? …' },
  outcomes: [{ title: 'Телефон', translation: 'telefon suhbati', tone: 'blue' }, { title: 'Как дела?', translation: 'hol-ahvol', tone: 'yellow' }, { title: 'Местоимения', translation: 'olmoshlar', tone: 'blue' }],
}

const lesson3: LessonData = {
  day: 3,
  titleRu: 'Кто Вы?',
  titleUz: 'Siz kimsiz?',
  tests: [
    { question: 'Qaysi variantda urg‘u to‘g‘ri?', options: ['у́читель', 'учи́тель', 'учите́ль'], correct: 1, feedback: 'To‘g‘ri talaffuz: учи́тель.' },
    { question: 'Rus tilida «Я учитель» deyilganda «есть» ishlatiladimi?', options: ['Ha: Я есть учитель', 'Yo‘q: Я учитель'], correct: 1, feedback: 'Hozirgi zamonda «быть» tushirib qoldiriladi: «Я учитель».' },
  ],
  phonetics: {
    title: 'Kasb nomlarida urg‘u', mascot: 'pero', lead: 'Rus tilida urg‘u turli bo‘g‘inga tushadi va yangi so‘z bilan birga yodlanadi.',
    body: ['Urg‘uli bo‘g‘inni biroz balandroq va cho‘ziqroq ayting.', 'Audio bilan tinglang, so‘ng har bir kasbni ikki marta takrorlang.'],
    examples: ['вра́ч', 'учи́тель', 'инжене́р', 'студе́нт', 'рабо́чий', 'пенсионе́р'],
  },
  grammar: {
    title: 'Hozirgi zamonda «быть»', mascot: 'penguin', lead: 'Rus tilida hozirgi zamonda «быть» fe’li aytilmaydi.',
    body: ['«Я есть учитель» emas, «Я учитель» deyiladi.', 'Qoida barcha shaxslarga tegishli: olmosh + kasb. O‘tgan va kelasi zamon shakllari keyin o‘rganiladi.'],
    examples: ['Я студент.', 'Ты врач.', 'Он инженер.', 'Она врач.', 'Мы рабочие.', 'Вы учителя.'],
  },
  phrases: [
    p('Здравствуйте!', 'Assalomu alaykum!', '👋'), p('Кто вы по профессии?', 'Kasbingiz nima?', '❓'), p('Я врач.', 'Men shifokorman.', '🩺'),
    p('А вы? Я учитель.', 'Siz-chi? Men o‘qituvchiman.', '🧑‍🏫'), p('Он инженер.', 'U muhandis.', '⚙️'), p('Она врач.', 'U shifokor.', '👩‍⚕️'),
    p('Мы студенты.', 'Biz talabamiz.', '🎓'), p('Вы рабочие?', 'Siz ishchimisiz?', '🦺'), p('Да, мы рабочие.', 'Ha, biz ishchimiz.', '✅'),
    p('Это мой коллега.', 'Bu mening hamkasbim.', '🤝'), p('Он тоже инженер.', 'U ham muhandis.', '⚙️'), p('Где вы работаете?', 'Qayerda ishlaysiz?', '📍'),
    p('Я работаю в больнице.', 'Men kasalxonada ishlayman.', '🏥'), p('У вас интересная работа.', 'Ishingiz qiziqarli.', '✨'), p('Удачи в работе!', 'Ishingizda omad!', '🍀'),
  ],
  game: { title: 'Kasbni top', instruction: 'Rasmli belgini bosing, keyin mos ruscha kasbni tanlang.', pairs: [{ left: '🩺', right: 'врач' }, { left: '🧑‍🏫', right: 'учитель' }, { left: '⚙️', right: 'инженер' }, { left: '🎓', right: 'студент' }, { left: '🦺', right: 'рабочий' }, { left: '💻', right: 'программист' }] },
  dialogue: ['Пингвин: Здравствуйте! Кто вы по профессии?', 'Панда: Я врач. А вы?', 'Пингвин: Я учитель. Это мой коллега Перо. Он инженер.', 'Панда: А она врач?', 'Пингвин: Нет, она тоже инженер.', 'Панда: Вы рабочие?', 'Пингвин: Да, мы рабочие.', 'Панда: У вас интересная работа. Удачи в работе!'],
  questions: [{ question: 'Кто вы по профессии?', answer: 'Я врач. / Я учитель.' }, { question: 'А вы?', answer: 'Я учитель. / Я инженер.' }, { question: 'Кто он?', answer: 'Он инженер.' }, { question: 'Кто она?', answer: 'Она врач. / Она инженер.' }, { question: 'Вы рабочие?', answer: 'Да, мы рабочие.' }, { question: 'Где вы работаете?', answer: 'Я работаю в больнице.' }],
  vocabulary: [
    v('врач', 'shifokor', '🩺', 'Я работаю врачом.'), v('учитель', 'o‘qituvchi', '🧑‍🏫', 'Я учитель русского языка.'),
    v('инженер', 'muhandis', '⚙️', 'Он инженер на заводе.'), v('студент', 'talaba', '🎓', 'Я студент университета.'),
    v('рабочий', 'ishchi', '🦺', 'Он рабочий на стройке.'), v('коллега', 'hamkasb', '🤝', 'Это мой коллега.'),
    v('профессия', 'kasb', '💼', 'У меня интересная профессия.'), v('работа', 'ish', '🏢', 'Это трудная работа.'),
    v('больница', 'kasalxona', '🏥', 'Я работаю в больнице.'), v('школа', 'maktab', '🏫', 'Она работает в школе.'),
  ],
  exercise: { title: 'Kasb haqida gaplar', instruction: 'Ikki odam uchun olmosh + kasb shaklida gap tuzing.', starter: 'Гули врач. Сардор программист. Я …' },
  outcomes: [{ title: 'Профессия', translation: 'kasb', tone: 'yellow' }, { title: 'Кто Вы?', translation: 'siz kimsiz', tone: 'blue' }, { title: 'Работа', translation: 'ish', tone: 'yellow' }],
}

const lesson4: LessonData = {
  day: 4,
  titleRu: 'Что ты делаешь?',
  titleUz: 'Hozir nima qilyapsan?',
  tests: [
    { question: '«мяч» so‘zi qanday tovush bilan boshlanadi?', options: ['qattiq М', 'yumshoq М’'], correct: 1, feedback: '«я» harfi oldingi М tovushini yumshatadi: [м’ач].' },
    { question: '«Я читать книгу» gapi to‘g‘rimi?', options: ['Ha, to‘g‘ri', 'Yo‘q, fe’l shakli o‘zgarishi kerak'], correct: 1, feedback: 'To‘g‘risi: «Я читаю книгу».' },
  ],
  phonetics: {
    title: 'Qattiq va yumshoq М', mascot: 'pero', lead: 'Keyingi unli harf М tovushining qattiq yoki yumshoq aytilishini ko‘rsatadi.',
    body: ['а, о, у, ы, э oldidan М qattiq; я, ё, ю, и, е yoki ь oldidan М yumshoq aytiladi.', 'Juftlarni sekin ayting va til o‘rtasining tanglayga ko‘tarilishini his qiling.'],
    examples: ['ма́ма — мя́ч', 'мы́ло — ми́р', 'му́ка — мю́сли', 'мост — мёд', 'мал — мял', 'мыл — мил'],
  },
  grammar: {
    title: '1-guruh fe’llari', mascot: 'penguin', lead: 'Fe’l shaxsga qarab o‘zgaradi; 1-tuslanishda shaxsiy qo‘shimchalar alvon rangda ajratiladi.',
    body: ['читать: я читаю, ты читаешь, он читает, мы читаем, вы читаете, они читают.', 'Xuddi shu qolip работать, думать, слушать, отдыхать va понимать fe’llarida ham ishlaydi.'],
    examples: ['я читаю', 'ты читаешь', 'он читает', 'мы читаем', 'вы читаете', 'они читают'],
  },
  phrases: [
    p('Что ты делаешь?', 'Nima qilyapsan?', '❓'), p('Я читаю книгу.', 'Men kitob o‘qiyapman.', '📖'), p('А ты? Я работаю.', 'Senda-chi? Men ishlayapman.', '💼'),
    p('Мы смотрим фильм.', 'Biz film ko‘ryapmiz.', '🎬'), p('Он пишет письмо.', 'U xat yozyapti.', '✉️'), p('Она слушает музыку.', 'U musiqa tinglayapti.', '🎵'),
    p('Мы думаем о завтраке.', 'Biz nonushta haqida o‘ylayapmiz.', '🍳'), p('Они отдыхают.', 'Ular dam olyapti.', '🛋️'), p('Я не сплю.', 'Men uxlamayapman.', '🌙'),
    p('Ты не слышишь?', 'Eshitmayapsanmi?', '👂'), p('Я всё понимаю.', 'Men hammasini tushunaman.', '💡'), p('Мы уже идём.', 'Biz allaqachon ketyapmiz.', '🚶'),
    p('Вы работаете сейчас?', 'Siz hozir ishlayapsizmi?', '⏱️'), p('Да, я работаю.', 'Ha, men ishlayapman.', '✅'), p('Подождите минуту!', 'Bir daqiqa kuting!', '☝️'),
  ],
  game: { title: 'Fe’l domino', instruction: 'Olmoshni bosing, keyin unga mos fe’l shaklini tanlang.', pairs: [{ left: 'я', right: 'читаю' }, { left: 'ты', right: 'работаешь' }, { left: 'он', right: 'думает' }, { left: 'мы', right: 'слушаем' }, { left: 'вы', right: 'отдыхаете' }, { left: 'они', right: 'понимают' }] },
  dialogue: ['Панда: Что ты делаешь, Пингвин?', 'Пингвин: Я читаю книгу. А ты?', 'Панда: Я тоже читаю. Вечером мы смотрим фильм.', 'Пингвин: Он пишет письмо? Она слушает музыку?', 'Панда: Да. Мы думаем о завтраке.', 'Пингвин: А они отдыхают. Ты не слышишь?', 'Панда: Я всё понимаю. Мы уже идём.', 'Пингвин: Вы работаете сейчас?', 'Панда: Да, работаю. Подождите минуту!'],
  questions: [{ question: 'Что ты делаешь?', answer: 'Я читаю книгу. / Я работаю.' }, { question: 'Что он делает?', answer: 'Он пишет письмо.' }, { question: 'Что она делает?', answer: 'Она слушает музыку.' }, { question: 'Что вы делаете?', answer: 'Мы работаем.' }, { question: 'Что они делают?', answer: 'Они отдыхают.' }, { question: 'Ты понимаешь?', answer: 'Я всё понимаю.' }],
  vocabulary: [
    v('читать книгу', 'kitob o‘qimoq', '📖', 'Я читаю книгу.'), v('работать в офисе', 'ofisda ishlamoq', '💼', 'Он работает в офисе.'),
    v('писать письмо', 'xat yozmoq', '✉️', 'Она пишет письмо.'), v('слушать музыку', 'musiqa tinglamoq', '🎵', 'Мы слушаем музыку.'),
    v('отдыхать в парке', 'parkda dam olmoq', '🌳', 'Они отдыхают в парке.'), v('думать о работе', 'ish haqida o‘ylamoq', '💭', 'Я думаю о работе.'),
    v('смотреть фильм', 'film ko‘rmoq', '🎬', 'Мы смотрим фильм.'), v('пить чай', 'choy ichmoq', '🍵', 'Она пьёт чай.'),
    v('писать статью', 'maqola yozmoq', '📝', 'Я пишу статью.'), v('играть на гитаре', 'gitara chalmoq', '🎸', 'Он играет на гитаре.'),
  ],
  exercise: { title: 'Bugungi kunim', instruction: 'Nima qilayotganingizni 5–6 gapda yozing. читать, работать, слушать, писать, отдыхать fe’llaridan foydalaning.', starter: 'Сейчас я читаю … Я работаю …' },
  outcomes: [{ title: 'Действия', translation: 'harakatlar', tone: 'yellow' }, { title: 'Глаголы', translation: 'fe’llar', tone: 'blue' }, { title: 'Сейчас', translation: 'hozir', tone: 'yellow' }],
}

const lesson5: LessonData = {
  day: 5,
  titleRu: 'Вы говорите по-русски?',
  titleUz: 'Ruscha gapirasizmi?',
  tests: [
    { question: 'Qaysi gapda Н tovushi yumshoq aytiladi?', options: ['У меня длинный нос.', 'Он нёс сумку.'], correct: 1, feedback: '«нёс» so‘zida ё oldingi Н tovushini yumshatadi.' },
    { question: 'Qaysi savol to‘g‘ri tuzilgan?', options: ['Ты говоришь по-русски?', 'Говоришь ли ты по-русски?', 'Ikkalasi ham to‘g‘ri'], correct: 2, feedback: 'Savol intonatsiya bilan ham, «ли» yordamida ham tuziladi.' },
  ],
  phonetics: {
    title: 'Qattiq Н va yumshoq Н’', mascot: 'pero', lead: 'Rus tilidagi undoshlar keyingi unliga qarab qattiq yoki yumshoq aytiladi.',
    body: ['а, о, у, ы, э oldidan Н qattiq; я, ё, ю, и, е yoki ь oldidan Н yumshoq.', 'Til holatini sezib, juftlarni audio bilan ketma-ket takrorlang.'],
    examples: ['нос — нёс', 'на — ня', 'но — нё', 'ну — ню'],
  },
  grammar: {
    title: 'Inkor va so‘roq gaplar', mascot: 'penguin', lead: 'Inkor uchun fe’l oldiga «не» qo‘yiladi. Savol intonatsiya yoki «ли» bilan tuziladi.',
    body: ['Я читаю → Я не читаю. Ты работаешь → Ты не работаешь.', 'Oddiy savol: «Ты говоришь по-русски?» Rasmiyroq savol: «Говоришь ли ты по-русски?»'],
    examples: ['Я не читаю.', 'Он не говорит.', 'Ты понимаешь меня?', 'Понимаете ли вы меня?'],
  },
  phrases: [
    p('Ты говоришь по-русски?', 'Ruscha gapirasanmi?', '🗣️'), p('Да, я говорю немного.', 'Ha, ozgina gapiraman.', '👌'), p('А ты? Нет, не говорю.', 'Senda-chi? Yo‘q, gapirmayman.', '🙅'),
    p('Ты понимаешь меня?', 'Meni tushunasanmi?', '❓'), p('Да, понимаю.', 'Ha, tushunaman.', '✅'), p('Нет, не понимаю.', 'Yo‘q, tushunmayman.', '🤷'),
    p('Ты учишь русский язык?', 'Rus tilini o‘rganyapsanmi?', '📚'), p('Да, учу.', 'Ha, o‘rganyapman.', '✅'), p('А вы говорите по-узбекски?', 'O‘zbekcha gapirasizmi?', '🇺🇿'),
    p('Да, говорю.', 'Ha, gapiraman.', '💬'), p('Я хочу научиться.', 'Men o‘rganmoqchiman.', '🎯'), p('Это трудно? Нет, не очень.', 'Qiyinmi? Yo‘q, unchalik emas.', '💪'),
    p('Мы занимаемся каждый день.', 'Biz har kuni shug‘ullanamiz.', '📅'), p('Ты не хочешь помочь мне?', 'Menga yordam bermoqchimisan?', '🤝'), p('С удовольствием!', 'Mamnuniyat bilan!', '✨'),
  ],
  game: { title: 'So‘roq va inkor dueli', instruction: 'Tasdiq gapni bosing, keyin uning to‘g‘ri inkor shaklini tanlang.', pairs: [{ left: 'Я читаю.', right: 'Я не читаю.' }, { left: 'Ты работаешь.', right: 'Ты не работаешь.' }, { left: 'Он говорит.', right: 'Он не говорит.' }, { left: 'Мы понимаем.', right: 'Мы не понимаем.' }, { left: 'Вы учите.', right: 'Вы не учите.' }, { left: 'Они слушают.', right: 'Они не слушают.' }] },
  dialogue: ['Панда: Привет, Пингвин! Ты говоришь по-русски?', 'Пингвин: Да, я говорю немного. А ты?', 'Панда: Да, я хорошо говорю. Ты понимаешь меня?', 'Пингвин: Да, понимаю. Ты учишь русский язык?', 'Панда: Да, учу. А вы говорите по-узбекски?', 'Пингвин: Нет, не говорю. Я хочу научиться.', 'Панда: Это трудно?', 'Пингвин: Нет, не очень. Мы занимаемся каждый день.', 'Панда: Ты не хочешь помочь мне?', 'Пингвин: С удовольствием!'],
  questions: [{ question: 'Ты говоришь по-русски?', answer: 'Да, я говорю немного. / Нет, не говорю.' }, { question: 'Ты понимаешь меня?', answer: 'Да, понимаю. / Нет, не понимаю.' }, { question: 'Ты учишь русский язык?', answer: 'Да, учу.' }, { question: 'Вы говорите по-узбекски?', answer: 'Да, говорю.' }, { question: 'Это трудно?', answer: 'Нет, не очень.' }, { question: 'Ты хочешь помочь мне?', answer: 'С удовольствием!' }],
  vocabulary: [
    v('говорить по-русски', 'ruscha gapirmoq', '🗣️', 'Я говорю по-русски.'), v('понимать язык', 'tilni tushunmoq', '💡', 'Я понимаю русский язык.'),
    v('учить русский', 'rus tilini o‘rganmoq', '📚', 'Я учу русский.'), v('знать слово', 'so‘zni bilmoq', '🔤', 'Я знаю это слово.'),
    v('слышать фразу', 'iborani eshitmoq', '👂', 'Я слышу эту фразу.'), v('задать вопрос', 'savol bermoq', '❓', 'Можно задать вопрос?'),
    v('дать ответ', 'javob bermoq', '✅', 'Я дам ответ.'), v('слушать диалог', 'dialogni tinglamoq', '🎧', 'Мы слушаем диалог.'),
    v('читать текст', 'matnni o‘qimoq', '📄', 'Он читает текст.'), v('делать ошибку', 'xato qilmoq', '✏️', 'Не бойтесь делать ошибку.'),
  ],
  exercise: { title: 'Til haqida suhbat', instruction: 'Do‘stingiz bilan 5–6 replika yozing: gapirish, tushunish, o‘rganish, qiyinlik va yordam haqida so‘rang.', starter: 'Ты говоришь по-русски? Да, я …' },
  outcomes: [{ title: 'Русский язык', translation: 'rus tili', tone: 'blue' }, { title: 'Вопрос', translation: 'savol', tone: 'yellow' }, { title: 'Отрицание', translation: 'inkor', tone: 'blue' }],
}

const lesson6: LessonData = {
  day: 6,
  titleRu: 'Моя семья — какие они?',
  titleUz: 'Mening oilam — ular qanday?',
  tests: [
    {
      question: 'Qaysi so‘zda Т tovushi yumshoq [Т’] talaffuz qilinadi?',
      options: ['тень', 'теннис'],
      correct: 0,
      feedback: '«тень» so‘zida е harfi oldingi Т tovushini yumshatadi: [т’эн’]. «теннис» o‘zlashma so‘zida esa Т qattiq aytiladi.',
    },
    {
      question: 'Qaysi gapda sifat ot bilan to‘g‘ri moslashtirilgan?',
      options: ['красивый сестра', 'красивая сестра', 'красивое сестра'],
      correct: 1,
      feedback: '«сестра» — женский род, shuning uchun to‘g‘ri shakl «красивая сестра».',
    },
  ],
  phonetics: {
    title: 'Qattiq Т va yumshoq Т’',
    mascot: 'penguin',
    lead: 'Rus tilida Т tovushi tilning holatiga qarab qattiq yoki yumshoq aytiladi.',
    body: [
      '[Т] qattiq aytilganda til uchi yuqori tishlarga tegadi va tilning orqa qismi pastda qoladi.',
      '[Т’] yumshoq aytilganda tilning o‘rta qismi tanglayga ko‘tariladi. а, о, у, ы, э oldidan qattiq; я, ё, ю, и, е yoki ь oldidan yumshoq aytiladi.',
    ],
    examples: ['та — тя', 'то — тё', 'ту — тю', 'ты — ти', 'тэ — те', 'тень — теннис'],
  },
  grammar: {
    title: 'Sifatlarning ot bilan moslashuvi',
    mascot: 'panda',
    lead: 'Sifat otning jinsi va soniga moslashadi: какой, какая, какое yoki какие.',
    body: [
      'Мужской род: -ый/-ой/-ий — красивый брат, большой дом. Женский род: -ая/-яя — красивая сестра, большая семья.',
      'Средний род: -ое/-ее — красивое окно, синее море. Ko‘plikda barcha jinslar uchun -ые/-ие ishlatiladi: красивые дома, книги, окна.',
    ],
    examples: ['красивый брат', 'красивая сестра', 'красивое окно', 'большой папа', 'большая семья', 'дружные родители'],
  },
  phrases: [
    p('Это моя семья.', 'Bu mening oilam.', '👨‍👩‍👧‍👦'),
    p('Мой брат — красивый.', 'Mening akam chiroyli.', '👦'),
    p('Моя сестра — умная.', 'Mening singlim aqlli.', '👧'),
    p('Мой папа — сильный.', 'Mening dadam kuchli.', '👨'),
    p('Моя мама — добрая.', 'Mening onam mehribon.', '👩'),
    p('Моя бабушка — старая.', 'Mening buvim keksa.', '👵'),
    p('Мой дедушка — мудрый.', 'Mening bobom dono.', '👴'),
    p('Моя сестра — высокая.', 'Mening singlim baland bo‘yli.', '📏'),
    p('Мой брат — молодой.', 'Mening akam yosh.', '🌱'),
    p('Это моя тётя — она красивая.', 'Bu mening xolam — u chiroyli.', '👩‍🦰'),
    p('Это мой дядя — он добрый.', 'Bu mening tog‘am — u mehribon.', '🧔'),
    p('Наша семья — большая.', 'Bizning oilamiz katta.', '🏡'),
    p('Мой брат — высокий и сильный.', 'Mening akam baland va kuchli.', '💪'),
    p('Моя мама — молодая и красивая.', 'Mening onam yosh va chiroyli.', '🌷'),
    p('Мы все — дружные.', 'Biz hammamiz ahilmiz.', '🤗'),
  ],
  game: {
    kind: 'family-crossword',
    title: 'Krossvord: Mening oilam',
    instruction: 'Ta’rifni o‘qing va ruscha oila a’zosini yozing. Har bir to‘g‘ri javob oilaviy suratning bir qismini ochadi.',
    pairs: [],
    clues: [
      { clue: 'Он молодой, высокий и сильный.', answer: 'брат' },
      { clue: 'Она добрая, молодая и красивая.', answer: 'мама' },
      { clue: 'Он сильный и серьёзный.', answer: 'папа' },
      { clue: 'Она умная и высокая.', answer: 'сестра' },
      { clue: 'Она старая и добрая.', answer: 'бабушка' },
      { clue: 'Он старый и мудрый.', answer: 'дедушка' },
      { clue: 'Мамина или папина сестра.', answer: 'тётя' },
      { clue: 'Мамин или папин брат.', answer: 'дядя' },
      { clue: 'Мама, папа и дети вместе.', answer: 'семья' },
      { clue: 'Мама и папа одним словом.', answer: 'родители' },
    ],
  },
  dialogue: [
    'Пингвин: Это твоя семья?',
    'Панда: Да, это моя семья. Вот мой брат — он красивый. Моя сестра — она умная.',
    'Пингвин: А твой папа?',
    'Панда: Мой папа — сильный. Моя мама — добрая.',
    'Пингвин: Моя бабушка — старая, а дедушка — мудрый.',
    'Панда: Твоя сестра высокая?',
    'Пингвин: Да, она высокая, а брат молодой.',
    'Панда: Это моя тётя — она красивая. А это мой дядя — он добрый.',
    'Пингвин: Ваша семья большая?',
    'Панда: Да, наша семья большая и дружная.',
  ],
  questions: [
    { question: 'Это твоя семья?', answer: 'Да, это моя семья.' },
    { question: 'Какой твой брат?', answer: 'Мой брат красивый, молодой, высокий и сильный.' },
    { question: 'Какая твоя сестра?', answer: 'Моя сестра умная и высокая.' },
    { question: 'Какая твоя мама?', answer: 'Моя мама добрая, молодая и красивая.' },
    { question: 'Какой твой папа?', answer: 'Мой папа сильный.' },
    { question: 'Ваша семья большая?', answer: 'Да, наша семья большая и дружная.' },
  ],
  vocabulary: [
    v('красивый брат', 'chiroyli aka', '👦', 'Мой брат красивый.'),
    v('умная сестра', 'aqlli opa yoki singil', '👧', 'Моя сестра умная.'),
    v('сильный папа', 'kuchli dada', '👨', 'Мой папа сильный.'),
    v('добрая мама', 'mehribon ona', '👩', 'Моя мама добрая.'),
    v('старая бабушка', 'keksa buvi', '👵', 'Моя бабушка старая.'),
    v('мудрый дедушка', 'dono bobo', '👴', 'Мой дедушка мудрый.'),
    v('высокий дядя', 'baland bo‘yli tog‘a', '🧔', 'Мой дядя высокий.'),
    v('красивая тётя', 'chiroyli xola', '👩‍🦰', 'Моя тётя красивая.'),
    v('большая семья', 'katta oila', '👨‍👩‍👧‍👦', 'У нас большая семья.'),
    v('дружные родители', 'ahil ota-ona', '🤝', 'Мои родители дружные.'),
    v('молодой человек', 'yosh yigit', '🧑', 'Он молодой человек.'),
    v('маленький ребёнок', 'kichkina bola', '🧒', 'Это маленький ребёнок.'),
    v('добрый сосед', 'mehribon qo‘shni', '🏘️', 'У нас добрый сосед.'),
    v('красивая девушка', 'chiroyli qiz', '👩‍🦱', 'Она красивая девушка.'),
    v('новый дом', 'yangi uy', '🏠', 'Это наш новый дом.'),
    v('уютная квартира', 'qulay kvartira', '🛋️', 'У нас уютная квартира.'),
    v('светлое окно', 'yorug‘ deraza', '🪟', 'В комнате светлое окно.'),
    v('интересная книга', 'qiziqarli kitob', '📖', 'Это интересная книга.'),
    v('хороший друг', 'yaxshi do‘st', '🫂', 'Он мой хороший друг.'),
    v('все вместе', 'hamma birga', '💞', 'Мы все вместе.'),
  ],
  exercise: {
    title: 'Oilani tasvirlang',
    instruction: 'Rasmga qarab oila a’zolarining tashqi ko‘rinishi va xarakteri haqida rus tilida 4–5 gap yozing. высокий, молодой, красивый, добрый, улыбчивый, серьёзный sifatlaridan foydalaning.',
    starter: 'Это моя семья. Мой папа — высокий и серьёзный. Моя мама — красивая и добрая. …',
  },
  outcomes: [
    { title: 'Моя семья', translation: 'mening oilam', tone: 'red' },
    { title: 'Какой? Какая?', translation: 'qanday?', tone: 'blue' },
    { title: 'Дружные', translation: 'ahil', tone: 'yellow' },
  ],
  sceneImage: '/lesson-scenes/day-6-family.jpg',
}

export const foundationLessons: Record<number, LessonData> = {
  1: lesson1,
  2: lesson2,
  3: lesson3,
  4: lesson4,
  5: lesson5,
  6: lesson6,
}
