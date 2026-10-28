import type { Locale } from '../../../lib/i18n'

const uz = {
  badge: 'RUSCHA O‘YLA. DARHOL GAPIR.',
  intro: 'Kutilmagan vaziyat. Sizning birinchi fikringiz.',
  description: 'Vaziyatni ko‘ring va 20 soniya ichida ruscha javob bering. Mukammal gap shart emas — fikringizni ayting!',
  choose: 'Kim bilan mashq qilamiz?',
  penguin: 'Talabchan ustoz', panda: 'Mehribon do‘st', pero: 'Kinoyali hamroh',
  penguinNote: 'Aniq fikr, to‘g‘ri grammatika. Qani, boshladik!',
  pandaNote: 'Xato qilish mumkin. Men sizni qo‘llayman!',
  peroNote: 'Tayyor gap yo‘q. Meni hayratda qoldiring!',
  duration: 'har bir javobga', rounds: 'kutilmagan vaziyat', level: 'Rus tili darajangiz',
  readyTitle: 'Avval vaziyat bilan tanishing', readyNote: 'Shoshilmang. Taymer faqat “Tayyorman” tugmasidan keyin boshlanadi.',
  situation: 'VAZIYAT', hints: 'Boshlashga yordam', promptAudio: 'Vaziyatni eshitish',
  listening: 'Gapiring, sizni eshityapman', activeNote: 'Birinchi fikringizni ruscha ayting!',
  encouragement: 'Bitta oddiy gapdan boshlang. Siz uddalaysiz!',
  transcript: 'SO‘ZLARINGIZ SHU YERDA PAYDO BO‘LADI',
  submit: 'Javobni yakunlash', paused: 'Mikrofonni qayta ulash', textNote: 'Yozma mashq: tezlik bonusi hisoblanmaydi.',
  feedback: 'Ajoyib urinish!', better: 'Yaxshiroq aytish mumkin', points: 'bu raundda',
  result: 'Birinchi fikr — katta qadam!', strongResult: 'Ruscha fikrlash tezlashdi!',
  words: 'aytilgan so‘z', fastest: 'eng tez boshlash', noTiming: 'O‘lchanmagan', score: 'jami ball',
  menu: 'O‘yinlar menyusi', resultNote: 'Har bir javob — ruscha erkinroq gapirishga bir qadam.',
  strongPenguin: 'Barakalla! Tez va aniq fikrlash — mana natija. Yana mashq qilamiz!',
  strongPanda: 'Qoyil, do‘stim! Fikrlaringiz bemalol oqyapti. Siz bilan faxrlanaman!',
  strongPero: 'Voy, so‘zlaringiz hatto mendan ham tez uchyapti. Yana bir bor-chi?',
  retryPenguin: 'Birinchi qadam qo‘yildi. Endi bitta aniq gapdan yana boshlaymiz.',
  retryPanda: 'Har bir urinish qadrli, do‘stim. Keyingi safar yanada oson bo‘ladi!',
  retryPero: 'Fikrlar hali isinmoqda! Yana bir raundda ularga qanot beramizmi?',
  prepare: 'Vaziyatni ko‘ring', respond: 'Ruscha javob bering', learn: 'Fikringizni yaxshilang',
}

