/**
 * The source dictionary. Every other locale is typed against this object, so adding a key
 * here and forgetting it elsewhere fails the build instead of rendering a blank label.
 *
 * Only interface chrome lives here. Text the server owns — mission titles, objectives, AI
 * feedback — is content, not UI, and is localised on the server or not at all.
 */
export const uz = {
  common: {
    loading: 'Yuklanmoqda',
    retry: "Qayta urinib ko'ring",
    cancel: 'Bekor qilish',
    continue: 'Davom etish',
    back: 'Orqaga',
    close: 'Yopish',
    later: 'Keyinroq',
    understood: 'Tushunarli',
    send: 'Yuborish',
    sending: 'Yuborilmoqda...',
    notYet: "Hali yo'q",
    day: '{day}-kun',
    dayOfTotal: '{day}-kun / {total}',
    minutes: '{count} daqiqa',
    loadFailed: "Ma'lumotni yuklab bo'lmadi",
    loadFailedBody: 'Internetni tekshirib, sahifani yangilang.',
  },

  /**
   * The placement result. Every figure on this screen is measured from forty seconds of the
   * learner's own speech, so the copy around them stays plain — a number nobody believes is
   * worse than no number.
   */
  level: {
    eyebrow: 'Sizning natijangiz',
    speaking: 'Gapirish',
    comprehension: 'Tushunish',
    longestRun: "so'z — eng uzun ruscha ketma-ketligingiz",
    totalWords: "Jami so'z",
    russian: 'Ruscha',
    uzbek: "O'zbekcha",
    other: 'Boshqa til',
    spokeFor: 'Gapirdingiz',
    gaps: 'Hozir uddalay olmaysiz',
    strengths: 'Sizda allaqachon bor',
    showTranscript: "Nima deganingizni ko'rish",
    disclaimer:
      "Bu dastlabki baho, til sertifikati emas. Har bir ovozli mashqdan keyin yangilanadi.",
    planTitle: 'Obuna bilan 90 kun ichida',
    planChart: "90 kunlik gapirish darajasi o'sishi",
    today: 'Bugun',
    dayShort: '{day}-kun',
    planNote:
      "Birinchi nuqta — hozir o'lchangani. Qolgani — kunda 10 daqiqa gapirsangiz reja qayerga olib borishi.",
  },

  /**
   * The games shelf and the two arcade games that live outside the shell.
   *
   * They were written in Uzbek inline, which meant a learner who switched the product to
   * Russian or English still met the whole arcade in Uzbek. The Russian *content* — the words
   * being sorted, "Мужской" and the rest — stays Russian in every locale: it is the subject
   * being taught, not the interface.
   */
  arcade: {
    title: "O'yinlar",
    subtitle: "Gapirishni mashq qilishning eng qisqa yo'li — o'ynab.",
    newGame: 'Yangi o‘yin',
    record: 'Rekord',
    runnerTitle: 'Penguin Ice Runner',
    runnerTagline: '3D muzlik yugurishi',
    runnerBlurb:
      'Pingvinni uchta muz yo‘lakda boshqaring, Z-shakldagi tangalarni yig‘ing, muzlardan sakrang va ruscha otlarning rodini toping.',
    play: 'O‘ynash',

    runner: {
      exit: 'O‘yinlardan chiqish',
      soundOn: 'Ovozni yoqish',
      soundOff: 'Ovozni o‘chirish',
      fullscreen: 'To‘liq ekran',
      findGender: 'Rodini aniqlang',
      listen: 'So‘zni tinglash',
      introTitle: 'Rodlar bo‘ylab 3D muzlik yugurishi',
      introBody:
        'Pingvinni uchta muz yo‘lakdan boshqaring: ruscha otning rodini toping, tanga to‘lqinlarini yig‘ing va muz to‘siqlaridan sakrang.',
      rulesTitle: 'O‘yin qoidasi:',
      ruleLeft: '• Chap yo‘lak = ekrandagi chap rod',
      ruleMiddle: '• O‘rta yo‘lak = ekrandagi o‘rta rod',
      ruleRight: '• O‘ng yo‘lak = ekrandagi o‘ng rod',
      ruleCoins: '• Z-shakldagi tangalarni yig‘ing, muzlardan sakrang',
      gesture:
        'Ekranni chapga yoki o‘ngga suring — yo‘lak almashadi. Tepaga suring — pingvin sakraydi.',
      start: 'O‘yinni boshlash',
      paused: 'Pauza',
      resume: 'Davom etish',
      restart: 'Qayta boshlash',
      falling: 'Muz yorildi! Pingvin sirpanib ketdi…',
      over: 'O‘yin tugadi',
      score: 'Ball',
      coins: 'Tangalar',
      again: 'Yana o‘ynash',
      backToGames: 'O‘yinlarga qaytish',
      controlsHint: 'Chapga / o‘ngga suring — yo‘lak almashtirish · Tepaga suring — sakrash',
      left: 'Chapga (A)',
      jump: 'Sakrash',
      right: 'O‘ngga (D)',
      speed: 'Tezlik darajasi',
      lives: '{count} ta jon',
      difficulty: {
        normal: { label: 'Normal', caption: 'Hozirgi tezlik' },
        high: { label: 'High', caption: '25% tezroq' },
        expert: { label: 'Expert', caption: '50% tezroq' },
      },
      hitObstacle: 'To‘siqqa urildingiz — sakrashni unutmang!',
      correct: 'To‘g‘ri rod! +1',
      /* The word and its gender are Russian in every locale — they are what is being learnt. */
      wrong: 'Xato: «{word}» — {gender}',
    },

    saw: {
      back: "O'yinlar",
      score: 'Ball',
      question: '{n}-savol',
      keepTalking: 'Gapiring — jim turmang, arra yaqinlashadi.',
      unsupported: "Bu brauzer ovozni tanimaydi. Chrome yoki Safari'da oching.",
      micDenied: 'Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.',
      start: 'Boshlash',
      lostTitle: 'Vaa! 😱',
      lostBody: 'Arra yetib keldi. Jim qolgan payting — u yaqinlashadi.',
      retry: 'Qayta urinish',
      wonTitle: 'Omon qoldingiz! 🎉',
      wonBody: "Bir daqiqa to'xtamay gapirdingiz. Bitta ball sizniki.",
      next: 'Keyingi savol',
    },
  },

  /**
   * The first minute of an account: the spoken brief, the forty seconds, and the typed way
   * round it. It was written inline in Uzbek, which meant the one screen that decides whether
   * somebody stays was the one screen that ignored their choice of language.
   */
  placement: {
    analysing: 'Darajangiz tahlil qilinmoqda',
    analysingBody: "Aytganlaringizni o'qiyapmiz — bir necha soniya.",
    briefTitle: 'Tinglang',
    briefBody: "Nima qilish kerakligini aytib beramiz — tugagach, mikrofon o'zi ochiladi.",
    briefDone: 'Tushundim, boshlaymiz',

    typeTitle: 'Yozib bering',
    typeBody:
      "Rus tilingiz haqida bir-ikki gap: qayerda kerak, qayerda qiynalasiz. Ruscha so'zlarni bilganingizcha yozing — aralashtirsangiz ham bo'ladi.",
    typePlaceholder:
      "Men do'konda ishlayman, mijozlar ruscha so'raydi, men тушунаман lekin javob berolmayman…",
    typeSubmit: "Darajamni ko'rish",
    typeSwitchToVoice: 'Ovoz bilan aytaman',

    speakingTitle: 'Rus tilingiz haqida gapiring',
    connecting: 'Mikrofon ulanmoqda…',
    speakingHint: "O'zbekcha aralashtirsangiz ham bo'ladi — qayerda qiynalasiz?",
    permissionHint: 'Bir soniya — ruxsat so‘ralsa, “Ruxsat berish”ni bosing.',
    listening: 'Tinglayapmiz…',
    listeningHint: 'Boshlang — bir gap ham yetadi.',
    finish: 'Yakunlash',
    remaining: 'Qolgan vaqt',

    step: '1 qadam',
    introTitle: 'Rus tili darajangiz haqida aytib bering',
    introBody:
      "Mikrofonni bosing va 40 soniya gapiring. Qayerda qiynalasiz — ishdami, ko'chadami? O'zbekcha aralashtirsangiz ham bo'ladi, savol yo'q, test yo'q.",
    start: 'Gapirishni boshlash',
    startAria: 'Bosing va gapiring',
    shortIsFine: 'Qisqa javob ham yetadi',
    cantSpeak: 'Hozir gapira olmayman, yozib beraman',

    /** For the person staring at a microphone with nothing in their head. */
    cues: [
      "Ismingiz nima, qayerda ishlaysiz yoki o'qiysiz?",
      "Rus tili qayerda kerak — ishdami, ko'chadami yoki sayohatdami?",
      "O'zbekcha gapiravering, bilgan ruscha so'zlaringizni qo'shing.",
    ],

    mic: {
      denied: 'Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.',
      blocked: 'Mikrofon bloklangan. Brauzer sozlamalaridan ruxsat bering.',
      notFound: 'Mikrofon topilmadi.',
      busy: 'Mikrofonni boshqa dastur band qilgan.',
      insecure: 'Sahifani https orqali oching — mikrofon aks holda ishlamaydi.',
      failed: "Ovoz ulanmadi. Birozdan keyin urinib ko'ring.",
      scoreFailed: "Natijani hisoblab bo'lmadi. Qayta urinib ko'ring.",
    },
  },

  lessonOne: {
    eyebrow: '1-dars · A1',
    subtitle: 'Qo‘shni bilan tanishuv',
    progress: 'Dars progressi',
    sectionsDone: '{done} / {total} bo‘lim yakunlandi',
    overallLabel: 'Dars bo‘yicha umumiy natija',
    back: '← Orqaga',
    next: 'Davom etish →',
    gateTests: 'Davom etish uchun ikki testga to‘g‘ri javob bering.',
    gatePhrases: 'Davom etish uchun barcha 15 iborani oching va tinglang.',
    gateGame: 'Davom etish uchun 10 ta so‘zni to‘g‘ri rangli uyga joylang.',
    sections: {
      tests: { title: 'Yengil test', short: 'Yengil test' },
      phonetics: { title: 'Fonetik qoida', short: 'Fonetik qoida' },
      grammar: { title: 'Rodlar haqida ertak', short: 'Rodlar haqida ertak' },
      phrases: { title: '15 ta asosiy ibora', short: '15 ta ibora' },
      game: { title: 'Rangli uy', short: 'Rangli uy o‘yini' },
      missions: { title: 'Dialog va AI savollari', short: 'AI missiyasi' },
      vocabulary: { title: 'Словарь', short: 'Словарь' },
      picture: { title: 'Rasmli mashq', short: 'Rasmli mashq' },
      complete: { title: 'Dars yakuni', short: 'Dars yakuni' },
    },
    dayOneHeading: '1-kun · Dars natijasi',
    sectionsCompleted: 'Yakunlangan bo‘limlar',
    correct: 'Верно! ',
    tryAgain: 'Yana urinib ko‘ring. ',

    phonetics: {
      eyebrow: 'A, O, U va urg‘u',
      title: 'Urg‘uli unlini aniq va cho‘ziq ayting',
      body:
        'Rus tilida unlilar urg‘uli va urg‘usiz holatda turlicha talaffuz qilinadi. Hozir urg‘uli unlilarni mashq qilamiz. Urg‘u so‘z ma’nosini ham o‘zgartirishi mumkin: *за́мок* — qal’a, *замо́к* — qulf.',
      tip: 'Har bir yangi so‘zni tinglaganda, urg‘uli bo‘g‘inni balandroq va cho‘ziqroq ayting!',
    },

    grammar: {
      eyebrow: 'Rodlar haqida ertak',
      title: 'Rodlar qirolliklariga xush kelibsiz!',
      tale:
        'Olis zamonlarda *OT (имя существительное)* nomli katta qirollik bo‘lgan va uning ichiga hamma “kim?” hamda “nima?” savollariga javob bo‘ladigan so‘zlar kirgan ekan. So‘zlar shunchalik ko‘p ekanki, ularni boshqarish qiyinlashibdi. Shunda barcha otlar uchta kichik qirollikka ajratilib saralanibdi.',
      penguinTitle: '🐧 Pingvin qirolligi · Мужской род',
      penguinBody:
        'Undosh harf yoki *-й* bilan tugagan so‘zlarni o‘z ichiga tanlab olibdi (misol uchun, *дом, сосед, ключ*). Ular faxr bilan: *“он мой”* deyishadi.',
      pandaTitle: '🐼 Panda qirolligi · Женский род',
      pandaBody:
        '*-а, -я, -ь* harflari bilan tugagan so‘zlarni o‘z hududiga kirgizibdi (masalan, *квартира, лестница, дверь*). Ular ohista shivirlashadi: *“она моя”*.',
      featherTitle: '🪶 Pat qirolligi · Средний род',
      featherBody:
        'Jonsiz narsalardan aynan *-о, -е, -ё* harflari bilan tugaganlarini saralab olibdi (masalan, *окно, море, ружьё*). Ular ishonch bilan: *“оно моё”* deb aytadi.',
      ending: 'Tugashi',
      examples: 'Misollar',
      anchor: 'Kalit',
      noteTitle: 'Pingvin eslatmasi',
      note:
        'Rangni so‘zning oxiriga qarab tanlang: ko‘k — мужской, qizil — женский, sariq — средний. *дверь* kabi yumshatish belgisi bilan tugagan so‘zlarni lug‘at bilan tekshirish kerak.',
    },

    phrases: {
      title: '15 ta asosiy iborani oching',
      body: 'Vaziyat kartasini oching, 🎧 orqali tinglang va ovoz chiqarib takrorlang.',
      listen: 'Tinglash',
      stopListening: 'Tinglashni to‘xtatish',
      reveal: 'Iborani ochish',
    },

    game: {
      rulesTitle: 'O‘yin qoidasi',
      rules:
        'So‘zni to‘g‘ri rangli uyga sudrang. Telefonda so‘zni, keyin rangli uyni bosing. Har bir to‘g‘ri javob — 10 ball.',
      rulesNote:
        '🎧 tugmasi orqali urg‘uni tinglang va ovoz chiqarib takrorlang. AI missiyasida to‘g‘ri urg‘u alohida tekshiriladi.',
      words: 'So‘zlar',
      points: 'ball',
      house: 'uy',
      dropHere: 'So‘zni shu yerga tashlang',
      retryWord: '— qayta urinib ko‘ring',
      solved: '✓ Ajoyib! 10 ta so‘zning rodi to‘g‘ri topildi — {points} ball.',
    },

    missions: {
      dialogueTitle: 'Namunaviy dialog',
      moreLines: 'Keyingi replikalar',
      aiAsksTitle: 'AI sizdan so‘raydi',
      expected: 'Kutilgan javob: {answer}',
      aiChecks:
        'AI urg‘u (сосе́д, кварти́ра, этаже́), unlilar talaffuzi va javobning to‘liqligini tekshiradi.',
      readyTitle: 'Ovozli missiyaga tayyormisiz?',
      readyBody:
        'AI yuqoridagi 6 ta savolni ketma-ket beradi. Siz mikrofon orqali javob berasiz; AI urg‘u, talaffuz va javobning to‘liqligini tekshiradi.',
      startAi: '🎙️ 6 ta AI savolini boshlash',
      rolePlayHint: 'Yuqoridagi namunaviy dialogni rollarga bo‘lib mashq qiling:',
      startDialogue: '🐧🐼 Dialogni AI bilan mashq qilish',
      dialogueLoading: 'Dialog tayyorlanmoqda…',
      dialogueFailed: 'Dialogni yuklab bo‘lmadi. Sahifani yangilab ko‘ring.',
      dialogueMissing: 'Dialog missiyasi topilmadi.',
    },

    vocabulary: {
      intro: 'Bitta kartani oching, tarjimasini ko‘ring va bilganingizni belgilang.',
      cards: '{count} ta karta',
      tapToOpen: 'Bosib oching',
      deckTitle: 'Yangi so‘zlar kolodasi',
      deckBody: 'Tarjima kartaning orqa tomonida. Bilganingiz o‘ngga, bilmaganingiz chapga ketadi.',
      startCards: 'Kartalarni boshlash →',
      close: 'Yopish',
      finishedTitle: 'Koloda tugadi',
      finishedBody:
        '{known} ta so‘zni bildingiz, {unknown} tasini yana mashq qilasiz. Qolgan kartalar takrorlash uchun saqlandi.',
      restart: 'Qayta boshlash',
      seeFront: 'Kartaning old tomonini ko‘rish',
      seeTranslation: 'Tarjimani ko‘rish',
      russianPhrase: 'Ruscha ibora',
      tapForTranslation: 'Kartani bosing — tarjimasini ko‘ring',
      translation: 'O‘zbekcha tarjima',
      sampleSentence: 'Namunaviy gap',
      hearIt: 'Talaffuzni tinglash',
    },

    picture: {
      sceneLabel: 'Eshik oldida kalit ushlab turgan kishi va uning qo‘shnisi',
      personWithKey: 'Kalit ushlagan kishi',
      key: 'Kalit',
      neighbour: 'Qo‘shni',
      tea: 'Choy',
      eyebrow: 'Mashq',
      title: 'Rasmni rus tilida 3–4 gap bilan tasvirlang',
      body: 'Eshik oldidagi odamlar, kalit va choy taklifiga qarang. Quyidagi so‘zlardan foydalaning:',
      sample: 'Namuna',
    },

    complete: {
      badge: '1-dars muvaffaqiyatli tugadi',
      title: 'Ajoyib!',
      body:
        'Endi siz qo‘shningiz bilan tanisha olasiz, o‘zingizni tanishtira olasiz va rus tilida taklif qilishni bilasiz. Shunday davom eting — bu sizning ilk qadamingiz!',
      meetTitle: 'Tanishuv',
      meetBody: 'Ismingizni ayta olasiz.',
      homeTitle: 'Uy va qo‘shni',
      homeBody: 'Manzil haqida gapirasiz.',
      inviteTitle: 'Taklif',
      inviteBody: 'Choyga taklif qilasiz.',
      practiceAi: 'AI suhbatni mashq qilish',
      seeProgress: 'Progressni ko‘rish',
      restart: 'Darsni qayta boshlash',
    },
  },

  lesson: {
    eyebrow: '{day}-dars · A1',
    progress: 'Dars progressi',
    sectionsOf: '{done} / {total} bo‘lim',
    back: '← Orqaga',
    next: 'Davom etish →',
    finishLesson: 'Darsni yakunlash',
    tryAgain: 'Yana urinib ko‘ring.',

    sections: {
      tests: 'Yengil test',
      phonetics: 'Fonetik qoida',
      grammar: 'Grammatik qoida',
      genderTale: 'Rodlar haqida ertak',
      phrases: 'Kun frazalari',
      game: 'Kreativ o‘yin',
      missions: 'Dialog',
      vocabulary: 'Словарь',
      picture: 'Rasmli mashq',
      complete: 'Dars yakuni',
    },

    gate: {
      tests: 'Davom etish uchun barcha testlarga to‘g‘ri javob bering.',
      phrases: 'Davom etish uchun barcha iboralarni ochib, baholang.',
      game: 'Davom etish uchun o‘yinni oxirigacha yeching.',
      dialogue: 'Davom etish uchun avval dialogni oxirigacha mashq qiling.',
      aiChat: 'Endi AI bilan suhbatga o‘ting.',
      vocabulary: 'Davom etish uchun kamida {count} ta kartani ko‘rib chiqing.',
      picture: 'Davom etish uchun mashq javobini yozing.',
    },

    rule: {
      listen: 'Qoidani tinglash',
      speed: { slow: 'Sekin', normal: 'Oddiy', fast: 'Tez' },
      tongueTwister: 'Скороговорка · tez aytish mashqi',
      tongueTwisterHint: 'Avval sekin, keyin oddiy tezlikda, so‘ng tez ayting.',
      penguinKingdom: 'Pingvin qirolligi',
      pandaKingdom: 'Panda qirolligi',
      featherKingdom: 'Pat qirolligi',
    },

    phrases: {
      intro:
        'Iborani tanlang. U karta shaklida ochiladi: vaziyat, talaffuz, namuna gap va eslab qolish holati bir joyda.',
      open: 'Kartani oching',
      close: 'Yopish',
      example: 'Namuna gap',
      repeat: 'Tinglang va takrorlang!',
    },

    game: {
      words: 'So‘zlar',
      swipe: 'Yon tomonga suring →',
      hearWord: '{word} so‘zini tinglash',
      allPlaced: 'Barcha so‘zlar joylashtirildi! ✓',
      wrongHouse: '— bu uyga mos emas, yana urinib ko‘ring',
      pairs: 'Juftlar',
      points: 'ball',
      missingFromBag: 'Sumkada nima yo‘q?',
      bagReady: 'Sumka tayyor!',
      bagBonus: 'Ishga o‘z vaqtida yetib keldingiz. +30 bonus ball!',
      ready: 'Tayyor',
      cityMap: 'Shahar xaritasi',
      pickTrueSentenceSuffix: 'haqida to‘g‘ri gapni tanlang:',
      cityDone: 'Shahar xaritasi tayyor!',
      cityDoneBody: '10 ta sevimli joy haqida to‘g‘ri gap tuzdingiz — 100 ball!',
      guestsAndFamily: 'Mehmonlar va oila bir xonada',
      pickPluralSuffix: 'so‘zining ko‘pligini tanlang:',
      objects: 'Buyumlar',
      roomReady: 'Xona tayyor! ✓',
      wrongPlace: 'Bu buyumning joyi boshqa. Yana urinib ko‘ring.',
      pickSpotSuffix: 'uchun xonadagi mos joyni bosing.',
      familyPhoto: 'Oilaviy surat',
      familyPhotoAlt: 'Panda va Pingvin bilan oilaviy surat',
    },

    missions: {
      practiseDialogue: 'Dialogni mashq qiling',
      aiChat: 'AI bilan suhbat',
      intro:
        'Har bir qatorni tinglang va ovoz chiqarib takrorlang. Butun dialogni mashq qilib bo‘lgach, AI bilan suhbatga o‘tasiz.',
      goToAi: 'AI bilan suhbatga o‘tish →',
      nextLine: 'Keyingi qator',
      backToDialogue: '← Dialogga qaytish',
      step: '{n}-qadam',
      mic: 'Mikrofon',
      stopRecording: 'Yozishni to‘xtatish',
      twoNeighbours: 'Ikki qo‘shni suhbati',
    },

    vocabulary: {
      cards: '{count} ta karta',
      deckTitle: 'Yangi so‘zlar kolodasi',
      open: 'Ochish',
      resume: 'Davom ettirish',
      listenAndRepeat: 'Tinglang va takrorlang',
      tapForFront: 'Old tomon uchun kartani bosing',
      known: 'выучил',
      unknown: 'не знаю',
      again: 'повторю',
    },

    exercise: {
      familyPhoto: 'Oila surati',
      template: 'Shablon',
      placeholder: 'Javobingizni shu yerga yozing…',
      listenToText: 'Matnni tinglash',
      sample: 'Namuna',
    },

    complete: {
      badge: '{day}-dars muvaffaqiyatli tugadi',
      title: 'Ajoyib!',
      body:
        'Bugungi iboralar, qoida, o‘yin va ovozli mashqlar yakunlandi. Yangi bilimlarni keyingi suhbatda ishlating.',
    },

    audio: {
      play: 'Tinglash',
      pause: 'Pauza',
    },
  },

  dayPreview: {
    description:
      'Bu darsda yangi qoida va iboralarni o‘rganib, ularni interaktiv mashqlarda mustahkamlaysiz.',
    start: 'Darsni boshlash',
    resume: 'Darsni davom ettirish',
    repeat: 'Darsni takrorlash',
    close: 'Yopish',
    lessonDay: '{day}-dars',
    sections: 'bo‘lim',
    completed: 'Yakunlangan',
    dayBadge: '{day}-kun',
    perDay: '/kun',
    telegram: 'Telegram orqali bog‘lanish',
    stopListening: 'Eshitishni to‘xtatish',
    geminiReply: 'Gemini javobi',
    attachmentNote:
      'Hozircha faylning nomi izoh bilan birga saqlanadi. Kerak bo‘lsa keyin to‘liq uploadni ham ulaymiz.',
  },

  nav: {
    today: 'Bugungi dars',
    todayShort: 'Bugun',
    path: "90 kunlik yo'l",
    pathShort: '90 kun',
    practice: 'Topshiriqlar',
    practiceShort: 'Topshiriq',
    tests: 'Testlar',
    testsShort: 'Testlar',
    games: "O'yinlar",
    gamesShort: "O'yin",
    progress: 'Progress',
    progressShort: 'Progress',
    main: 'Asosiy',
    daysDone: '{count} kun bajarildi',
    comingSoon: 'Tez orada',
    skipToContent: 'Asosiy qismga o‘tish',
  },

  account: {
    menu: 'Hisob',
    learner: 'Talaba',
    profile: 'Profil',
    billing: "Obuna va to'lovlar",
    settings: 'Sozlamalar',
    feedback: 'Fikr bildirish',
    signOut: 'Chiqish',
    darkMode: "Qorong'i rejim",
    language: 'Til',
    speed: 'Tezlik',
    soundOn: 'Ovoz yoqilgan',
    soundOff: "Ovoz o'chiq",
    plan: {
      free: 'Bepul',
      pro: 'Pro',
      trial: 'Pro · sinov',
      ending: 'Pro · tugaydi',
      pastDue: "To'lov kutilmoqda",
    },
  },

  landing: {
    headline: '90 kunda ish va kundalik hayot uchun rus tilida gapiring.',
    body:
      "Siz rus tilini tushunasiz, lekin gapirishga ishonchingiz yo'q. Bu yerda har kuni " +
      "15–20 daqiqa ovozli mashq qilasiz — haqiqiy vaziyatlarda, o'zbek tilidagi qo'llab-quvvatlash bilan.",
    cta: 'Darajangizni aniqlang · 2 daqiqa',
    signIn: 'Kirish',
    milestone7: "O'zingizni tanishtirasiz va oddiy savollarga javob berasiz.",
    milestone30: 'Hamkasb va rahbar bilan qisqa suhbatni olib borasiz.',
    milestone90: 'Ish va kundalik vaziyatlarni mustaqil hal qilasiz.',
    disclaimer:
      "Russian.gg — amaliy gapirish mashqi. Bu rasmiy til sertifikati yoki imtihonga " +
      "tayyorgarlik kursi emas, va jonli o'qituvchi o'rnini bosmaydi.",

    nav: {
      getStarted: 'Bepul boshlash',
      signIn: 'Kirish',
      method: 'Qanday ishlaydi',
      games: "O'yinlar",
      pricing: 'Narxlar',
    },

    hero: {
      eyebrow: "O'zbeklar uchun rus tili murabbiysi",
      primaryCta: 'Bepul boshlash',
      secondaryCta: 'Darajangizni bepul aniqlang',
      socialProof: "2 500+ o'quvchi allaqachon rus tilida gapiryapti.",
      trustNote: 'Karta talab qilinmaydi',
      mockDay: '3-kun',
      mockObjective: 'Tanishuv',
      mockHint: "Salomlashing va ismingizni ayting.",
      mockAction: 'Gapiring',
    },

    stats: {
      eyebrow: 'Traksiya',
      title: "O'sishimiz — raqamlarda",
      subtitle: "Investorlar uchun ham, o'quvchilar uchun ham: mana haqiqiy ko'rsatkichlar.",
      learners: "o'quvchi",
      active: 'oylik faol foydalanuvchi',
      installRate: 'tashrifchi ilovani telefoniga o‘rnatadi',
      opens: 'oylik ilova ochilishi',
      note: "Ko'rsatkichlar so'nggi 30 kun bo'yicha.",
    },

    method: {
      eyebrow: 'Qanday ishlaydi',
      title: 'Har kuni 15–20 daqiqa. Ovoz bilan.',
      subtitle:
        "Test yechish emas — gapirish. Har bir mashq haqiqiy vaziyatga asoslangan.",
      step1Title: 'Gapiring',
      step1Body: "AI murabbiy bilan haqiqiy vaziyatlarda ovozli suhbat quring.",
      step2Title: 'Darhol tuzatish',
      step2Body: "Har bir javobdan keyin bitta kuchli tomon va bitta aniq tuzatish.",
      step3Title: 'Har kuni oldinga',
      step3Body: "Progress ko'rinib turadi: kun sayin yangi vaziyat, yangi so'z.",
      milestonesTitle: "90 kunlik yo'l",
    },

    games: {
      eyebrow: "O'yinlar",
      title: "Mashqni o'yinga aylantiring",
      subtitle: 'Gapirish va grammatikani o‘yin orqali refleksga aylantiring.',
      runnerTitle: 'Род-раннер',
      runnerBody:
        "So'zlarni jinsi bo'yicha ajrating — yugurib borarkansiz. Rus tilidagi род refleksga aylanadi.",
      sawTitle: 'Лазер',
      sawBody:
        'Savol beriladi, lazer sizga tomon suriladi. Gapirsangiz — orqaga chekinadi. Bir daqiqa gapirib qoling.',
    },

    creators: {
      eyebrow: 'Ular biz haqimizda gapiryapti',
      title: 'Bloggerlar va UGC ijodkorlari',
      subtitle:
        "Har oy minglab o'quvchi Instagram va ijodkorlar videolari orqali keladi.",
      channelStat: 'Instagram orqali oylik tashrif',
      watch: "Ko'rish",
    },

    mobile: {
      eyebrow: 'Mobil',
      title: 'Telefoningizda — xuddi ilovadek',
      body:
        "Russian.gg'ni bosh ekranga qo'shing: to'liq ekran, push eslatmalar, oflayn tayyor. Endi mahalliy iOS va Android ilovalari ustida ishlayapmiz.",
      pwaTitle: 'Hozir: veb-ilova',
      pwaBody: 'Bir bosishda telefon bosh ekraningizda.',
      nativeTitle: 'Mobil ilova',
      nativeBody: 'iOS va Android uchun — ishlab chiqilyapti.',
      nativeBadge: 'Tez orada',
      installedStat: 'telefonga allaqachon o‘rnatildi',
    },

    pricing: {
      eyebrow: 'Narxlar',
      title: 'Bugun bepul boshlang',
      subtitle: "Avval sinab ko'ring. Tayyor bo'lganda Pro'ga o'ting.",
      freeTitle: 'Bepul',
      freePrice: '0',
      freeUnit: "so'm",
      freeBody: 'Boshlash uchun',
      freeFeatures: [
        'Darajangizni aniqlash',
        'Dastlabki kunlar',
        "O'yinlar",
        "O'zbekcha qo'llab-quvvatlash",
      ],
      freeCta: 'Bepul boshlash',
      proTitle: 'Pro',
      proPrice: '119 000',
      proUnit: "so'm / oy",
      proBadge: 'Ommabop',
      proBody: "To'liq 90 kunlik kurs",
      proFeatures: [
        'Barcha 90 kun missiyalari',
        'Cheksiz ovozli mashq',
        "Barcha o'yinlar",
        'Progress va tuzatishlar tahlili',
      ],
      proAlt: 'yoki 90 kun — 299 000 so‘m',
      proCta: "Pro'ni tanlash",
      payNote: "Uzcard va Humo — Click yoki Payme orqali xavfsiz to'lov.",
    },

    characters: {
      eyebrow: 'Tanish holatmi?',
      title: "Nega ko‘pchilik ruscha gapirishga qiynaladi — va biz buni qanday hal qildik?",
      subtitle:
        "Maktab va kurslarda quruq qoidalar o‘rgatiladi, ammo hayotda erkin suhbatlashish mashq qilinmaydi. Russian.gg qahramonlari buni tubdan o‘zgartiradi:",
      stage: '{n}-bosqich',
      statusProblem: 'Muammo',
      statusSolution: 'Yechim',
      voicePrefix: 'Ovoz',
      listen: 'Tinglash',
      names: { panda: 'Panda', pingvin: 'Pingvin', pero: 'Pero' },
      panda: {
        quote:
          "Ruscha so‘zlarni tushunaman, lekin odamlar oldida gapirishga kelganda tortinib qolaman…",
        caption: "Ko‘p o‘quvchilar grammatikani bilsa ham, xato qilishdan qo‘rqqani uchun gapirmaydi.",
      },
      pingvin: {
        quote:
          "Russian.gg bilan 2 haftadayoq birinchi dialoglarni boshlaysiz. Talaffuzni xijolatsiz mashq qiling!",
        caption: "Tizim xatolarni darhol ko‘rsatadi va xijolatsiz erkin mashq qilish imkonini beradi.",
      },
      pero: {
        quote: "O‘yinlar o‘ynang, giflar va rasmlar orqali so‘zlarni tez eslab qoling!",
        caption: "Kuniga 20 daqiqa interaktiv mashg‘ulot zerikarli darslardan ko‘ra ancha samarali.",
      },
      ctaTitle: "Qo‘rquvni yengib, bugunoq gapirishni boshlashga tayyormisiz?",
      ctaBody: "Birinchi bepul darsga yoziling va natijani ko‘ring.",
      ctaButton: 'Birinchi darsni boshlash',
    },

    final: {
      title: '90 kun. Har kuni 15 daqiqa. Rus tilida gapiring.',
      body: 'Bugun darajangizni bepul aniqlang.',
      cta: 'Bepul boshlash',
      signIn: 'Hisobingiz bormi? Kiring',
    },

    footer: {
      tagline: "O'zbeklar uchun rus tilini o'rganish murabbiysi. O'zbekistonda ishlab chiqilgan.",
      madeIn: "O'zbekistonda ishlab chiqilgan.",
      rights: '© 2026 Russian.gg',
      privacy: "Biz sizning ma'lumotlaringizni himoya qilamiz va ularni uchinchi shaxslarga bermaymiz.",
      platform: 'Platforma',
      useful: 'Foydali',
      company: 'Kompaniya',
      language: 'Til',
      help: 'Yordam',
      blog: 'Blog',
      test: 'Ruscha test',
      words: "So'zlar ro'yxati",
      grammar: 'Grammatika',
      about: 'Biz haqimizda',
      contact: 'Aloqa',
      privacyPolicy: 'Maxfiylik siyosati',
      terms: 'Foydalanish shartlari',
    },
  },

  auth: {
    signInTitle: 'Kirish',
    signUpTitle: "Ro'yxatdan o'tish",
    email: 'Email',
    loginIdentifier: 'Telefon raqami yoki email',
    loginIdentifierPlaceholder: '+998 90 123 45 67 yoki email',
    loginIdentifierHint:
      "Telefon orqali ro'yxatdan o'tgan bo'lsangiz, raqam va parolingizni kiriting.",
    password: 'Parol',
    passwordHint: 'Kamida 8 belgi, harf va raqam bilan.',
    displayName: 'Ism sharif',
    displayNameHint: "Ixtiyoriy: ism-sharifingizni kiriting.",
    showPassword: "Parolni ko'rsatish",
    hidePassword: 'Parolni yashirish',
    signInAction: 'Kirish',
    signingIn: 'Kirilmoqda…',
    signUpAction: 'Bepul boshlash',
    signingUp: 'Yaratilmoqda…',
    noAccount: "Hisobingiz yo'qmi?",
    goSignUp: "Ro'yxatdan o'ting",
    haveAccount: 'Hisobingiz bormi?',
    goSignIn: 'Kiring',
    or: 'yoki',
    googleContinue: 'Google bilan davom etish',
    googleSignUp: "Google bilan ro'yxatdan o'tish",
    googleWorking: 'Google bilan kirilmoqda…',
    googleUnavailable:
      'Google orqali kirish hozir ishlamayapti. Quyida email va parol bilan davom eting.',
    signInFailed: "Kirishda xatolik. Qayta urinib ko'ring.",
    signUpFailed: "Ro'yxatdan o'tishda xatolik. Qayta urinib ko'ring.",
    invalidCredentials: "Telefon raqami/email yoki parol noto'g'ri.",
    accountInactive: 'Bu hisob faol emas.',
    invalidEmail: "To'g'ri email manzilini kiriting.",
    emailTaken: 'Bu email bilan hisob allaqachon mavjud.',
    weakPassword: "Parol kamida 8 belgi bo'lib, harf va raqamdan iborat bo'lsin.",
    googleNoToken: 'Google orqali kirishda token kelmadi.',
    googleFailed: "Google orqali kirishda xatolik. Qayta urinib ko'ring.",

    reset: {
      forgot: 'Parolni unutdingizmi?',
      title: 'Parolni tiklash',
      subtitle:
        'Hisobingizga biriktirilgan raqamni kiriting. Kod yuboramiz, so‘ng yangi parol tanlaysiz.',
      submit: 'Yangi parolni saqlash',
      remembered: 'Esladingizmi?',
    },
    phone: {
      title: 'Kirish yoki ro‘yxatdan o‘tish',
      subtitle: "Telefon raqamingizni kiriting — SMS orqali tasdiqlash kodini yuboramiz.",
      registerWithPhone: 'Telefon orqali',
      registerWithEmail: 'Email orqali',
      registrationSubtitle:
        "Telefon raqamingiz bir marta SMS orqali tasdiqlanadi. Keyingi safar raqam va parol bilan kirasiz.",
      label: 'Telefon raqami',
      placeholder: '90 123 45 67',
      getCode: 'Kod olish',
      sending: 'Yuborilmoqda…',
      codeTitle: 'Tasdiqlash kodi',
      codeSentTo: '{phone} raqamiga yuborilgan 4 xonali kodni kiriting.',
      verify: 'Tasdiqlash',
      verifying: 'Tekshirilmoqda…',
      resend: 'Kodni qayta yuborish',
      resendIn: '{seconds}s dan so‘ng qayta yuborish',
      changeNumber: 'Raqamni o‘zgartirish',
      completeRegistration: "Ro'yxatdan o'tishni yakunlash",
      savePhonePassword: 'Saqlash va davom etish',
      setupTitle: 'Ism va parolni kiriting',
      setupSubtitle:
        "Telefon raqamingiz tasdiqlandi. Endi ism va keyingi kirishlar uchun parol o'rnating.",
      googleSecondary: 'Google bilan davom etish',
      googlePrimaryNote: 'Chet elda bo‘lsangiz, Google bilan kiring.',
      linkTitle: 'Telefon raqamingizni ulang',
      linkSubtitle:
        "Telefon raqamingizni bir marta tasdiqlang va parol o‘rnating. Keyingi safar raqam va parol bilan kirasiz.",
      linkDoneTitle: 'Telefon raqamingiz ulandi',
      linkDoneBody: 'Endi telefon raqamingiz va parolingiz orqali kiring.',
      linkedBanner: 'Telefon raqamingiz tasdiqlandi. Endi raqam va parol bilan kiring.',
      continue: 'Davom etish',
      numberOnOtherAccount:
        'Bu raqam boshqa hisobga biriktirilgan. Natijalaringiz o‘sha hisobda — raqam va parol '
        + 'bilan kiring, so‘ng sozlamalardan Google’ni biriktiring.',
      signInWithThatAccount: 'O‘sha hisobga kirish',
      errors: {
        invalid_phone_number: "To‘g‘ri telefon raqamini kiriting.",
        otp_invalid: "Kod noto‘g‘ri.",
        otp_expired: 'Kod muddati tugadi. Yangi kod oling.',
        otp_cooldown: 'Kod hozirgina yuborildi. Biroz kuting.',
        otp_too_many_attempts: "Juda ko‘p urinish. Yangi kod oling.",
        otp_rate_limited: "Juda ko‘p so‘rov. Birozdan so‘ng urinib ko‘ring.",
        otp_verification_expired: 'Tasdiqlash muddati tugadi. Yangi kod oling.',
        otp_unavailable: "Kodni hozir tekshira olmadik. Bir oz o'tib qayta urinib ko'ring.",
        sms_failed: "Kod yuborilmadi. Qayta urinib ko‘ring.",
        phone_taken: 'Bu raqam boshqa hisobga biriktirilgan.',
        account_not_found: 'Bu raqamga biriktirilgan hisob topilmadi.',
        phone_already_registered:
          'Bu raqam ro‘yxatdan o‘tgan. Telefon raqami va parol bilan kiring.',
        display_name_required: 'Ismingizni kiriting.',
        weak_password: "Parol kamida 8 belgi bo'lib, harf va raqamdan iborat bo'lsin.",
        account_inactive: 'Bu hisob faol emas.',
        default: "Xatolik yuz berdi. Qayta urinib ko‘ring.",
        google_taken: 'Bu Google hisobi boshqa profilga biriktirilgan.',
        google_already_linked: 'Bu hisobga allaqachon boshqa Google hisobi biriktirilgan.',
        google_email_not_verified: 'Bu Google hisobining tasdiqlangan pochtasi yo‘q.',
        email_taken: 'Bu pochta manzili boshqa profilga biriktirilgan.',
      },
    },
  },

  onboarding: {
    goalCaption: 'Maqsad',
    goalTitle: "Rus tilini nima uchun o'rganyapsiz?",
    goalWork: 'Ish uchun',
    goalWorkBody: 'Hamkasblar, rahbar va mijozlar bilan muloqot.',
    goalDaily: 'Kundalik hayot',
    goalDailyBody: "Do'kon, transport, uy-joy va xizmatlar.",
    goalBoth: 'Ikkalasi ham',
    goalBothBody: 'Ish va kundalik hayot birgalikda.',

    selfCaption: "O'z bahoyingiz",
    selfTitle: "O'zingizni qanday baholaysiz?",
    selfComprehension: 'Ruscha nutqni qanchalik tushunasiz?',
    selfSpeaking: 'Ruscha gapirishga qanchalik ishonchingiz bor?',
    scale1: 'Deyarli hech narsa',
    scale2: "Ayrim so'zlar",
    scale3: 'Oddiy gaplar',
    scale4: "Ko'p narsani",
    scale5: 'Deyarli hammasini',

    start: 'Testni boshlash',
    preparing: 'Tayyorlanmoqda...',
    testHint:
      "2 daqiqa · {count} ta savol. Ovozli savollar ixtiyoriy, istasangiz o'tkazib yuborishingiz mumkin.",
    testLoading: 'Test yuklanmoqda…',
    questionCaption: 'Savol {index} / {total}',
    voiceAnswerTitle: 'Ovozli javob',
    chooseMeaning: "Ma'noni tanlang",
    optionalQuestion:
      "Ixtiyoriy savol. Javob bersangiz gapirish darajasini aniqroq baholaymiz.",
    speakStart: 'Gapirishni boshlash',
    speakStop: "To'xtatish",
    speakAgain: 'Qayta aytish',
    speakHint: "Tugmani bosing va ruscha javob bering. Gapirib bo'lgach o'zi to'xtaydi.",
    typeInstead: 'Yozib yuboraman',
    useVoice: 'Ovoz bilan javob berish',
    writeAnswer: 'Javobingizni yozing',
    writePlaceholder: 'Masalan: Меня зовут Рустам. Я из Самарканда. Я работаю на складе.',
    submitAnswer: 'Javobni yuborish',
    skip: "O'tkazib yuborish",
    micDenied: "Mikrofonga ruxsat berilmadi. Javobingizni yozib ham yuborishingiz mumkin.",
    micFailed: "Ovozni aniqlab bo'lmadi. Javobingizni yozib yuboring.",

    gateCaption: 'Natija tayyor',
    gateTitle: 'Javoblaringiz qabul qilindi',
    gateBody:
      "Darajangiz va 90 kunlik rejangiz tayyor. Uni ko'rish va saqlab qo'yish uchun " +
      "qisqa hisob oching — javoblaringiz yo'qolmaydi.",
    gateHint: "Bir daqiqa vaqt oladi. Kartani so'ramaymiz.",
    gateCta: "Natijani ko'rish",
    gateCalculating: 'Darajangiz hisoblanmoqda',

    resultCaption: 'Natija',
    comprehension: 'Tushunish',
    speaking: 'Gapirish',
    firstMission: 'Birinchi mashqingiz',
    firstMissionFallback: 'Birinchi mashq',
    voiceTag: 'ovozli',
    estimateNote:
      "Bu dastlabki baho, rasmiy til sertifikati emas. Har bir ovozli mashqdan keyin yangilanadi.",
    begin: 'Boshlash',

    headlineA0: 'Noldan boshlaymiz',
    headlineA1: 'Oddiy iboralar sizda bor',
    headlineA2: 'Kundalik muloqotni uddalaysiz',
    headlineB1: 'Mustaqil gapira olasiz',
    headlineB2: 'Erkin gapirasiz',

    progressLabel: 'Onboarding progressi',
    startFailed: "Testni boshlashda xatolik. Qayta urinib ko'ring.",
    submitFailed: "Natijani saqlashda xatolik. Qayta urinib ko'ring.",
    resumeFailed: "Natijani saqlashda xatolik. Testni qaytadan boshlang.",
    loadFailed: "Testni yuklab bo'lmadi. Sahifani yangilang.",
  },

  home: {
    todayMission: 'Bugungi ovozli mashq',
    start: 'Mashqni boshlash',
    fallbackTitle: 'Bugungi mashq',
    empty: 'Bugunga mashq topilmadi',
    emptyBody: "90 kunlik yo'ldan boshqa mashqni tanlang yoki mashq kutubxonasiga o'ting.",
    streak: '{count} kun ketma-ket',
    seeAll: 'Barchasini ko‘rish',
    more: 'Batafsil',
    search: {
      label: 'Kurs bo‘yicha qidirish',
      placeholder: 'Kun yoki mavzuni qidiring...',
      noResults: 'Hech narsa topilmadi.',
      day: '{day}-kun',
    },
    features: {
      title: 'Asosiy imkoniyatlar',
      subtitle: 'O‘rganishni qiziqarli va samarali qiling',
      today: { title: 'Bugungi dars', body: 'Yangi bilimlar o‘rganing' },
      tasks: { title: 'Topshiriqlar', body: 'Ko‘proq mashq qiling' },
      tests: { title: 'Testlar', body: 'Bilimingizni tekshirib ko‘ring' },
      games: { title: 'O‘yinlar', body: 'O‘ynab o‘rganing' },
      progress: { title: 'Progress', body: 'Natijalaringizni kuzatib boring' },
    },
    recommended: {
      title: 'Tavsiya etilgan darslar',
      minutes: '{count} daqiqa',
    },
    quote: {
      show: '{n}-iqtibosni ko‘rsatish',
    },
    progressPanel: {
      title: 'Mening progressim',
      days: 'kun',
      done: 'Bajarilgan',
      left: 'Qolgan',
    },
    achievements: {
      title: 'Yutuqlar',
    },
    recent: {
      title: 'So‘nggi faollik',
      day: '{day}-kun',
    },
    hero: {
      eyebrow: "RUS TILINI O'RGANING",
      title: 'Kichik qadamlardan katta imkoniyatlar!',
      subtitle: 'Har kuni bir oz — erkin rus tili sari.',
      cta: 'Bugungi darsni boshlash',
    },
    activity: {
      title: 'Faollik',
      subtitle: '7 haftalik dars va kirish tarixi',
      coins: 'coin',
      streak: '{count} kun ketma-ket',
      weeks: '7 hafta',
      visited: 'Saytga kirdingiz',
      enteredAt: 'Birinchi kirish: {time}',
      lessonsCompleted: 'Tugatilgan mavzular',
      noActivity: "Bu kuni hali faollik yo'q",
      futureDay: 'Bu kun hali kelmagan',
      less: 'Kam',
      more: "Ko'p",
      day: '{day}-kun',
      coinEarned: '+1 coin olindi',
      rewardAnnounce: 'Bugungi tashrif uchun +1 coin!',
      loadFailed: "Faollik tarixini yuklab bo'lmadi.",
      weekdays: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'],
    },
  },

  path: {
    hero: {
      eyebrow: "RUS TILINI O'RGANING",
      subtitle: 'Har kuni bir oz — erkin rus tili sari.',
      dayUnit: 'kun',
      noteTitle: 'Siz buni uddalaysiz!',
      noteBody: "Har kuni o'qish — yangi imkoniyatlar sari qadam.",    },
    filterPro: 'Pro kerak',
    inProgress: 'Jarayonda',
    title: "90 kunlik yo'l",
    subtitle: "Har kuni bitta aniq vazifa — yurgan sari yo'l ochiladi.",
    today: 'Bugun',
    done: 'Bajarilgan',
    locked: 'Yopiq',
    needsPro: 'Pro kerak',
    missions: 'Mashqlar',
    preparing: 'Bu kun uchun mashqlar tayyorlanmoqda.',
    aboutMission: 'Mashq haqida',
    willLearn: "Bugun o'rganasiz",
    phraseCount: '{count} ta ibora',
    voicePractice: 'AI suhbat mashqi',
    levelLabel: '{level} daraja',
    tutorTitle: 'AI ustoz bilan suhbat',
    tutorBody: "Siz bilan rus tilida suhbatlashadi, talaffuz va iboralarni o'rgatadi.",
    startConversation: 'Suhbatni boshlash',
    lockedFallback: 'Bu mashq hozir yopiq.',
    lockedProTitle: '{day}-kun Pro tarkibida',
    lockedProBody:
      'Bepul rejada birinchi 3 kun ochiq. Qolgan 87 kunni va mashq kutubxonasini Pro ochadi.',
    lockedProgressTitle: 'Bu kun hali yopiq',
    lockedProgressBody:
      "Avval oldingi kunlarni yakunlang — shundan keyin {day}-kun o'zi ochiladi.",
    buyPro: 'Pro sotib olish',
    filterAll: 'Barchasi',
    filterActive: 'Jarayonda',
    filterDone: 'Bajarilgan',
    search: 'Kun yoki mavzuni qidiring',
    noResults: 'Mos keladigan kun topilmadi.',
  },

  preview: {
    whatToExpect: 'Nimani kutish mumkin',
    missionEyebrow: 'Topshiriq',
    goal: 'Maqsad',
    time: 'Vaqt',
    phrases: 'Iboralar',
    phrasesValue: '{count} ta ibora',
    passMark: "O'tish bali",
    passValue: 'Kamida {score}%',
    conversationBody:
      "Sherigingiz gapiradi — siz ovoz bilan javob berasiz. Maqsadga yetganingizda yoki vaqt " +
      'tugaganda suhbat yakunlanadi.',
    stepsBody:
      "Yangi iboralarni ko'rib chiqasiz, so'ng ularni ovoz bilan takrorlab mustahkamlaysiz.",
    registerNote: "Bu suhbat uslubiga e'tibor bering — u har joyda ham mos kelavermaydi.",
  },
  practice: {
    title: 'Topshiriqlarni bajarishga tayyormisiz?',
    subtitle:
      "Kun davomida kerak bo'ladigan suhbat va iboralarni topshiriqlarni bajarish orqali " +
      "oson va tez o'rganing.",
    empty: "Hozircha topshiriq yo'q",
    emptyBody: "90 kunlik yo'ldan davom eting — mashqlar tayyorlanmoqda.",
    start: 'Bajarish',
    bestScore: 'Eng yaxshi natija: {score}%',
    passMark: "O'tish bali: {score}%",
    notTried: 'Hali urinilmagan',
  },

  tests: {
    title: 'Testlar',
    comingTitle: 'Tayyorlanmoqda',
    comingBody: "Tez orada sizga bir dunyo testlar ko'rinadi.",
  },

  progress: {
    title: 'Progress',
    confidence: 'Gapirishga ishonch',
    confidenceEmpty: "Birinchi ovozli mashqdan keyin paydo bo'ladi.",
    comprehension: 'Tushunish',
    speaking: 'Gapirish',
    levelNote: "Daraja har bir mashqdan keyin yangilanadi. Bu rasmiy til sertifikati emas.",
    skills: "Ko'nikmalar",
    repairs: 'Mustahkamlash darslari',
    repairEvidence: '{count} ta mashqda kuzatildi.',
    milestones: 'Bosqichlar',
    totalMissions: 'Jami {count} ta mashq bajarildi.',
    days30: '{delta} · 30 kun',
    daysLeft: '{count} kun qoldi',
  },

  voiceErrors: {
    connect_failed: "Ovozli aloqaga ulanib bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.",
    connection_closed: "Ovozli aloqa uzildi. Qayta ulanmoqda…",
    unreadable_response: "AI javobini o'qib bo'lmadi. Yana bir marta gapiring.",
    turn_timeout: "AI javobi juda cho'zilib ketdi. Yana bir marta urinib ko'ring.",
    mic_insecure: "Mikrofon uchun xavfsiz ulanish (HTTPS) kerak.",
    mic_unsupported: "Bu brauzer mikrofonni qo'llamaydi. Chrome yoki Safari'da oching.",
    mic_denied:
      "Mikrofonga ruxsat berilmadi. Brauzer chiqargan oynada Allow ni bosing.",
    mic_blocked:
      "Mikrofon brauzer tomonidan bloklangan. Manzil yonidagi qulf ikonkasidan Microphone ni " +
      "Allow qiling va sahifani yangilang.",
    mic_not_found: "Mikrofon topilmadi. Qurilmaga mikrofon ulanganini tekshiring.",
    mic_busy:
      "Mikrofonni boshqa dastur band qilib turibdi. Zoom, Telegram yoki shunga o'xshash " +
      "dasturlarni yopib, qayta urinib ko'ring.",
    mic_security: "Brauzer mikrofonni xavfsizlik sababi bilan blokladi.",
    mic_failed: "Mikrofonga ulanib bo'lmadi.",
  },

  missionBrief: {
    eyebrow: "{character} bilan suhbat",
    goalTitle: "Maqsad",
    timeTitle: "Vaqt",
    timeValue: "{count} daqiqa",
    passTitle: "O'tish bali",
    passValue: "Kamida {score}%",
    phrasesTitle: "Kerak bo'ladigan iboralar",
    howTitle: "Qanday ishlaydi",
    howBody:
      "Sherigingiz gapiradi — siz ovoz bilan javob berasiz. Maqsadga yetganingizda yoki vaqt tugaganda suhbat yakunlanadi.",
    start: "Suhbatni boshlash",
    retryLocked: "Qayta urinish yopiq",
    retriesLeft: "Yana {count} ta urinish qoldi",
    cooldownTitle: "Biroz kuting",
    cooldownBody:
      "Bu suhbatni {time} dan so'ng qayta boshlashingiz mumkin. Shu vaqt ichida keyingi missiyaga o'tsangiz bo'ladi.",
    cooldownOk: "Tushunarli",
    failedBody: "Sizning balingiz {score}%. O'tish uchun kamida {pass}% kerak.",
  },

  missionLive: {
    connecting: "Ulanmoqda…",
    listening: "Gapiring",
    talking: "Tinglang",
    thinking: "O'ylanmoqda…",
    goalReached: "Maqsadga yetdingiz!",
    timeLeft: "Qolgan vaqt: {time}",
    beat: "{current}/{total}",
    mute: "Mikrofonni o'chirish",
    unmute: "Mikrofonni yoqish",
    finish: "Yakunlash",
    finishing: "Yakunlanmoqda…",
    leave: "Chiqish",
    orbLabel: "{character} bilan ovozli suhbat",
    unavailable: "Ovozli suhbat hozir ishlamayapti. Keyinroq urinib ko'ring.",
    startFailed: "Suhbatni boshlab bo'lmadi. Qayta urinib ko'ring.",
    phrases: "Shu darsning iboralari",
    characters: { Penguin: "Pingvin", Panda: "Panda", Pero: "Pero", None: "AI ustoz" },
  },

  player: {
    missionLength: 'Bu mashq taxminan {count} daqiqa.',
    voiceTimeLeft: 'Ovozli vaqt: {time}',
    tutorName: 'AI ustoz',
    tutorTagline: 'Sizni tinglaydi va darhol izoh beradi',
    micPrompt: 'Mikrofonni bosing va gapiring',
    listening: 'Gapiring… AI sizni eshitmoqda',
    waiting: 'Kutilmoqda…',
    evaluating: 'Javobingiz baholanmoqda…',
    interrupt: "Men gapiraman",
    pauseMicrophone: "Mikrofonni o'chirish",
    resumeMicrophone: 'Mikrofonni yoqish',
    microphonePaused: "Mikrofon o'chiq",
    reconnecting: 'Qayta ulanmoqda…',
    noSpeechHint:
      "Sizni eshitmayapmiz. Mikrofon yoqilganini va to'g'ri qurilma tanlanganini tekshiring.",
    micPermissionTitle: 'Mikrofonga ruxsat bering',
    micPermissionBody:
      "Ovozli javob berish uchun russian.gg mikrofoningizdan foydalanishiga ruxsat bering. Sozlamadan qaytgach ruxsat avtomatik tekshiriladi.",
    micPermissionAndroid:
      "Android: Settings → Apps → Chrome (yoki russian.gg) → Permissions → Microphone → Allow while using the app. Kerak bo'lsa Chrome → Settings → Site settings → Microphone → russian.gg → Allow ni ham tanlang.",
    micPermissionIos:
      'iPhone/iPad: Settings → Apps → Safari yoki Chrome → Microphone → Allow. Keyin shu sahifaga qayting.',
    micPermissionBrowser:
      "Brauzer manzil qatoridagi qulf yoki sayt sozlamasini oching → Microphone → Allow ni tanlang, so'ng sahifaga qayting.",
    micPermissionRemembered:
      "Ruxsat berilgach brauzer uni shu qurilmada eslab qoladi va qayta so'ramaydi.",
    micPermissionGrant: 'Ruxsat berish',
    micPermissionChecking: 'Ruxsat tekshirilmoqda…',
    micPermissionUnderstood: 'Tushunarli',
    inConversation: 'Suhbat davom etmoqda',
    turnAccepted: 'Javob qabul qilindi. Yakunlashni bosing.',
    completedGoalState: 'Bugungi maqsad yakunlangan. Qayta boshlashni bossangiz boshidan o\'tasiz.',
    answer: 'Javob berish',
    finish: 'Yakunlash',
    restartLesson: 'Qayta boshlash',
    tryAgain: 'Yana bir marta',
    advance: 'Davom etish',
    strength: 'Yaxshi tomoni',
    tryAgainTitle: 'Yana bir urinamiz',
    stepOffer: "Bu qadam cho'zildi.",
    lessonReady: 'Barcha qadamlar bajarildi.',
    parkedStep:
      "Bu qadamni keyinroq yana ko'ramiz. Xohlasangiz yana urinib ko'ring, " +
      "yoki hozir davom etaylik.",
    dailyLimitTitle: 'Bugungi limitingiz tugadi',
    dailyLimitBody:
      "Bugungi limitingiz tugadi. Keyingi kunni kuting. Yoki Pro sotib olib, limitingizni oshirishingiz mumkin.",
    dailyLimitBodyPro: 'Bugungi limitingiz tugadi. Keyingi kunni kuting.',
    dailyLimitDismissPro: 'Tushunarli',
    buyAccess: 'Sotib olish',
    goalProgress: 'Maqsad progressi',
    goal: 'Bugungi maqsad',
    phrases: 'Bugungi iboralar',
    phraseCount: '{count} ta',
    aiNote: 'AI izohi',
    aiDisclaimer: 'Bu AI izohi, rasmiy baholash emas.',
    usageNote: 'Qayerda ishlatiladi',
    listen: 'Eshitish',
    stopListening: "Eshitishni to'xtatish",
    ttsUnavailable:
      "Talaffuzni eshittirish hozir ishlamayapti. Mashqning qolgan qismi ishlaydi - " +
      "iboralarni o'qib, ovoz bilan javob berishingiz mumkin.",
    ttsFailed: "Talaffuzni eshittirib bo'lmadi. Biroz keyinroq urinib ko'ring.",
    asyncVoiceOffer: "Real vaqtli ulanish cho'zildi. Ovozli xabar yuborib davom etsangiz bo'ladi.",
    asyncVoiceBody: "Telegramdagidek tugmani bosib turing, gapirib bo'lgach qo'yib yuboring.",
    holdToRecord: 'Bosib turib yozing',
    releaseToSend: "To'xtatish uchun qo'yib yuboring",
    voiceNoteReady: "Ovozli xabar tayyor. Uni yuborib, avtomatik matnga aylantiramiz.",
    sendVoiceNote: "Ovozli xabarni yuborish",
    transcribingVoiceNote: "Ovozli xabar qayta ishlanmoqda…",
    writeAnswer: 'Aytganingizni yozing',
    submitAnswer: 'Javobni yuborish',
    notFound: 'Mashq topilmadi.',
    incomplete:
      "Bu mashq ma'lumotlari to'liq kelmadi. Sahifani yangilab ko'ring yoki boshqa kunni oching.",
    openFailed: "Mashqni ochib bo'lmadi.",
    startFailed: "Ovozli seansni boshlab bo'lmadi.",
    stopFailed: "Ovozli seansni tugatib bo'lmadi.",
    notAcceptedYet: "Javob hali to'liq qabul qilinmadi. Yana bir marta urinib ko'ring.",
    submitFailed: "Javobni yuborib bo'lmadi.",
    completeFailed: "Mashqni yakunlab bo'lmadi.",
    calculating: 'Natija hisoblanmoqda',
  },

  result: {
    notPassed: "Yakunlanmadi",
    notPassedBody: "Suhbatni yakunlash uchun kamida 80% kerak. Yana bir bor urinib ko'ring.",
    retryNow: "Qayta urinish",
    retryIn: "Qayta urinish {time} dan so'ng",
    nextMission: "Keyingi missiya",
    preparing: 'Natija tayyorlanmoqda',
    completed: 'Mashq bajarildi',
    milestoneUnlocked: '{day}-kun bosqichi ochildi',
    mainCorrection: 'Asosiy tuzatish',
    aiDisclaimer: 'Bu AI izohi, rasmiy baholash emas. Xato deb hisoblasangiz, bizga xabar bering.',
    skills: "Ko'nikmalar",
    yourAnswers: 'Javoblaringiz',
    details: 'Batafsil',
    hide: 'Yopish',
    step: 'Qadam {index}',
    retryTag: 'takror',
    turnsRecorded: '{count} ta javob yozib olindi.',
    pronunciation: 'Talaffuz',
    wordChoice: "So'z tanlash",
    grammar: 'Grammatika',
    backHome: 'Bugungi sahifaga qaytish',
    practiceMore: 'Yana mashq qilish',
    movedToDay: 'Siz {day}-kunga o‘tdingiz.',
  },

  billing: {
    periodLabel: {
      Monthly: 'Oylik',
      NinetyDay: '90 kunlik',
    },
    proBenefits: [
      "To'liq 90 kunlik yo'l",
      'Har kuni ovozli mashqlar',
      'Shaxsiy tuzatish darslari',
      "To'liq progress va daraja tarixi",
      "\"Bugun mashq\" kutubxonasi",
    ],
    freeLimitItems: ['Daraja testi', 'Birinchi 3 kun', 'Cheklangan namuna mashqlari'],
    title: "Pro bilan to'liq yo'l",
    subtitle:
      "Bepul rejada daraja testi va birinchi 3 kun ochiq. Keyingi kunlarni davom ettirish uchun " +
      "Pro obuna kerak bo'ladi.",
    processing: "To'lov tekshirilmoqda",
    processingBody: "To'lovingiz qabul qilindi va tasdiqlanmoqda. Tasdiqlangach Pro avtomatik ochiladi.",
    savings: '{percent}% tejash',
    futurePriceLabel: 'Keyingi narx',
    perMonth: 'Oyiga {amount}',
    perDay: 'Kuniga {amount}',
    payWithClick: "Click orqali to'lash - {amount}",
    payWithPayme: "Payme orqali to'lash - {amount}",
    opening: 'Ochilmoqda...',
    freeNote:
      "Bepul rejada daraja testi va yo'lning birinchi 3 kuni ochiq. Keyingi kunlar Click yoki Payme orqali " +
      "Pro obuna bilan ochiladi.",
    proUnlocks: 'Pro nimani ochadi',
    freeLimits: 'Bepul rejada',
    cancelNote:
      "Obunani istalgan vaqtda Sozlamalar bo'limidan bekor qilishingiz mumkin. Bekor qilganingizda " +
      "to'langan muddat oxirigacha Pro ochiq qoladi.",
    trialActive: 'Sinov muddati',
    proActive: 'Pro faol',
    trialUntil: 'Sinov {date} gacha.',
    activeUntil: 'Amal qilish muddati {date}.',
    cancelled: "Obuna bekor qilingan. Muddat tugagach bepul rejaga o'tasiz.",
    cancel: 'Obunani bekor qilish',
    cancelConfirm: 'Obunani bekor qilishni tasdiqlaysizmi?',
    checkoutFailed: "To'lovni boshlab bo'lmadi.",
    returnChecking: "To'lov tekshirilmoqda",
    returnConfirmed: "To'lov tasdiqlandi",
    returnProOpen: 'Pro ochildi',
    returnProBody: "90 kunlik to'liq yo'l endi sizga ochiq.",
    returnPending: "To'lov tasdiqlanmoqda",
    returnPendingBody:
      "Bu bir necha daqiqa olishi mumkin. Tasdiqlangach Pro avtomatik ochiladi, bu sahifani " +
      'yopsangiz ham.',
    returnError: "To'lov tizimidan xatolik kodi qaytdi.",
    promoTitle: 'Promo code bormi?',
    promoPlaceholder: 'Promo code kiriting',
    promoApply: "Qo'llash",
    promoApplied: 'Promo code qo‘llandi.',
    promoDiscount: 'Chegirma: {amount}',
    promoFinal: "To'lov: {amount}",
    promoPercent: '{percent}% chegirma',
    promoCelebrationBody: '{amount} chegirma ishladi.',
  },

  profile: {
    level: 'Darajangiz',
    levelNote:
      "Bu dastlabki baho, rasmiy til sertifikati emas. Har bir ovozli mashqdan keyin yangilanadi.",
    coursePosition: "Kursdagi o'rningiz",
    currentDay: 'Bugungi kun',
    missionsDone: 'Bajarilgan mashqlar',
    streakDays: 'Ketma-ket kunlar',
    keepGoing: 'Shu maromda davom eting',
    subscription: 'Obuna',
    unlockedDays: 'Ochilgan kunlar',
    nextPayment: "Keyingi to'lov",
    validUntil: 'Amal qiladi',
    paymentChecking: "To'lov tekshirilmoqda",
    subscriptionUnavailable: "Obuna ma'lumotini hozir yuklab bo'lmadi.",
    manage: 'Obunani boshqarish',
    account: 'Hisob',
    accountNote: "Hisobni o'chirish va maxfiylik ruxsatlari Sozlamalar sahifasida.",
    status: {
      none: "Obuna yo'q",
      trialing: 'Sinov davri',
      active: 'Faol',
      pastDue: "To'lov kutilmoqda",
      cancelled: 'Bekor qilingan',
      expired: 'Muddati tugagan',
    },
  },

  phonePrompt: {
    title: "Sizga qo'ng'iroq qilsak bo'ladimi?",
    body: "Platformani talabalar aytgan gaplarga qarab yaxshilaymiz.",
    bodyLine2: "Qisqa suhbat uchun raqamingizni qoldiring.",
    label: 'Telefon raqami',
    placeholder: '+998',
    invalid: "Telefon raqamini to'g'ri kiriting.",
  },

  settings: {
    voice: 'Ustoz ovozi',
    voiceGender: { Female: 'Ayol', Male: 'Erkak' },
    voiceMood: {
      Gentle: 'Muloyim',
      Playful: 'Hazilkash',
      Blunt: "Qo'pol",
    },
    voiceMoodHint: {
      Gentle: 'Sabrli va dalda beradi. Boshlash uchun shu.',
      Playful: "Hazil aralash, ko'cha tilida gaplashadi.",
      Blunt: "Shoshayotgan notanish odamdek keskin gapiradi. Mashq uchun — sizni kamsitmaydi.",
    },
    voiceNote:
      "Bu faqat ohangni o'zgartiradi. Dars, tuzatishlar va sizga munosabat har qanday tanlovda bir xil qoladi.",
    title: 'Sozlamalar',
    tabProfile: 'Profil',
    tabGeneral: 'Umumiy',
    tabBilling: 'Obuna',
    appearance: "Ko'rinish",
    themeLight: "Yorug'",
    themeLightHint: "Standart ko'rinish",
    themeDark: "Qorong'i",
    themeDarkHint: 'Kechqurun mashq uchun',
    language: 'Til',
    privacy: 'Maxfiylik va ruxsatlar',
    privacyNote:
      "Ruxsat bermasangiz ham mashqlar ishlaydi. Ovoz yozuvlari faqat siz ruxsat bergan " +
      'taqdirdagina saqlanadi.',
    account: 'Hisob',
    deleteAccount: "Hisobni o'chirish",
    googleSection: 'Google hisobi',
    googleLinked: 'Google bu hisobga biriktirilgan.',
    googleLinkBody:
      'Google’ni biriktirsangiz, ikkala yo‘l bilan — raqam va parol bilan yoki Google orqali — '
      + 'kira olasiz va doim shu hisobga tushasiz.',
    googleLinkAction: 'Google’ni biriktirish',
    googleLinkFailed: 'Google hisobini biriktirib bo‘lmadi.',
    deleteNote:
      "Hisobni o'chirsangiz, barcha yozuvlar, transkriptlar va progress o'chiriladi. Buni " +
      'qaytarib bo\'lmaydi.',
    deletePrompt:
      "Hisobingiz va barcha yozuvlaringiz o'chiriladi. Tasdiqlash uchun O'CHIRISH deb yozing.",
    deleteConfirmWord: "O'CHIRISH",
    deleteFailed: "O'chirishda xatolik.",
    saveFailed: 'Saqlashda xatolik.',
    feedbackBody:
      "O'zingizning fikringizni shu yerga yozib qoldirsangiz bo'ladi. Taklif, e'tiroz va " +
      'izohlaringiz bizga yetib boradi.',
    feedbackLabel: 'Xabar',
    consents: {
      audioRetention: 'Ovoz yozuvlarini saqlash',
      audioRetentionBody:
        "Mashq tugagach ovozingiz saqlanadi, shunda keyin qayta tinglashingiz mumkin. Ruxsat " +
        "bermasangiz, ovoz faqat izoh uchun ishlatiladi va saqlanmaydi.",
      audioHumanReview: 'Sifat nazorati uchun tinglash',
      audioHumanReviewBody:
        'Muharrir tanlangan yozuvlarni izoh sifatini tekshirish uchun tinglashi mumkin.',
      productReminders: 'Eslatmalar',
      productRemindersBody:
        "Mashqni o'tkazib yuborsangiz, o'z vaqt mintaqangizda eslatma yuboramiz.",
      productAnalytics: 'Mahsulot statistikasi',
      productAnalyticsBody:
        "Qaysi mashqlar foydali ekanini tushunish uchun anonim foydalanish ma'lumotlari.",
    },
  },

  feedbackPage: {
    subtitle: 'Muammo, taklif yoki eʼtirozingizni shu yerda alohida forma orqali yuboring.',
    title: 'Fikr bildirish',
    formTitle: 'Izoh formasi',
    kind: 'Muammo turi',
    subject: 'Sarlavha',
    subjectPlaceholder: 'Masalan: Google login ishlamayapti',
    attach: 'Fayl ilova qilish',
    details: 'Batafsil izoh',
    detailsPlaceholder: 'Muammoni, qachon yuz berganini va kutgan natijangizni yozing',
    subjectTooShort: "Sarlavhani to'liqroq yozing.",
    detailsTooShort: 'Izohni biroz batafsilroq yozing.',
    sent: "Izohingiz yuborildi. Tez orada ko'rib chiqamiz.",
    failed: "Izohni yuborib bo'lmadi.",
  },

  /**
   * Why a repair was suggested. Keyed by the gap code the server records, because the reason
   * is a fixed sentence per code — not something written per learner. It used to be frozen
   * into the row in whatever language it was created in, so switching language never moved it.
   */
  repairReasons: {
    'pronunciation-soft-sign': "Yumshoq belgili so'zlarda talaffuz aniq emas.",
    'pronunciation-stress': "Urg'u noto'g'ri joyga tushmoqda.",
    'vocabulary-work': "Ish bilan bog'liq so'zlar hali mustahkam emas.",
    'vocabulary-daily': "Kundalik hayot so'zlarini takrorlash kerak.",
    'grammar-case': "Kelishik qo'shimchalari ba'zan tushib qolmoqda.",
    'grammar-verb-aspect': "Fe'l ko'rinishini tanlashda xatolik bor.",
    'listening-speed': "Tez nutqni tushunish qiyin bo'lmoqda.",
    'fluency-hesitation': "Javob berishda uzoq to'xtalish bor.",
    fallback: 'Bu mavzuni qisqa mashq bilan mustahkamlaymiz.',
  },

  welcomeGift: {
    eyebrow: "Siz uchun sovg'a",
    title: "Uch qutidan birini tanlang",
    body: "Ichida 90 kunlik yo'lingiz uchun maxsus sovrin bor. Faqat bittasini ochish mumkin.",
    chooseLabel: "Sovg'a qutilari",
    boxLabel: "{number}-sovg'a qutisini ochish",
    hint: "Qaysi biri omadli ekanini his qilib tanlang",
    opening: "Quti ochilmoqda...",
    wonTitle: "Tabriklaymiz!",
    wonBody: "Sovriningiz Russian.gg hisobingizga biriktirildi.",
    yourPrize: "Sizning sovriningiz",
    bonusPrize: "+{days} kun bepul",
    discountPrize: "90 kunlik uchun {percent}% chegirma",
    badgeDiscount: "chegirma",
    badgeDays: "kun bepul",
    discountExpiry: "Chegirma 10 daqiqa amal qiladi.",
    viewPlans: "Tariflarni ko'rish",
    later: 'Keyinroq',
    expiresIn: "Qolgan vaqt: {time}",
    continue: "Mashqni boshlash",
    error: "Sovg'ani ochib bo'lmadi. Qayta urinib ko'ring.",
  },

  lessonFeedback: {
    eyebrow: "{days} kunlik darslar ortda qoldi",
    title: "Fikringiz biz uchun muhim",
    body: "Bir daqiqa vaqt ajrating — javoblaringiz darslarni yanada yaxshilashga yordam beradi.",
    satisfactionQuestion: "O'tgan darslardan qanchalik mamnunsiz?",
    satisfactionOptions: [
      { title: "Juda mamnunman", hint: "Darslar tushunarli, foydali va qiziqarli bo'ldi" },
      { title: "Mamnunman", hint: "Umuman yaxshi, ba'zi joylarini yaxshilash mumkin" },
      { title: "Betarafman", hint: "Na yaxshi, na yomon" },
      { title: "Mamnun emasman", hint: "O'rganishga ba'zi narsalar xalaqit berdi" },
      { title: "Umuman mamnun emasman", hint: "Darslar menga mos kelmadi" },
    ],
    recommendationQuestion: "Russian.gg'ni do'stlaringiz yoki hamkasblaringizga tavsiya qilasizmi?",
    recommendationOptions: [
      { title: "Albatta tavsiya qilaman", hint: "Hech ikkilanmasdan" },
      { title: "Ehtimol, tavsiya qilaman", hint: "Kerakli odamga — albatta" },
      { title: "Hali bilmayman", hint: "Hali qaror qilmadim" },
      { title: "Ehtimol, yo'q", hint: "Tavsiya qilishga ikkilanaman" },
      { title: "Yo'q, tavsiya qilmayman", hint: "Tavsiya qilmagan bo'lardim" },
    ],
    ratingQuestion: "Platformani 5 yulduzli shkalada baholang",
    starLabel: "{count} yulduz",
    ratingLabels: ["Yomon", "Qoniqarsiz", "O'rtacha", "Yaxshi", "A'lo"],
    noteLabel: "Izoh",
    optional: "ixtiyoriy",
    notePlaceholder: "Nima yoqdi, nimani yaxshilash kerak?",
    required: "majburiy",
    requiredHint: "Davom etish uchun javoblardan birini tanlang.",
    stepLabel: "{current}/{total}-qadam",
    back: "Orqaga",
    next: "Keyingi",
    submit: "Fikrni yuborish",
    sending: "Yuborilmoqda...",
    error: "Fikringizni yuborib bo'lmadi. Qayta urinib ko'ring.",
  },

  labels: {
    phase: {
      Foundation: "Boshlang'ich",
      Bridge: "Ko'prik",
      Immersion: 'Immersiya',
    },
    category: {
      Work: 'Ish',
      DailyLife: 'Kundalik hayot',
      Social: 'Muloqot',
      StreetRussian: 'Jonli nutq',
      Repair: 'Mustahkamlash',
    },
    topic: {
      Introductions: 'Tanishish',
      Shopping: "Do'kon",
      CafeRestaurant: 'Kafe va restoran',
      Taxi: 'Taksi',
      Directions: "Yo'l so'rash",
      PhoneCall: "Telefon qo'ng'irog'i",
      Pharmacy: 'Dorixona',
      Doctor: 'Shifokor',
      Gym: 'Trenirovka',
      Housing: 'Uy-joy',
      Bank: 'Bank',
      Hotel: 'Mehmonxona',
      Celebrations: 'Tug‘ilgan kun va tabriklar',
      WorkAndProfession: 'Kasb va ish',
      Delivery: 'Yetkazib berish',
    },
    skill: {
      Listening: 'Tinglash',
      Speaking: 'Gapirish',
      Pronunciation: 'Talaffuz',
      Vocabulary: "So'z boyligi",
      Grammar: 'Grammatika',
    },
    step: {
      PhraseIntro: 'yangi iboralar',
      ListenAndUnderstand: 'tinglash',
      SpeakingTurn: 'javob berish',
      RolePlay: 'rol o’yini',
      Recap: 'xulosa',
    },
    stepTitle: {
      PhraseIntro: 'Yangi iboralar',
      ListenAndUnderstand: 'Tinglab tushunish',
      SpeakingTurn: 'Gapirib javob berish',
      RolePlay: 'Rol o’yini',
      Recap: 'Xulosa',
    },
    formality: {
      Formal: 'Rasmiy',
      Neutral: 'Neytral',
      Informal: 'Norasmiy',
      Slang: 'Jargon',
    },
    workplace: {
      Safe: 'Ishda ishlatsa bo’ladi',
      UseWithCare: 'Ishda ehtiyot bo’ling',
      Avoid: 'Ishda ishlatmang',
    },
    level: {
      A0: 'Boshlang’ich',
      A1: 'Oddiy iboralar',
      A2: 'Kundalik muloqot',
      B1: 'Mustaqil muloqot',
      B2: 'Erkin muloqot',
    },
  },
  install: {
    neverShow: "Boshqa ko'rsatilmasin",
    title: "Ilovani telefoningizga o'rnating",
    body: "Bosh ekrandan bir bosishda ochiladi — brauzer ham, manzil terish ham kerak emas.",
    action: 'Yuklab olish',
    later: 'Keyinroq',
    close: 'Yopish',
    howTitle: "Qanday o'rnatiladi",
    iosStep1: "Brauzerdagi «Ulashish» tugmasini bosing — yuqoriga qaragan strelkali kvadrat",
    iosStep2: "Ro'yxatdan «Bosh ekranga qo'shish»ni tanlang",
    androidStep1: 'Brauzer menyusini oching — uchta nuqta yoki uchta chiziq',
    androidStep2: "«Ilovani o'rnatish» yoki «Bosh ekranga qo'shish»ni tanlang",
  },
}
