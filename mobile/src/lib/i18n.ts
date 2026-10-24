import { currentLocale } from '@/lib/app-locale';

export type Locale = 'hy' | 'ru' | 'en';

type Dictionary = Record<Locale, Record<MessageKey, string>>;

const dictionary: Dictionary = {
  hy: {
    signInTitle: 'Մուտք',
    signUpTitle: 'Գրանցում',
    name: 'Անուն',
    email: 'Էլ. փոստ',
    password: 'Գաղտնաբառ',
    signInAction: 'Մտնել',
    signUpAction: 'Ստեղծել հաշիվ',
    toSignUp: 'Չունե՞ք հաշիվ։ Գրանցվել',
    toSignIn: 'Արդեն ունե՞ք հաշիվ։ Մտնել',
    signOut: 'Դուրս գալ',
    genericError: 'Չհաջողվեց. փորձեք կրկին',
    locked: 'Հաշիվը ժամանակավորապես արգելափակված է',
    invalidCredentials: 'Էլ. փոստը կամ գաղտնաբառը սխալ է',
    forgotLink: 'Մոռացե՞լ եք գաղտնաբառը։',
    forgotTitle: 'Գաղտնաբառի վերականգնում',
    forgotSubmit: 'Ուղարկել հղումը',
    forgotSent: 'Եթե այս հասցեով հաշիվ կա, հղումն արդեն ճանապարհին է։ Բացեք այն բրաուզերում՝ նոր գաղտնաբառ սահմանելու համար։',
    forgotCaptcha: 'Անվտանգության ստուգումը չանցավ։ Վերականգնեք գաղտնաբառը կայքում։',
    forgotOpenWeb: 'Բացել կայքում',
    backToSignIn: 'Վերադառնալ մուտք',
    catalogEmpty: 'Դատարկ է',
    catalogNotFound: 'Չգտնվեց',
    catalogError: 'Չհաջողվեց բեռնել. փորձեք կրկին',
    catalogBack: 'Հետ',
    bookAction: 'Գրանցվել',
    bookTitle: 'Գրանցում',
    bookPickSlot: 'Ընտրեք ժամանակ',
    bookNoSlots: 'Ազատ ժամեր չկան',
    bookConfirm: 'Հաստատել գրանցումը',
    bookSignIn: 'Մուտք գործեք՝ գրանցվելու համար',
    bookDone: 'Դուք գրանցված եք',
    bookSlotTaken: 'Այս ժամը արդեն զբաղված է',
    bookFailed: 'Չհաջողվեց գրանցվել',
    bookPayStarted: 'Անցեք վճարման էջ՝ բրոնը հաստատելու համար',
    bookPayFailed: 'Չհաջողվեց սկսել վճարումը',
    payMethodTitle: 'Վճարման եղանակ',
    payMethodCard: 'Բանկային քարտ',
    payMethodArca: 'ArCa',
    payMethodIdram: 'Idram',
    payMethodTelcell: 'Telcell',
    payMethodQr: 'QR կոդ',
    payBookingCta: 'Վճարել',
    tabHome: 'Գլխավոր',
    tabProfile: 'Պրոֆիլ',
    tabClasses: 'Դասեր',
    tabEvents: 'Իրադարձություններ',
    tabShop: 'Խանութ',
    tabAccount: 'Հաշիվ',
    tabAi: 'AI',
    aiTitle: 'ArtDance AI',
    aiOnline: 'Առցանց',
    aiIntro: 'Հարցրեք դասերի, գրաֆիկի, գների կամ ձեր բրոնավորումների մասին։',
    aiPlaceholder: 'Գրեք հաղորդագրություն',
    aiThinking: 'Մտածում եմ…',
    aiError: 'Չհաջողվեց պատասխանել։ Փորձեք նորից։',
    aiRateLimited: 'Հարցումները շատ են։ Փորձեք քիչ հետո։',
    aiSignInTitle: 'Մուտք գործեք',
    aiSignInBody: 'Ասիստենտը տեսնում է ձեր բրոնավորումները, ուստի անհրաժեշտ է մուտքը։',
    aiSignIn: 'Մուտք',
    aiClear: 'Մաքրել զրույցը',
    aiSend: 'Ուղարկել',
    aiSuggestion1: 'Ի՞նչ ընտրել սկսնակին',
    aiSuggestion2: 'Ո՞ր դասերն են այս շաբաթ',
    aiSuggestion3: 'Ինչպե՞ս է աշխատում չեղարկումը',
    aiSuggestion4: 'Իմ մոտալուտ բրոնավորումները',
    accountSignOut: 'Դուրս գալ',
    accountEmpty: 'Դուք մուտք չեք գործել',
    greetMorning: 'Բարի առավոտ',
    greetDay: 'Բարի օր',
    greetEvening: 'Բարի երեկո',
    greetNight: 'Բարի գիշեր',
    forYourMood: 'Ձեր տրամադրությանը',
    openOnWeb: 'Բացել կայքում',
    bookSuccessTitle: 'Պատրաստ է',
    accountMember: 'ArtDance-ի անդամ',
    accountSectionMine: 'Իմը',
    accountSectionInfo: 'Տեղեկություն',
    accountSectionLanding: 'Ծրագրեր և գործընկերներ',
    accountSectionHelp: 'Օգնություն',
    accountSectionPartners: 'Մարզիչների և ստուդիաների համար',
    accountSignOutTitle: 'Դուրս գալ հաշվից՞',
    accountCancel: 'Չեղարկել',
    profileTitle: 'Պրոֆիլ',
    profileHint: 'Սեղմեք՝ կարգավորումների համար։ Պահեք՝ տեսնելու, թե ինչ կարելի է փոխել',
    profileSave: 'Պահպանել',
    profileSaved: 'Պահպանված է',
    profilePasswordTitle: 'Փոխել գաղտնաբառը',
    profileCurrentPassword: 'Ընթացիկ գաղտնաբառ',
    profileNewPassword: 'Նոր գաղտնաբառ',
    profilePasswordRules: 'Առնվազն 10 նիշ, թվով',
    profilePasswordChanged: 'Գաղտնաբառը թարմացվեց։ Այլ սարքերը դուրս են եկել',
    profileWrongPassword: 'Ընթացիկ գաղտնաբառը սխալ է',
    profileActionsTitle: 'Ի՞նչ կարելի է փոխել',
    profileEditable: 'Հնարավոր է',
    profileLocked: 'Անհնար',
    profileSoon: 'Շուտով',
    profileNameHint: 'Անունը, որ տեսնում են ուրիշները',
    profilePasswordHint: 'Ընթացիկ և նոր գաղտնաբառ',
    profilePhotoTitle: 'Նկար',
    profilePhotoHint: 'Նկարի բեռնումը՝ հաջորդ տարբերակում',
    profileEmailHint: 'Էլ. հասցեն փոխվում է աջակցության միջոցով',
  },
  ru: {
    signInTitle: 'Вход',
    signUpTitle: 'Регистрация',
    name: 'Имя',
    email: 'Эл. почта',
    password: 'Пароль',
    signInAction: 'Войти',
    signUpAction: 'Создать аккаунт',
    toSignUp: 'Нет аккаунта? Регистрация',
    toSignIn: 'Уже есть аккаунт? Войти',
    signOut: 'Выйти',
    genericError: 'Не удалось. Попробуйте ещё раз',
    locked: 'Аккаунт временно заблокирован',
    invalidCredentials: 'Неверный email или пароль',
    forgotLink: 'Забыли пароль?',
    forgotTitle: 'Сброс пароля',
    forgotSubmit: 'Отправить ссылку',
    forgotSent: 'Если аккаунт с этим адресом есть, ссылка уже в пути. Откройте её в браузере, чтобы задать новый пароль.',
    forgotCaptcha: 'Проверка безопасности не пройдена. Сбросьте пароль на сайте.',
    forgotOpenWeb: 'Открыть на сайте',
    backToSignIn: 'Вернуться ко входу',
    catalogEmpty: 'Пока пусто',
    catalogNotFound: 'Не найдено',
    catalogError: 'Не удалось загрузить. Попробуйте ещё раз',
    catalogBack: 'Назад',
    bookAction: 'Записаться',
    bookTitle: 'Запись',
    bookPickSlot: 'Выберите время',
    bookNoSlots: 'Свободного времени нет',
    bookConfirm: 'Подтвердить запись',
    bookSignIn: 'Войдите, чтобы записаться',
    bookDone: 'Вы записаны',
    bookSlotTaken: 'Это время уже занято',
    bookFailed: 'Не удалось записаться',
    bookPayStarted: 'Перейдите к оплате, чтобы подтвердить запись',
    bookPayFailed: 'Не удалось начать оплату',
    payMethodTitle: 'Способ оплаты',
    payMethodCard: 'Банковская карта',
    payMethodArca: 'ArCa',
    payMethodIdram: 'Idram',
    payMethodTelcell: 'Telcell',
    payMethodQr: 'QR-код',
    payBookingCta: 'Оплатить',
    tabHome: 'Главная',
    tabProfile: 'Профиль',
    tabClasses: 'Занятия',
    tabEvents: 'События',
    tabShop: 'Магазин',
    tabAccount: 'Аккаунт',
    tabAi: 'AI',
    aiTitle: 'ArtDance AI',
    aiOnline: 'Онлайн',
    aiIntro: 'Спросите про занятия, расписание, цены или ваши брони.',
    aiPlaceholder: 'Напишите сообщение',
    aiThinking: 'Думаю…',
    aiError: 'Не удалось ответить. Попробуйте ещё раз.',
    aiRateLimited: 'Слишком много запросов. Попробуйте позже.',
    aiSignInTitle: 'Войдите в аккаунт',
    aiSignInBody: 'Ассистент видит ваши брони, поэтому нужен вход.',
    aiSignIn: 'Войти',
    aiClear: 'Очистить чат',
    aiSend: 'Отправить',
    aiSuggestion1: 'Что выбрать новичку?',
    aiSuggestion2: 'Какие занятия на этой неделе?',
    aiSuggestion3: 'Как работает отмена?',
    aiSuggestion4: 'Мои ближайшие брони',
    accountSignOut: 'Выйти',
    accountEmpty: 'Вы не вошли',
    greetMorning: 'Доброе утро',
    greetDay: 'Добрый день',
    greetEvening: 'Добрый вечер',
    greetNight: 'Доброй ночи',
    forYourMood: 'Под ваше настроение',
    openOnWeb: 'Открыть на сайте',
    bookSuccessTitle: 'Готово',
    accountMember: 'Участник ArtDance',
    accountSectionMine: 'Моё',
    accountSectionInfo: 'Информация',
    accountSectionLanding: 'Программы и партнёры',
    accountSectionHelp: 'Помощь',
    accountSectionPartners: 'Для преподавателей и студий',
    accountSignOutTitle: 'Выйти из аккаунта?',
    accountCancel: 'Отмена',
    profileTitle: 'Профиль',
    profileHint: 'Нажмите — настройки. Удерживайте — что можно изменить',
    profileSave: 'Сохранить',
    profileSaved: 'Сохранено',
    profilePasswordTitle: 'Сменить пароль',
    profileCurrentPassword: 'Текущий пароль',
    profileNewPassword: 'Новый пароль',
    profilePasswordRules: 'Не короче 10 символов, с цифрой',
    profilePasswordChanged: 'Пароль обновлён. Другие устройства вышли из аккаунта',
    profileWrongPassword: 'Текущий пароль неверный',
    profileActionsTitle: 'Что можно изменить',
    profileEditable: 'Можно',
    profileLocked: 'Нельзя',
    profileSoon: 'Скоро',
    profileNameHint: 'Имя, которое видят другие',
    profilePasswordHint: 'Текущий и новый пароль',
    profilePhotoTitle: 'Фото',
    profilePhotoHint: 'Загрузка фото — в следующей версии',
    profileEmailHint: 'Адрес меняется через поддержку',
  },
  en: {
    signInTitle: 'Sign in',
    signUpTitle: 'Sign up',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    signInAction: 'Sign in',
    signUpAction: 'Create account',
    toSignUp: 'No account? Sign up',
    toSignIn: 'Already have an account? Sign in',
    signOut: 'Sign out',
    genericError: 'Something went wrong. Try again',
    locked: 'Account is temporarily locked',
    invalidCredentials: 'Email or password is incorrect',
    forgotLink: 'Forgot password?',
    forgotTitle: 'Reset password',
    forgotSubmit: 'Send reset link',
    forgotSent: 'If an account exists for this email, the link is on its way. Open it in a browser to set a new password.',
    forgotCaptcha: 'Security check failed. Reset your password on the website.',
    forgotOpenWeb: 'Open on the website',
    backToSignIn: 'Back to sign in',
    catalogEmpty: 'Nothing here yet',
    catalogNotFound: 'Not found',
    catalogError: 'Could not load. Try again',
    catalogBack: 'Back',
    bookAction: 'Book',
    bookTitle: 'Booking',
    bookPickSlot: 'Pick a time',
    bookNoSlots: 'No free times',
    bookConfirm: 'Confirm booking',
    bookSignIn: 'Sign in to book',
    bookDone: 'You are booked',
    bookSlotTaken: 'That time is already taken',
    bookFailed: 'Could not book',
    bookPayStarted: 'Continue to payment to confirm your booking',
    bookPayFailed: 'Could not start payment',
    payMethodTitle: 'Payment method',
    payMethodCard: 'Bank card',
    payMethodArca: 'ArCa',
    payMethodIdram: 'Idram',
    payMethodTelcell: 'Telcell',
    payMethodQr: 'QR code',
    payBookingCta: 'Pay',
    tabHome: 'Home',
    tabProfile: 'Profile',
    tabClasses: 'Classes',
    tabEvents: 'Events',
    tabShop: 'Shop',
    tabAccount: 'Account',
    tabAi: 'AI',
    aiTitle: 'ArtDance AI',
    aiOnline: 'Online',
    aiIntro: 'Ask about classes, the schedule, prices or your bookings.',
    aiPlaceholder: 'Type a message',
    aiThinking: 'Thinking…',
    aiError: 'Could not answer. Please try again.',
    aiRateLimited: 'Too many requests. Try again later.',
    aiSignInTitle: 'Sign in to continue',
    aiSignInBody: 'The assistant can see your bookings, so please sign in.',
    aiSignIn: 'Sign in',
    aiClear: 'Clear chat',
    aiSend: 'Send',
    aiSuggestion1: 'What should a beginner take?',
    aiSuggestion2: 'Which classes are this week?',
    aiSuggestion3: 'How does cancellation work?',
    aiSuggestion4: 'My upcoming bookings',
    accountSignOut: 'Sign out',
    accountEmpty: 'You are not signed in',
    greetMorning: 'Good morning',
    greetDay: 'Good afternoon',
    greetEvening: 'Good evening',
    greetNight: 'Good night',
    forYourMood: 'For your mood',
    openOnWeb: 'Open on the website',
    bookSuccessTitle: 'All set',
    accountMember: 'ArtDance member',
    accountSectionMine: 'Mine',
    accountSectionInfo: 'Information',
    accountSectionLanding: 'Programs & partners',
    accountSectionHelp: 'Help',
    accountSectionPartners: 'For teachers & studios',
    accountSignOutTitle: 'Sign out of your account?',
    accountCancel: 'Cancel',
    profileTitle: 'Profile',
    profileHint: 'Tap to open settings. Hold to see what you can change',
    profileSave: 'Save',
    profileSaved: 'Saved',
    profilePasswordTitle: 'Change password',
    profileCurrentPassword: 'Current password',
    profileNewPassword: 'New password',
    profilePasswordRules: 'At least 10 characters, with a number',
    profilePasswordChanged: 'Password updated. Other devices were signed out',
    profileWrongPassword: 'Current password is incorrect',
    profileActionsTitle: 'What you can change',
    profileEditable: 'Editable',
    profileLocked: 'Locked',
    profileSoon: 'Soon',
    profileNameHint: 'The name others see',
    profilePasswordHint: 'Current and new password',
    profilePhotoTitle: 'Photo',
    profilePhotoHint: 'Photo upload comes in a later version',
    profileEmailHint: 'Email changes go through support',
  },
};