type Copy = { [K in keyof typeof uz]: string }
const ru: Copy = {
  badge: 'ДУМАЙ ПО-РУССКИ. ГОВОРИ СРАЗУ.', intro: 'Неожиданная ситуация. Ваша первая мысль.',
  description: 'Посмотрите на ситуацию и ответьте по-русски за 20 секунд. Идеальная фраза не нужна — просто выразите мысль!',
  choose: 'С кем будем практиковаться?', penguin: 'Строгий наставник', panda: 'Добрый друг', pero: 'Ироничный напарник',
  penguinNote: 'Чёткая мысль, правильная грамматика. Начинаем!', pandaNote: 'Можно ошибаться. Я вас поддержу!', peroNote: 'Без заученных фраз. Удивите меня!',
  duration: 'на каждый ответ', rounds: 'неожиданных ситуаций', level: 'Ваш уровень русского',
  readyTitle: 'Сначала познакомьтесь с ситуацией', readyNote: 'Не спешите. Таймер начнётся только после кнопки «Я готов».',
  situation: 'СИТУАЦИЯ', hints: 'С чего можно начать', promptAudio: 'Послушать ситуацию', listening: 'Говорите, я вас слушаю', activeNote: 'Скажите первую мысль по-русски!',
  encouragement: 'Начните с одного простого предложения. Вы справитесь!', transcript: 'ЗДЕСЬ ПОЯВЯТСЯ ВАШИ СЛОВА', submit: 'Закончить ответ', paused: 'Подключить микрофон снова',
  textNote: 'Письменная практика: бонус за скорость не начисляется.', feedback: 'Хорошая попытка!', better: 'Можно сказать лучше', points: 'за этот раунд',
  result: 'Первая мысль — большой шаг!', strongResult: 'Мысли по-русски стали быстрее!', words: 'произнесённых слов', fastest: 'самое быстрое начало', noTiming: 'Не измерено', score: 'всего баллов',
  menu: 'В меню игр', resultNote: 'Каждый ответ — шаг к свободной русской речи.',
  strongPenguin: 'Хорошая работа! Быстро и точно — вот результат. Продолжим практику!', strongPanda: 'Молодец, мой друг! Мысли льются свободно. Я тобой горжусь!', strongPero: 'Твои слова летают даже быстрее меня. Ещё разок?',
  retryPenguin: 'Первый шаг сделан. Начнём ещё раз с одного точного предложения.', retryPanda: 'Каждая попытка важна, мой друг. В следующий раз будет легче!', retryPero: 'Мысли пока разминаются! Подарим им крылья в следующем раунде?',
  prepare: 'Посмотрите на ситуацию', respond: 'Ответьте по-русски', learn: 'Улучшите свою мысль',
}

const en: Copy = {
  badge: 'THINK IN RUSSIAN. SPEAK RIGHT AWAY.', intro: 'An unexpected situation. Your first thought.',
  description: 'Look at the situation and answer in Russian in 20 seconds. You don’t need a perfect sentence — say what you think!',
  choose: 'Who will you practise with?', penguin: 'Strict mentor', panda: 'Kind friend', pero: 'Witty companion',
  penguinNote: 'Clear thoughts, good grammar. Let’s begin!', pandaNote: 'Mistakes are welcome. I’m here for you!', peroNote: 'No rehearsed lines. Surprise me!',
  duration: 'for each answer', rounds: 'unexpected situations', level: 'Your Russian level', readyTitle: 'Explore the situation first', readyNote: 'Take your time. The timer starts only when you select “Ready”.',
  situation: 'SITUATION', hints: 'A little help to begin', promptAudio: 'Listen to the situation', listening: 'Speak, I’m listening', activeNote: 'Say your first thought in Russian!',
  encouragement: 'Start with one simple sentence. You can do it!', transcript: 'YOUR WORDS WILL APPEAR HERE', submit: 'Finish answer', paused: 'Reconnect microphone', textNote: 'Written practice: no speed bonus is awarded.',
  feedback: 'A great attempt!', better: 'An even better way to say it', points: 'this round', result: 'Your first thought is a big step!', strongResult: 'You’re thinking faster in Russian!',
  words: 'words spoken', fastest: 'fastest start', noTiming: 'Not measured', score: 'total points', menu: 'Games menu', resultNote: 'Every answer is a step towards speaking Russian freely.',
  strongPenguin: 'Good work! Fast, clear thinking gets results. Let’s keep practising!', strongPanda: 'Well done, my friend! Your thoughts are flowing. I’m proud of you!', strongPero: 'Your words fly even faster than I do. One more round?',
  retryPenguin: 'You took the first step. Let’s start again with one clear sentence.', retryPanda: 'Every attempt matters, my friend. Next time will feel easier!', retryPero: 'Your thoughts are still warming up! Shall we give them wings next round?',
  prepare: 'Explore a situation', respond: 'Answer in Russian', learn: 'Improve your response',
}

export const firstReactionCopies: Record<Locale, Copy> = { uz, ru, en }
