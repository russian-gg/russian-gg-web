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
    kind?: 'matching' | 'gender-houses' | 'family-crossword' | 'plural-puzzle' | 'room-builder' | 'missing-bag' | 'city-map'
    title: string
    instruction: string
    pairs: Array<{ left: string; right: string }>
    clues?: Array<{ clue: string; answer: string }>
  }
  dialogue: string[]
  questions: Array<{ question: string; answer: string }>
  vocabulary: Vocab[]
  exercise: {
    kind?: 'writing' | 'remove-clutter'
    title: string
    instruction: string
    starter: string
    items?: Array<{ item: string; phrase: string; icon: string }>
  }
  outcomes: Array<{ title: string; translation: string; tone: 'yellow' | 'blue' | 'red' }>
  sceneImage?: string
  completionMessage?: string
  completionAction?: { label: string; href: string }
}

const p = (ru: string, uz: string, icon: string, example = ru, pronunciation?: string): Phrase => ({
  ru: ru.replace(/[а-яё]/u, (letter) => letter.toLocaleUpperCase('ru-RU')),
  uz, icon, example, pronunciation,
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
    examples: ['А', 'О', 'У', 'ма́ма', 'па́па', 'па́нда', 'до́м', 'сто́л', 'по́рт', 'сту́л', 'му́ж'],
  },
  grammar: {
    title: 'Rodlar haqida ertak',
    mascot: 'penguin',
    lead: 'Rodlar qirolliklariga xush kelibsiz!',
    body: [
      'Olis zamonlarda OT (имя существительное) nomli katta qirollik bo‘lgan. Uning ichiga “kim?” hamda “nima?” savollariga javob bo‘ladigan barcha so‘zlar kirgan ekan. So‘zlar shunchalik ko‘p ekanki, ularni boshqarish qiyinlashibdi. Shunda barcha otlar uchta kichik qirollikka ajratilib saralanibdi.',
      '🐧 Pingvin qirolligi (Мужской род — Синий / 🐧) undosh harf va -ь bilan tugagan so‘zlarni o‘z hududiga tanlab olibdi: друг, день, папа. Ular faxr bilan: «он мой», deyishadi.',
      '🐼 Panda qirolligi (Женский род — Красный / 🐼) esa -а, -я, -ь harflari bilan tugagan so‘zlarni o‘z hududiga kiritibdi: мама, земля, фамилия. Ular ohista: «она моя», deb shivirlashadi.',
      '🪶 Pat qirolligi (Средний род — Жёлтый / 🪶) -о, -е, -ё harflari bilan tugagan jonsiz narsalarni saralab olibdi: утро, имя, здание. Ular ishonch bilan: «оно моё», deb aytadi.',
      'Pingvin, Panda va Pat qirolliklari hozirgi kunda ham rus tilini o‘rganishingizning asosi bo‘lib kelmoqda.',
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
    kind: 'gender-houses',
    title: 'Rangli uy',
    instruction: 'So‘zni pastdagi mos rangli uyga sudrang. Telefonda xohlasangiz so‘zni, keyin uyni bosishingiz ham mumkin.',
    pairs: [
      { left: 'дом', right: 'Мужской род' }, { left: 'квартира', right: 'Женский род' },
      { left: 'окно', right: 'Средний род' }, { left: 'сосед', right: 'Мужской род' },
      { left: 'ключ', right: 'Мужской род' }, { left: 'чай', right: 'Мужской род' },
      { left: 'этаж', right: 'Мужской род' }, { left: 'лестница', right: 'Женский род' },
      { left: 'дверь', right: 'Женский род' }, { left: 'комната', right: 'Женский род' },
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
    v('очень приятно', 'tanishganimdan xursandman', '🤝', 'Очень приятно!'),
    v('как вас зовут', 'ismingiz nima', '❓', 'А как вас зовут?'),
    v('где', 'qayerda', '📍', 'Где вы живёте?'),
    v('жить', 'yashamoq', '🏘️', 'Я живу на пятом этаже.'),
    v('пятый', 'beshinchi', '5️⃣', 'Я живу на пятом этаже.'),
    v('второй', 'ikkinchi', '2️⃣', 'А я на втором.'),
    v('пригласить', 'taklif qilmoq', '🫖', 'Я хочу пригласить вас на чай.'),
    v('мой', 'mening', '🙋', 'Это мой дом.'),
    v('ваш', 'sizning', '👉', 'Это ваш ключ?'),
    v('рядом', 'yaqinida', '📌', 'Мой сосед живёт рядом.'),
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

const lesson7: LessonData = {
  day: 7,
  titleRu: 'В гостях — кто пришёл?',
  titleUz: 'Mehmonda — kimlar keldi?',
  tests: [
    {
      question: 'Qaysi so‘zda Д yumshoq talaffuz qilinadi?',
      options: ['дым', 'день', 'дом'],
      correct: 1,
      feedback: '«день» so‘zida Д yumshoq aytiladi, chunki undan keyin е kelgan: [д’эн’].',
    },
    {
      question: 'Qaysi variantda otning ko‘plik shakli to‘g‘ri tuzilgan?',
      options: ['книга — книги', 'окно — окны', 'брат — браты'],
      correct: 0,
      feedback: '«книга» -а bilan tugaydi, shuning uchun ko‘plikda «книги» bo‘ladi. «окно — окна», «брат — братья».',
    },
  ],
  phonetics: {
    title: 'Qattiq Д va yumshoq Д’',
    mascot: 'penguin',
    lead: '[Д] qattiq aytilganda til uchi yuqori tishlarga tegadi; [Д’] yumshoq aytilganda til o‘rtasi tanglayga ko‘tariladi.',
    body: [
      'е, ё, ю, я, и va ь harflari o‘zidan oldingi undoshni yumshatadi. Masalan: день va диван so‘zlarida Д yumshoq aytiladi.',
      'Juftliklarni avval sekin, keyin tabiiy tezlikda takrorlang. Qattiq va yumshoq tovush orasidagi farqni tinglang.',
    ],
    examples: ['да — дя', 'до — дё', 'ду — дю', 'ды — ди', 'дэ — де', 'дом', 'дядя', 'вода', 'дедушка', 'диван', 'дверь'],
  },
  grammar: {
    title: 'Otlarning ko‘plik shakli',
    mascot: 'panda',
    lead: 'Rus tilida otlarning ko‘pligi so‘zning oxiriga qarab -ы, -и, -а yoki -я yordamida yasaladi.',
    body: [
      '-а/-я bilan tugagan otlarda ko‘pincha -ы/-и ishlatiladi: мама — мамы, книга — книги. Undosh bilan tugagan otlarda ham odatda -ы/-и keladi: стол — столы, врач — врачи.',
      '-о bilan tugagan ot -а, -е bilan tugagan ot -я oladi: окно — окна, море — моря. Ayrim so‘zlar istisno: дом — дома, брат — братья, друг — друзья, ребёнок — дети.',
    ],
    examples: ['мама — мамы', 'книга — книги', 'окно — окна', 'море — моря', 'стол — столы', 'врач — врачи', 'брат — братья', 'друг — друзья', 'стул — стулья', 'ребёнок — дети'],
  },
  phrases: [
    p('У меня есть братья.', 'Mening akalarim bor.', '👬'),
    p('У меня есть сёстры.', 'Mening opa-singillarim bor.', '👭'),
    p('У нас есть друзья.', 'Bizning do‘stlarimiz bor.', '🫂'),
    p('Мои родители — дома.', 'Mening ota-onam uyda.', '👨‍👩‍👧‍👦'),
    p('Мы сидим за столом.', 'Biz dasturxon atrofida o‘tiramiz.', '🍽️'),
    p('На столе лежат книги.', 'Stolda kitoblar yotibdi.', '📚'),
    p('Там стоят чашки.', 'U yerda piyolalar turibdi.', '☕'),
    p('У нас есть гости.', 'Bizda mehmonlar bor.', '🎉'),
    p('Мои друзья — весёлые.', 'Mening do‘stlarim quvnoq.', '😄'),
    p('Наши дети играют.', 'Bizning bolalar o‘ynayapti.', '🧸'),
    p('В комнате есть стулья.', 'Xonada stullar bor.', '🪑'),
    p('Мы едим пироги.', 'Biz piroglar yeyapmiz.', '🥧'),
    p('Мы пьём чай.', 'Biz choy ichyapmiz.', '🫖'),
    p('Гости уходят домой.', 'Mehmonlar uyga ketishyapti.', '🚪'),
    p('Хорошие выходные!', 'Yaxshi dam olish kunlari!', '✨'),
  ],
  game: {
    kind: 'plural-puzzle',
    title: 'Pazlni yig‘',
    instruction: 'Birlikdagi so‘zni tanlang, keyin uning to‘g‘ri ko‘plik shaklini bosing. Har bir to‘g‘ri javob suratning bir qismini ochadi.',
    pairs: [
      { left: 'брат', right: 'братья' },
      { left: 'сестра', right: 'сёстры' },
      { left: 'окно', right: 'окна' },
      { left: 'гость', right: 'гости' },
      { left: 'друг', right: 'друзья' },
      { left: 'стул', right: 'стулья' },
    ],
  },
  dialogue: [
    'Пингвин: У меня есть братья и сёстры. А у тебя?',
    'Панда: У меня есть друзья. Мы сидим за столом. На столе лежат книги и стоят чашки.',
    'Пингвин: У нас есть гости. Мои друзья — весёлые. Наши дети играют.',
    'Панда: В комнате есть стулья. Мы едим пироги и пьём чай.',
    'Пингвин: Гости уходят домой.',
    'Панда: Хорошие выходные!',
  ],
  questions: [
    { question: 'У тебя есть братья?', answer: 'У меня есть братья.' },
    { question: 'Что на столе?', answer: 'На столе лежат книги.' },
    { question: 'Где стулья?', answer: 'В комнате есть стулья.' },
    { question: 'Что вы едите?', answer: 'Мы едим пироги.' },
    { question: 'Что делают гости?', answer: 'Гости уходят домой.' },
    { question: 'Какие у тебя друзья?', answer: 'Мои друзья — весёлые.' },
  ],
  vocabulary: [
    v('мои братья', 'mening akalarim', '👬', 'У меня есть братья.'),
    v('мои сёстры', 'mening opa-singillarim', '👭', 'У меня есть сёстры.'),
    v('наши друзья', 'bizning do‘stlarimiz', '🫂', 'У нас есть друзья.'),
    v('ваши родители', 'sizning ota-onangiz', '👨‍👩‍👧‍👦', 'Ваши родители дома?'),
    v('наши дети', 'bizning bolalarimiz', '🧸', 'Наши дети играют.'),
    v('наши гости', 'bizning mehmonlarimiz', '🎉', 'У нас есть гости.'),
    v('книги на столе', 'stoldagi kitoblar', '📚', 'На столе лежат книги.'),
    v('чашки на столе', 'stoldagi piyolalar', '☕', 'На столе стоят чашки.'),
    v('стулья в комнате', 'xonadagi stullar', '🪑', 'В комнате есть стулья.'),
    v('пироги на столе', 'stoldagi piroglar', '🥧', 'Мы едим пироги.'),
    v('весёлые друзья', 'quvnoq do‘stlar', '😄', 'Мои друзья весёлые.'),
    v('красивые сёстры', 'chiroyli opa-singillar', '🌷', 'Мои сёстры красивые.'),
    v('большие столы', 'katta stollar', '🍽️', 'В комнате большие столы.'),
    v('новые книги', 'yangi kitoblar', '📖', 'Это новые книги.'),
    v('старые дома', 'eski uylar', '🏘️', 'Там старые дома.'),
    v('светлые окна', 'yorug‘ derazalar', '🪟', 'В доме светлые окна.'),
    v('умные дети', 'aqlli bolalar', '💡', 'Наши дети умные.'),
    v('добрые родители', 'mehribon ota-ona', '🤝', 'Мои родители добрые.'),
    v('хорошие гости', 'yaxshi mehmonlar', '🎊', 'У нас хорошие гости.'),
    v('все вместе', 'hamma birga', '💞', 'Мы все вместе.'),
  ],
  exercise: {
    title: 'Mehmondagi suratni tasvirlang',
    instruction: 'Dasturxon atrofidagi odamlarni rus tilida 5–6 gap bilan tasvirlang. гости, братья, сёстры, родители, дети, стол, стулья, чашки va пироги so‘zlaridan foydalaning.',
    starter: 'На картинке я вижу гостей. Там сидят мои братья и сёстры. На столе …',
  },
  outcomes: [
    { title: 'Гости', translation: 'mehmonlar', tone: 'yellow' },
    { title: 'Множественное число', translation: 'ko‘plik shakli', tone: 'blue' },
    { title: 'Все вместе', translation: 'hamma birga', tone: 'red' },
  ],
  sceneImage: '/lesson-scenes/day-6-family.jpg',
}

const lesson8: LessonData = {
  day: 8,
  titleRu: 'Что есть в моей комнате?',
  titleUz: 'Mening xonamda nima bor?',
  tests: [
    {
      question: 'Qaysi so‘zda З yumshoq talaffuz qilinadi?',
      options: ['зуб', 'здесь', 'завод'],
      correct: 1,
      feedback: '«здесь» so‘zida З yumshoq aytiladi. «зуб» va «завод» so‘zlarida З qattiq.',
    },
    {
      question: 'Qaysi jumla to‘g‘ri tuzilgan?',
      options: ['Я есть книга.', 'У меня есть книга.', 'Меня есть книга.'],
      correct: 1,
      feedback: '«У меня есть книга» — «Menda kitob bor» degani. Egalikni aytishda «у + kishilik olmoshi + есть» ishlatiladi.',
    },
  ],
  phonetics: {
    title: 'Qattiq З va yumshoq З’',
    mascot: 'pero',
    lead: 'З tovushini aytganda ovoz paychalari ishlaydi: ariga taqlid qilgandek «з-з-з» tovushini cho‘zib ko‘ring.',
    body: [
      'Qattiq [З] а, о, у, ы, э oldidan; yumshoq [З’] esa е, ё, ю, я, и yoki ь oldidan aytiladi.',
      '«зима» so‘zini «зыма» deb aytmang. Avval juftliklarni, keyin so‘zlarni tinglab takrorlang.',
    ],
    examples: ['за — зя', 'зо — зё', 'зу — зю', 'зы — зи', 'зэ — зе', 'завод', 'зима', 'зуб', 'зеркало', 'музыка', 'здесь'],
  },
  grammar: {
    title: '«У меня есть» — menda bor',
    mascot: 'panda',
    lead: 'Biror narsa kimdadir borligini aytish uchun «у + kishilik olmoshi + есть» konstruktsiyasi ishlatiladi.',
    body: [
      'У меня есть стол. У тебя есть книга? У него есть окно. У нас есть друзья. У них есть машина.',
      '«Есть» bu yerda «bor, mavjud» degani va o‘zgarmaydi. «Я есть книга» deyish xato. Savolda ohangni ko‘taring: «У тебя есть книга?»; rasmiyroq shakli: «Есть ли у тебя книга?»',
    ],
    examples: ['У меня есть стол.', 'У тебя есть книга?', 'У него есть окно.', 'У нас есть друзья.', 'У них есть машина.', 'Есть ли у тебя книга?'],
  },
  phrases: [
    p('У меня есть комната.', 'Mening xonam bor.', '🚪'),
    p('В комнате есть стол.', 'Xonada stol bor.', '🪑'),
    p('У меня есть стул.', 'Mening stulim bor.', '🪑'),
    p('У меня есть кровать.', 'Mening karavotim bor.', '🛏️'),
    p('На столе есть лампа.', 'Stolda lampa bor.', '💡'),
    p('У меня есть окно.', 'Mening derazam bor.', '🪟'),
    p('Комната — светлая.', 'Xona yorug‘.', '☀️'),
    p('У меня есть шкаф.', 'Mening shkafim bor.', '🚪'),
    p('В шкафу есть одежда.', 'Shkafda kiyim bor.', '👕'),
    p('У меня есть телевизор.', 'Mening televizorim bor.', '📺'),
    p('На стене есть картина.', 'Devorda rasm bor.', '🖼️'),
    p('У меня есть компьютер.', 'Mening kompyuterim bor.', '💻'),
    p('На полу есть ковёр.', 'Polda gilam bor.', '🧶'),
    p('У меня есть цветы.', 'Mening gullarim bor.', '💐'),
    p('Моя комната — уютная.', 'Mening xonam qulay.', '✨'),
  ],
  game: {
    kind: 'room-builder',
    title: 'Xonamda nima bor?',
    instruction: 'Buyumni tanlang va xonadagi to‘g‘ri joyiga qo‘ying. To‘g‘ri joylashtirilganda buyum xonaga ko‘chadi; xato bo‘lsa joyida qoladi.',
    pairs: [
      { left: 'стол', right: 'room-centre' },
      { left: 'стул', right: 'beside-table' },
      { left: 'кровать', right: 'beside-wall' },
      { left: 'лампа', right: 'on-desk' },
      { left: 'шкаф', right: 'corner' },
      { left: 'телевизор', right: 'tv-wall' },
      { left: 'ковёр', right: 'on-floor' },
      { left: 'картина', right: 'picture-wall' },
      { left: 'цветы', right: 'near-window' },
      { left: 'компьютер', right: 'computer-desk' },
    ],
  },
  dialogue: [
    'Пингвин: У тебя есть комната?',
    'Панда: Да, у меня есть комната. У меня есть стол и стул.',
    'Пингвин: А у тебя есть кровать?',
    'Панда: Да, есть. На столе есть лампа. У меня есть окно.',
    'Пингвин: Твоя комната светлая?',
    'Панда: Да, моя комната светлая и уютная.',
    'Пингвин: У тебя есть телевизор?',
    'Панда: Нет, у меня нет телевизора. Но есть компьютер.',
  ],
  questions: [
    { question: 'У тебя есть комната?', answer: 'Да, у меня есть комната.' },
    { question: 'Что у тебя есть?', answer: 'У меня есть стол и стул.' },
    { question: 'У тебя есть кровать?', answer: 'Да, есть.' },
    { question: 'Что есть на столе?', answer: 'На столе есть лампа.' },
    { question: 'У тебя есть окно?', answer: 'Да, у меня есть окно.' },
    { question: 'Какая твоя комната?', answer: 'Моя комната светлая и уютная.' },
  ],
  vocabulary: [
    v('моя комната', 'mening xonam', '🚪', 'Моя комната светлая.'),
    v('большой стол', 'katta stol', '🪑', 'В комнате большой стол.'),
    v('новый стул', 'yangi stul', '🪑', 'У меня есть новый стул.'),
    v('моя кровать', 'mening karavotim', '🛏️', 'Это моя кровать.'),
    v('настольная лампа', 'stol ustidagi lampa', '💡', 'На столе есть лампа.'),
    v('светлое окно', 'yorug‘ deraza', '🪟', 'В комнате светлое окно.'),
    v('уютная комната', 'qulay xona', '✨', 'Моя комната уютная.'),
    v('мой шкаф', 'mening shkafim', '🚪', 'Это мой шкаф.'),
    v('чистая одежда', 'toza kiyim', '👕', 'В шкафу есть чистая одежда.'),
    v('большой телевизор', 'katta televizor', '📺', 'У меня есть большой телевизор.'),
    v('красивая картина', 'chiroyli rasm', '🖼️', 'На стене есть красивая картина.'),
    v('новый компьютер', 'yangi kompyuter', '💻', 'У меня есть новый компьютер.'),
    v('тёплый ковёр', 'iliq gilam', '🧶', 'На полу есть тёплый ковёр.'),
    v('живые цветы', 'tirik gullar', '💐', 'У меня есть живые цветы.'),
    v('светлая комната', 'yorug‘ xona', '☀️', 'Моя комната светлая.'),
    v('мой друг', 'mening do‘stim', '🫂', 'Это мой друг.'),
    v('интересная книга', 'qiziqarli kitob', '📖', 'У меня есть интересная книга.'),
    v('новая квартира', 'yangi kvartira', '🏢', 'У нас новая квартира.'),
    v('старый дом', 'eski uy', '🏠', 'Это старый дом.'),
    v('свободное место', 'bo‘sh joy', '⬜', 'В комнате есть свободное место.'),
  ],
  exercise: {
    title: 'Mening xonam',
    instruction: 'Xona ichidagi stol, stul, karavot, shkaf, televizor, gilam, gullar, telefon va derazani tasvirlab, rus tilida 6–7 gap yozing. «У меня есть» konstruktsiyasidan foydalaning.',
    starter: 'У меня есть комната. В комнате есть стол и стул. На столе …',
  },
  outcomes: [
    { title: 'Моя комната', translation: 'mening xonam', tone: 'red' },
    { title: 'У меня есть', translation: 'menda bor', tone: 'blue' },
    { title: 'Уютно и светло', translation: 'qulay va yorug‘', tone: 'yellow' },
  ],
}

const lesson9: LessonData = {
  day: 9,
  titleRu: 'Опоздал! Чего нет?',
  titleUz: 'Kechikdim! Nima yo‘q?',
  tests: [
    {
      question: 'Qaysi so‘zda С yumshoq talaffuz qilinadi?',
      options: ['суп', 'синий', 'сад'],
      correct: 1,
      feedback: '«синий» so‘zida С yumshoq aytiladi, chunki undan keyin и keladi. «суп» va «сад» so‘zlarida С qattiq.',
    },
    {
      question: 'Qaysi jumla to‘g‘ri?',
      options: ['У меня нет время.', 'У меня нет времени.', 'У меня нет времяни.'],
      correct: 1,
      feedback: '«время» istisno: нет чего? — времени. To‘g‘ri shakl: «У меня нет времени».',
    },
  ],
  phonetics: {
    title: 'Qattiq С va yumshoq С’',
    mascot: 'pero',
    lead: 'Qattiq С — «са», yumshoq С’ — «ся». O‘zbek tilida bunday farq yo‘q, shuning uchun tovushni diqqat bilan tinglang.',
    body: [
      'е, ё, ю, я, и va ь harflari o‘zidan oldingi С tovushini yumshatadi. «сад» so‘zida С qattiq, «синий» so‘zida esa yumshoq aytiladi.',
      '«синий» so‘zini «сыний» deb aytmang. Juftliklarni avval sekin, keyin tabiiy tezlikda takrorlang.',
    ],
    examples: ['са — ся', 'со — сё', 'су — сю', 'сы — си', 'сэ — се', 'сад', 'синий', 'суп', 'семья', 'сосед'],
  },
  grammar: {
    title: '«У меня нет» — menda yo‘q',
    mascot: 'penguin',
    lead: 'Yo‘qlikni ifodalash uchun «у меня нет …» ishlatiladi. «Нет»dan keyin нет кого? yoki нет чего? savolini bering.',
    body: [
      'Jonli mavjudot uchun «кого?», jonsiz narsa uchun «чего?» so‘raladi. «Нет»dan keyin ot родительный падеж shakliga o‘tadi: книга — книги, стол — стола.',
      'Undosh bilan tugagan so‘zlar ko‘pincha -а/-я oladi; -а/-я esa -ы/-и ga, -о/-е esa -а/-я ga o‘zgaradi. Ko‘plikda -ов, -ей yoki nol tugash kelishi mumkin.',
      'Muhim istisnolarni yodda tuting: время — нет времени; имя — нет имени.',
    ],
    examples: ['У меня нет книги.', 'У меня нет стола.', 'У меня нет брата.', 'У меня нет ключей.', 'У меня нет времени.', 'У меня нет имени.'],
  },
  phrases: [
    p('Я опаздываю!', 'Men kechikyapman!', '⏰'),
    p('У меня нет ключей.', 'Mening kalitlarim yo‘q.', '🔑'),
    p('У меня нет телефона.', 'Mening telefonim yo‘q.', '📱'),
    p('У меня нет зарядки.', 'Mening zaryadkam yo‘q.', '🔌'),
    p('У меня нет интернета.', 'Mening internetim yo‘q.', '📶'),
    p('У меня нет денег.', 'Mening pulim yo‘q.', '💵'),
    p('У меня нет времени.', 'Mening vaqtim yo‘q.', '⌛'),
    p('У меня нет зонта.', 'Mening soyabonim yo‘q.', '☂️'),
    p('У меня нет друга.', 'Mening do‘stim yo‘q.', '🧑‍🤝‍🧑'),
    p('В машине нет бензина.', 'Mashinada benzin yo‘q.', '⛽'),
    p('В доме нет света.', 'Uyda yorug‘lik yo‘q.', '💡'),
    p('В холодильнике нет еды.', 'Muzlatgichda ovqat yo‘q.', '🍽️'),
    p('У меня нет идей.', 'Mening g‘oyam yo‘q.', '💭'),
    p('У меня нет работы.', 'Mening ishim yo‘q.', '💼'),
    p('Что делать? Не знаю.', 'Nima qilish kerak? Bilmayman.', '🤷'),
  ],
  game: {
    kind: 'missing-bag',
    title: 'Kechikdim! Nima yo‘q?',
    instruction: 'Ishga ketish uchun sumkani yig‘ing. Har safar yo‘qolgan buyum haqida to‘g‘ri gapni tanlang. Har bir javob — 10 ball, to‘liq sumka — yana 30 bonus ball.',
    pairs: [
      { left: 'ключи', right: 'У меня нет ключей.' },
      { left: 'телефон', right: 'У меня нет телефона.' },
      { left: 'зарядник', right: 'У меня нет зарядника.' },
      { left: 'кошелёк', right: 'У меня нет кошелька.' },
      { left: 'деньги', right: 'У меня нет денег.' },
      { left: 'зонт', right: 'У меня нет зонта.' },
      { left: 'очки', right: 'У меня нет очков.' },
      { left: 'наушники', right: 'У меня нет наушников.' },
    ],
  },
  dialogue: [
    'Пингвин: Ты опять опаздываешь! Что случилось?',
    'Панда: Извини! У меня нет ключей. Я не могу выйти из дома.',
    'Пингвин: У тебя нет запасных ключей?',
    'Панда: Нет, у меня нет запасных ключей.',
    'Пингвин: У тебя есть телефон? Позвони соседям.',
    'Панда: Телефон есть, но у меня нет зарядника. Он разрядился.',
    'Пингвин: У тебя есть деньги на такси?',
    'Панда: Нет, у меня нет денег.',
    'Пингвин: У меня есть ключи и деньги. Приходи ко мне.',
    'Панда: Спасибо! У тебя есть время?',
    'Пингвин: Да, у меня есть время. Жду!',
  ],
  questions: [
    { question: 'Что случилось?', answer: 'У меня нет ключей.' },
    { question: 'У тебя есть запасные ключи?', answer: 'Нет, у меня нет запасных ключей.' },
    { question: 'У тебя есть телефон?', answer: 'Телефон есть, но у меня нет зарядки.' },
    { question: 'У тебя есть деньги на такси?', answer: 'Нет, у меня нет денег.' },
    { question: 'У тебя есть время?', answer: 'Да, у меня есть время.' },
    { question: 'Что у тебя есть?', answer: 'У меня есть ключи и деньги.' },
  ],
  vocabulary: [
    v('нет ключей', 'kalitlar yo‘q', '🔑', 'У меня нет ключей.'),
    v('нет телефона', 'telefon yo‘q', '📱', 'У меня нет телефона.'),
    v('нет зарядки', 'zaryadka yo‘q', '🔌', 'У меня нет зарядки.'),
    v('нет интернета', 'internet yo‘q', '📶', 'У меня нет интернета.'),
    v('нет денег', 'pul yo‘q', '💵', 'У меня нет денег.'),
    v('нет времени', 'vaqt yo‘q', '⌛', 'У меня нет времени.'),
    v('нет зонта', 'soyabon yo‘q', '☂️', 'У меня нет зонта.'),
    v('нет друга', 'do‘st yo‘q', '🧑‍🤝‍🧑', 'У меня нет друга.'),
    v('нет бензина', 'benzin yo‘q', '⛽', 'В машине нет бензина.'),
    v('нет света', 'yorug‘lik yo‘q', '💡', 'В доме нет света.'),
    v('нет еды', 'ovqat yo‘q', '🍽️', 'В холодильнике нет еды.'),
    v('нет идей', 'g‘oya yo‘q', '💭', 'У меня нет идей.'),
    v('нет работы', 'ish yo‘q', '💼', 'У меня нет работы.'),
    v('нет документов', 'hujjatlar yo‘q', '📄', 'У меня нет документов.'),
    v('нет проездного', 'yo‘l chiptasi yo‘q', '🎫', 'У меня нет проездного.'),
    v('нет очков', 'ko‘zoynak yo‘q', '👓', 'У меня нет очков.'),
    v('нет наушников', 'quloqchin yo‘q', '🎧', 'У меня нет наушников.'),
    v('нет учебника', 'darslik yo‘q', '📘', 'У меня нет учебника.'),
    v('нет ручки', 'ruchka yo‘q', '🖊️', 'У меня нет ручки.'),
    v('нет тетради', 'daftar yo‘q', '📓', 'У меня нет тетради.'),
  ],
  exercise: {
    kind: 'remove-clutter',
    title: 'Yotoqxonani tartibga keltiring',
    instruction: 'Xonadagi ortiqcha buyumlarni bosing. Buyum yo‘qoladi va uning yo‘qligini bildiradigan ruscha gap chiqadi.',
    starter: 'В комнате нет …',
    items: [
      { item: 'чашка', phrase: 'Нет чашки.', icon: '☕' },
      { item: 'зонт', phrase: 'Нет зонта.', icon: '☂️' },
      { item: 'телефон', phrase: 'Нет телефона.', icon: '📱' },
      { item: 'ключи', phrase: 'Нет ключей.', icon: '🔑' },
      { item: 'очки', phrase: 'Нет очков.', icon: '👓' },
      { item: 'наушники', phrase: 'Нет наушников.', icon: '🎧' },
      { item: 'учебник', phrase: 'Нет учебника.', icon: '📘' },
      { item: 'тетрадь', phrase: 'Нет тетради.', icon: '📓' },
    ],
  },
  outcomes: [
    { title: 'У меня нет', translation: 'menda yo‘q', tone: 'blue' },
    { title: 'Кого? Чего?', translation: 'yo‘qlik savollari', tone: 'red' },
    { title: 'Опоздал!', translation: 'kechikdim', tone: 'yellow' },
  ],
  completionMessage: 'Azizim, 9-dars muvaffaqiyatli tugadi! Endi siz kechikish, yo‘qolgan narsalar va pul yetishmasligi haqida rus tilida gapira olasiz. «У меня нет» konstruktsiyasi sizga har kuni kerak bo‘ladi. Men sizdan faxrlanaman! Keyingi darsda shahringiz haqida gaplashamiz. Yaxshi dam oling!',
}

const lesson10: LessonData = {
  day: 10,
  titleRu: 'Мой любимый город',
  titleUz: 'Mening sevimli shahrim',
  tests: [
    {
      question: 'Qaysi so‘zda В tovushi talaffuz qilinadi?',
      options: ['фото', 'вода', 'футбол'],
      correct: 1,
      feedback: '«вода» so‘zida В — [вада]. «фото» va «футбол» so‘zlarida Ф tovushi aytiladi.',
    },
    {
      question: 'Qaysi jumla to‘g‘ri?',
      options: ['Я люблю город.', 'Я люблю городу.', 'Я люблю города.'],
      correct: 0,
      feedback: '«город» — мужской родdagi jonsiz ot, shuning uchun винительный падежda o‘zgarmaydi: «Я люблю город».',
    },
  ],
  phonetics: {
    title: 'В va Ф tovushlari',
    mascot: 'pero',
    lead: 'Ф — «фа», В — «ва». «Вода» — [вада], «фото» — [фота]. Bu tovushlarni almashtirmang.',
    body: [
      'В tovushida ovoz paychalari ishlaydi, Ф tovushida esa faqat havo chiqadi. Kaftingizni tomog‘ingizga qo‘yib farqni his qiling.',
      'Juftliklarni sekin, keyin tabiiy tezlikda ayting. «вкус» so‘zida В jarangsizlanib [фкус] kabi eshitiladi.',
    ],
    examples: ['ва — фа', 'во — фо', 'ву — фу', 'вы — фы', 'ве — фе', 'вода', 'фото', 'вид', 'фильм', 'вкус', 'Фёдор'],
  },
  grammar: {
    title: '«Вижу кого? что?»',
    mascot: 'penguin',
    lead: 'Shahardagi narsalarni tasvirlashda «вижу»dan keyin кого? yoki что? savolini bering.',
    body: [
      'Jonsiz мужской род otlari o‘zgarmaydi: вижу дом, люблю город. Jonli мужской род otlari -а/-я oladi: вижу друга, люблю папу.',
      'Женский родdagi -а/-я bilan tugagan otlar -у/-ю ga o‘zgaradi: вижу книгу, люблю улицу. Средний род o‘zgarmaydi: вижу окно, люблю море.',
      'Jonli mavjudot uchun «кого?», jonsiz narsa uchun «что?» savolini ishlating.',
    ],
    examples: ['Я вижу дом.', 'Я люблю город.', 'Я вижу друга.', 'Я люблю папу.', 'Я вижу книгу.', 'Я люблю улицу.', 'Я вижу окно.', 'Я люблю море.'],
  },
  phrases: [
    p('Я люблю свой город.', 'Men o‘z shahrimni sevaman.', '🏙️'),
    p('Я вижу красивые улицы.', 'Men chiroyli ko‘chalarni ko‘ryapman.', '🛣️'),
    p('Я знаю этот парк.', 'Men bu bog‘ni bilaman.', '🌳'),
    p('Я помню этот дом.', 'Men bu uyni eslayman.', '🏠'),
    p('Я встречаю друзей.', 'Men do‘stlarimni uchratyapman.', '🫂'),
    p('Я слышу шум города.', 'Men shahar shovqinini eshityapman.', '🔊'),
    p('Я вижу детей в парке.', 'Men parkdagi bolalarni ko‘ryapman.', '🧒'),
    p('Мы любим нашу улицу.', 'Biz ko‘chamizni sevamiz.', '🛣️'),
    p('Я помню своё детство.', 'Men bolaligimni eslayman.', '🧸'),
    p('Я вижу старые здания.', 'Men eski binolarni ko‘ryapman.', '🏛️'),
    p('Мы знаем все магазины.', 'Biz barcha do‘konlarni bilamiz.', '🏬'),
    p('Я люблю пить кофе в этом кафе.', 'Men bu kafeda kofe ichishni sevaman.', '☕'),
    p('Я вижу фонтаны.', 'Men favvoralarni ko‘ryapman.', '⛲'),
    p('Мы встречаемся у метро.', 'Biz metroda uchrashamiz.', '🚇'),
    p('Какой красивый город!', 'Qanday go‘zal shahar!', '✨'),
  ],
  game: {
    kind: 'city-map',
    title: 'Mening sevimli shahrim',
    instruction: 'Xaritadagi joyni tanlang va u haqidagi to‘g‘ri gapni toping. Har bir to‘g‘ri gap uchun 10 ball olasiz.',
    pairs: [
      { left: 'парк', right: 'Я люблю этот парк.' },
      { left: 'музей', right: 'Я вижу музей.' },
      { left: 'кафе', right: 'Я люблю пить кофе в этом кафе.' },
      { left: 'улица', right: 'Я вижу красивую улицу.' },
      { left: 'мост', right: 'Я знаю этот мост.' },
      { left: 'фонтан', right: 'Я вижу фонтан.' },
      { left: 'магазин', right: 'Я знаю этот магазин.' },
      { left: 'школа', right: 'Я помню эту школу.' },
      { left: 'вокзал', right: 'Я вижу вокзал.' },
      { left: 'театр', right: 'Я люблю этот театр.' },
    ],
  },
  dialogue: [
    'Пингвин: Привет! Ты любишь свой город?',
    'Панда: Да, я люблю свой город. Он красивый и зелёный.',
    'Пингвин: Что ты любишь делать в городе?',
    'Панда: Я люблю гулять в парке и пить кофе в кафе.',
    'Пингвин: Что ты видишь на улице?',
    'Панда: Я вижу красивые старые здания, фонтаны и людей.',
    'Пингвин: Ты знаешь все магазины?',
    'Панда: Да, я знаю все магазины в центре.',
    'Пингвин: Ты помнишь своё детство в этом городе?',
    'Панда: Да, я помню своё детство. Мы часто гуляли в парке.',
    'Пингвин: Где ты встречаешь друзей?',
    'Панда: Мы встречаемся у метро.',
  ],
  questions: [
    { question: 'Ты любишь свой город?', answer: 'Да, я люблю свой город.' },
    { question: 'Что ты любишь делать?', answer: 'Я люблю гулять в парке и пить кофе в кафе.' },
    { question: 'Что ты видишь на улице?', answer: 'Я вижу красивые старые здания, фонтаны и людей.' },
    { question: 'Ты знаешь магазины?', answer: 'Да, я знаю все магазины в центре.' },
    { question: 'Ты помнишь своё детство?', answer: 'Да, я помню своё детство.' },
    { question: 'Где ты встречаешь друзей?', answer: 'Мы встречаемся у метро.' },
  ],
  vocabulary: [
    v('любить город', 'shaharni sevmoq', '🏙️', 'Я люблю свой город.'),
    v('видеть улицу', 'ko‘chani ko‘rmoq', '🛣️', 'Я вижу красивую улицу.'),
    v('знать парк', 'bog‘ni bilmoq', '🌳', 'Я знаю этот парк.'),
    v('помнить дом', 'uyni eslamoq', '🏠', 'Я помню этот дом.'),
    v('встречать друзей', 'do‘stlarni uchratmoq', '🫂', 'Я встречаю друзей.'),
    v('слышать шум', 'shovqinni eshitmoq', '🔊', 'Я слышу шум города.'),
    v('видеть детей', 'bolalarni ko‘rmoq', '🧒', 'Я вижу детей в парке.'),
    v('любить улицу', 'ko‘chani sevmoq', '🛣️', 'Мы любим нашу улицу.'),
    v('помнить детство', 'bolalikni eslamoq', '🧸', 'Я помню своё детство.'),
    v('видеть здание', 'binoni ko‘rmoq', '🏛️', 'Я вижу старое здание.'),
    v('знать магазины', 'do‘konlarni bilmoq', '🏬', 'Мы знаем все магазины.'),
    v('любить кафе', 'kafeni sevmoq', '☕', 'Я люблю это кафе.'),
    v('видеть фонтан', 'favvorani ko‘rmoq', '⛲', 'Я вижу фонтан.'),
    v('знать метро', 'metroni bilmoq', '🚇', 'Я знаю это метро.'),
    v('встречать родителей', 'ota-onani uchratmoq', '👨‍👩‍👧', 'Я встречаю родителей.'),
    v('помнить школу', 'maktabni eslamoq', '🏫', 'Я помню эту школу.'),
    v('видеть реку', 'daryoni ko‘rmoq', '🏞️', 'Я вижу реку.'),
    v('любить мост', 'ko‘prikni sevmoq', '🌉', 'Я люблю этот мост.'),
    v('знать площадь', 'maydonni bilmoq', '🏟️', 'Я знаю эту площадь.'),
    v('помнить события', 'voqealarni eslamoq', '📅', 'Я помню эти события.'),
  ],
  exercise: {
    title: 'Mening sevimli shahrim',
    instruction: 'Sevimli shahringiz haqida rus tilida 7–8 gap yozing. любить, видеть, знать, помнить, встречать, слышать hamda парк, улица, здание, фонтан, друзья, детство, кафе so‘zlaridan foydalaning.',
    starter: 'Я люблю свой город. Он большой и красивый. Я вижу высокие здания и зелёные парки. Я знаю каждую улицу в центре. Я помню своё детство, когда мы гуляли в парке. Я встречаю друзей в кафе. Мы пьём кофе и говорим о жизни. Какой красивый город!',
  },
  outcomes: [
    { title: 'Мой город', translation: 'mening shahrim', tone: 'blue' },
    { title: 'Вижу и знаю', translation: 'ko‘raman va bilaman', tone: 'yellow' },
    { title: 'Любимые места', translation: 'sevimli joylar', tone: 'red' },
  ],
  completionMessage: '10-dars muvaffaqiyatli tugadi! Endi siz o‘z shahringiz haqida rus tilida mehr bilan gapira olasiz. Siz «вижу», «знаю», «помню», «люблю» fe’llarini ishlata olasiz. Bu A2 darajasi uchun muhim. Siz 10 ta darsni bosib o‘tdingiz — juda betakror natija! Endi Telegram botda o‘z taassurotlaringiz bilan o‘rtoqlashing. Sizning fikringiz — bizning rivojimiz!',
  completionAction: { label: 'Telegram botda fikr bildirish', href: 'https://t.me/russian_gg_bot' },
}

export const foundationLessons: Record<number, LessonData> = {
  1: lesson1,
  2: lesson2,
  3: lesson3,
  4: lesson4,
  5: lesson5,
  6: lesson6,
  7: lesson7,
  8: lesson8,
  9: lesson9,
  10: lesson10,
}