export type MessageKey =
  | 'signInTitle'
  | 'signUpTitle'
  | 'name'
  | 'email'
  | 'password'
  | 'signInAction'
  | 'signUpAction'
  | 'toSignUp'
  | 'toSignIn'
  | 'signOut'
  | 'genericError'
  | 'locked'
  | 'invalidCredentials'
  | 'forgotLink'
  | 'forgotTitle'
  | 'forgotSubmit'
  | 'forgotSent'
  | 'forgotCaptcha'
  | 'forgotOpenWeb'
  | 'backToSignIn'
  | 'catalogEmpty'
  | 'catalogNotFound'
  | 'catalogError'
  | 'catalogBack'
  | 'bookAction'
  | 'bookTitle'
  | 'bookPickSlot'
  | 'bookNoSlots'
  | 'bookConfirm'
  | 'bookSignIn'
  | 'bookDone'
  | 'bookSlotTaken'
  | 'bookFailed'
  | 'bookPayStarted'
  | 'bookPayFailed'
  | 'payMethodTitle'
  | 'payMethodCard'
  | 'payMethodArca'
  | 'payMethodIdram'
  | 'payMethodTelcell'
  | 'payMethodQr'
  | 'payBookingCta'
  | 'tabHome'
  | 'tabProfile'
  | 'tabClasses'
  | 'tabEvents'
  | 'tabShop'
  | 'tabAccount'
  | 'tabAi'
  | 'aiTitle'
  | 'aiOnline'
  | 'aiIntro'
  | 'aiPlaceholder'
  | 'aiThinking'
  | 'aiError'
  | 'aiRateLimited'
  | 'aiSignInTitle'
  | 'aiSignInBody'
  | 'aiSignIn'
  | 'aiClear'
  | 'aiSend'
  | 'aiSuggestion1'
  | 'aiSuggestion2'
  | 'aiSuggestion3'
  | 'aiSuggestion4'
  | 'accountSignOut'
  | 'accountEmpty'
  | 'greetMorning'
  | 'greetDay'
  | 'greetEvening'
  | 'greetNight'
  | 'forYourMood'
  | 'openOnWeb'
  | 'bookSuccessTitle'
  | 'accountMember'
  | 'accountSectionMine'
  | 'accountSectionInfo'
  | 'accountSectionLanding'
  | 'accountSectionHelp'
  | 'accountSectionPartners'
  | 'accountSignOutTitle'
  | 'accountCancel'
  | 'profileTitle'
  | 'profileHint'
  | 'profileSave'
  | 'profileSaved'
  | 'profilePasswordTitle'
  | 'profileCurrentPassword'
  | 'profileNewPassword'
  | 'profilePasswordRules'
  | 'profilePasswordChanged'
  | 'profileWrongPassword'
  | 'profileActionsTitle'
  | 'profileEditable'
  | 'profileLocked'
  | 'profileSoon'
  | 'profileNameHint'
  | 'profilePasswordHint'
  | 'profilePhotoTitle'
  | 'profilePhotoHint'
  | 'profileEmailHint';

export type Messages = Record<MessageKey, string>;

/** Без аргумента возвращает язык, выбранный в приложении; с кодом — проверяет его поддержку, иначе русский. */
export function deviceLocale(systemLocale: string | undefined): Locale {
  if (systemLocale === undefined) return currentLocale();
  const code = systemLocale.slice(0, 2).toLowerCase();
  if (code === 'hy' || code === 'ru' || code === 'en') return code;
  return 'ru';
}

export function messagesFor(locale: Locale): Messages {
  return dictionary[locale];
}

export function greeting(t: Messages, hour = new Date().getHours()): string {
  if (hour < 5) return t.greetNight;
  if (hour < 12) return t.greetMorning;
  if (hour < 18) return t.greetDay;
  return t.greetEvening;
}
