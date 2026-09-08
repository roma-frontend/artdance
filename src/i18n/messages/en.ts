/**
 * EN — эталонный каталог сообщений (source of truth).
 *
 * Правила:
 *  • Любая строка, видимая пользователю, живёт здесь. В JSX нет текста.
 *  • Ключи описывают смысл, а не содержимое: `cta.bookNow`, а не `cta.redButton`.
 *  • Числа/даты/деньги не вставляются в строку — только через ICU-плейсхолдеры
 *    и `formats` из `../config`.
 *  • Структура этого файла определяет типы (`IntlMessages`), поэтому `ru`/`hy`
 *    обязаны повторять её один-в-один. Проверяется `npm run i18n:check`.
 */

const en = {
  brand: {
    name: 'ArtDance',
    tagline: 'Every body has a rhythm.',
    taglineAlt: 'Find your rhythm.',
    positioning: "Armenia's premium dance marketplace",
    madeIn: 'Made in Yerevan',
  },

  common: {
    actions: {
      book: 'Book',
      bookNow: 'Book Now',
      bookClass: 'Book Class',
      bookSession: 'Book a Session',
      explore: 'Explore',
      search: 'Search',
      filter: 'Filter',
      clear: 'Clear',
      clearAll: 'Clear all',
      apply: 'Apply',
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      saveChanges: 'Save changes',
      edit: 'Edit',
      remove: 'Remove',
      delete: 'Delete',
      back: 'Back',
      next: 'Next',
      continue: 'Continue',
      submit: 'Submit',
      close: 'Close',
      viewAll: 'View all',
      viewDetails: 'View details',
      showMore: 'Show more',
      showLess: 'Show less',
      loadMore: 'Load more',
      retry: 'Try again',
      copy: 'Copy',
      copied: 'Copied',
      share: 'Share',
      addToFavorites: 'Save to favorites',
      removeFromFavorites: 'Remove from favorites',
      addToCart: 'Add to cart',
      quickAdd: 'Quick add',
      checkout: 'Checkout',
      signIn: 'Sign in',
      signUp: 'Sign up',
      signOut: 'Sign out',
      sendMessage: 'Send message',
      subscribe: 'Subscribe',
      reschedule: 'Reschedule',
      joinWaitlist: 'Join waitlist',
      selectDate: 'Select date',
      selectTime: 'Select time',
    },
    states: {
      loading: 'Loading…',
      saving: 'Saving…',
      processing: 'Processing…',
      empty: 'Nothing here yet',
      noResults: 'No results found',
      noResultsHint: 'Try changing filters or widening your search.',
      offline: 'You appear to be offline',
      comingSoon: 'Coming soon',
    },
    labels: {
      from: 'From',
      to: 'To',
      perClass: 'per class',
      perHour: 'per hour',
      perMonth: 'per month',
      perYear: 'per year',
      perSession: 'per session',
      level: 'Level',
      style: 'Style',
      duration: 'Duration',
      date: 'Date',
      time: 'Time',
      location: 'Location',
      instructor: 'Instructor',
      studio: 'Studio',
      /**
       * Вид сущности одним словом. Используется на карточках для соцсетей, где
       * метка отвечает «что это вообще»: занятие, преподаватель, событие.
       * Единственное число, а не название раздела — речь об одном объекте.
       */
      class: 'Class',
      event: 'Event',
      price: 'Price',
      total: 'Total',
      subtotal: 'Subtotal',
      discount: 'Discount',
      delivery: 'Delivery',
      vat: 'VAT',
      free: 'Free',
      capacity: 'Capacity',
      quantity: 'Quantity',
      rating: 'Rating',
      reviews: 'Reviews',
      students: 'Students',
      experience: 'Experience',
      verified: 'Verified',
      andMore: '+{count} more',
      optional: 'optional',
      required: 'required',
      language: 'Language',
      theme: 'Theme',
      currency: 'Currency',
    },
    units: {
      minutes: '{count, plural, one {# minute} other {# minutes}}',
      hours: '{count, plural, one {# hour} other {# hours}}',
      days: '{count, plural, one {# day} other {# days}}',
      /** Диапазон дней: срок доставки. Отдельный ключ — плюрализация по диапазону невозможна. */
      daysRange: '{min}–{max} days',
      months: '{count, plural, one {# month} other {# months}}',
      years: '{count, plural, one {# year} other {# years}}',
      yearsExperience: '{count, plural, one {# year experience} other {# years experience}}',
      squareMeters: '{value} m²',
      kilometers: '{value} km',
    },
    counts: {
      classes: '{count, plural, =0 {No classes} one {# class} other {# classes}}',
      instructors: '{count, plural, =0 {No instructors} one {# instructor} other {# instructors}}',
      studios: '{count, plural, =0 {No studios} one {# studio} other {# studios}}',
      reviews: '{count, plural, =0 {No reviews} one {# review} other {# reviews}}',
      students: '{count, plural, one {# student} other {# students}}',
      items: '{count, plural, one {# item} other {# items}}',
      spotsLeft: '{count, plural, =0 {Fully booked} one {# spot left} other {# spots left}}',
      results: '{count, plural, =0 {No results} one {# result} other {# results}}',
    },
    theme: {
      light: 'Light',
      dark: 'Dark',
      system: 'System',
      toggle: 'Switch theme',
      switchToLight: 'Switch to light theme',
      switchToDark: 'Switch to dark theme',
      switchToSystem: 'Follow system theme',
    },
  },

  nav: {
    home: 'Home',
    discover: 'Discover',
    classes: 'Classes',
    styles: 'Styles',
    courses: 'Courses',
    instructors: 'Instructors',
    studios: 'Studios',
    events: 'Events',
    shop: 'Shop',
    calendar: 'Calendar',
    pricing: 'Pricing',
    cart: 'Cart',
    account: 'Account',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    menuTitle: 'Menu',
    menuDescription: 'Site sections and quick links',
    openSearch: 'Open search',
    skipToContent: 'Skip to content',
  },

  search: {
    placeholder: 'Search dancers, classes, studios…',
    heroPlaceholder: 'What do you want to dance?',
    scopeAll: 'Everything',
    scopeClasses: 'Classes',
    scopeInstructors: 'Instructors',
    scopeStudios: 'Studios',
    scopeProducts: 'Products',
    scopeEvents: 'Events',
    anyDate: 'Any date',
    anyStyle: 'Any style',
    recent: 'Recent searches',
    popular: 'Popular right now',
    minLength: 'Type at least {min} characters',
    resultsTitle: 'Results',
    noResults: 'Nothing found for “{query}”',
    noResultsHint: 'Check the spelling or search the full catalog.',
    viewAll: 'See all results',
    failed: 'Search is unavailable right now.',
  },

  home: {
    hero: {
      badge: "Yerevan's #1 Dance Platform",
      titleLine1: 'Move',
      titleAccent: 'Different.',
      subtitle:
        "Discover classes, instructors, studios and everything you need to move. Armenia's premium dance marketplace.",
      primaryCta: 'Explore Classes',
      secondaryCta: 'Find an Instructor',
      statActiveDancers: 'Active dancers',
      statInstructors: 'Expert instructors',
      statStyles: 'Dance styles',
      statRating: 'Average rating',
      scrollHint: 'Scroll to explore',
      videoPlay: 'Play the background video',
      videoPause: 'Pause the background video',
    },
    discover: {
      eyebrow: 'Discover',
      title: 'Find your way to dance.',
      subtitle: '{styles} dance styles, hundreds of classes, and the best instructors in Yerevan.',
    },
    popular: {
      eyebrow: 'Popular right now',
      title: "Classes everyone's talking about",
      subtitle: 'Booked most often over the last seven days.',
    },
    instructors: {
      eyebrow: 'Meet the masters',
      title: 'Learn from people who live the movement.',
      subtitle: 'Verified profiles, real students, honest reviews.',
    },
    editorial: {
      titleLine1: 'Every body',
      titleLine2: 'has a',
      titleAccent: 'rhythm.',
      subtitle: 'Find yours.',
      cta: 'Start dancing',
    },
    studios: {
      eyebrow: 'Find your space',
      title: 'Premium studios in Yerevan.',
      subtitle: 'Rent by the hour — mirrors, sound, sprung floors.',
    },
    shop: {
      eyebrow: 'Shop',
      title: 'Dancewear & accessories.',
      subtitle: 'Gear tested by the instructors who teach in it.',
    },
    events: {
      eyebrow: 'Upcoming events',
      title: 'Workshops, battles & more.',
      subtitle: "What's happening on the Yerevan dance scene.",
    },
    testimonials: {
      eyebrow: 'Testimonials',
      title: 'What our dancers say.',
      subtitle: 'Real stories from the community.',
    },
    newsletter: {
      eyebrow: 'Stay in the rhythm',
      title: 'Get dance updates',
      subtitle: 'New classes, events and workshops — once a week, nothing else.',
      emailLabel: 'Email',
      emailPlaceholder: 'your@email.com',
      cta: 'Subscribe',
      success: "You're in. Check your inbox to confirm.",
      alreadySubscribed: 'This email is already on the list.',
      error: 'We could not subscribe you. Please try again.',
      consent: 'By subscribing you agree to our <privacyLink>Privacy policy</privacyLink>.',
    },
    finalCta: {
      title: 'Ready to move?',
      subtitle: 'Your first class is on us.',
      primaryCta: 'Book a free trial',
      secondaryCta: 'View schedule',
    },
  },

  /**
   * Листинги каталога: `/discover`, `/classes`, `/instructors`, `/studios`,
   * `/events`, `/shop`.
   *
   * Один namespace вместо шести почти одинаковых. Фильтры, сортировка, пустое
   * состояние и пагинация у всех листингов общие, а расхождение подписи
   * «Sort by» между разделами — не локализация, а ошибка, которую замечает
   * пользователь и не замечает разработчик.
   */
  catalog: {
    discover: {
      title: 'Discover classes',
      subtitle: 'Find the right class for your level, style and schedule.',
    },
    classes: {
      title: 'Classes',
      subtitle: 'Group classes across every style, level and district of Yerevan.',
    },
    instructors: {
      title: 'Instructors',
      subtitle: 'Verified teachers with real reviews. Compare styles, rates and availability.',
    },
    studios: {
      title: 'Studios',
      subtitle: 'Rehearsal and teaching spaces across Yerevan, rented by the hour.',
    },
    events: {
      title: 'Events',
      subtitle: 'Workshops, battles, masterclasses and showcases.',
    },
    shop: {
      title: 'Shop',
      subtitle: 'Premium dancewear, shoes and accessories.',
    },
    filters: {
      title: 'Filters',
      openCta: 'Filters',
      allStyles: 'All styles',
      allLevels: 'All levels',
      allDistricts: 'All districts',
      allCategories: 'All categories',
      district: 'District',
      priceRange: 'Price range',
      priceUpTo: 'Up to {price}',
      priceAny: 'Any price',
      dateRange: 'Date',
      applied: '{count, plural, one {# filter} other {# filters}}',
      reset: 'Reset filters',
    },
    sort: {
      label: 'Sort by',
      relevance: 'Relevance',
      priceAsc: 'Price: low to high',
      priceDesc: 'Price: high to low',
      ratingDesc: 'Highest rated',
      soonest: 'Starting soonest',
      newest: 'Newest',
    },
    empty: {
      title: 'Nothing matches these filters',
      description: 'Try a wider price range, another style, or clear the filters.',
    },
    pagination: {
      summary: 'Page {page} of {total}',
    },
  },

  classDetail: {
    trendingBadge: 'Trending',
    fullBadge: 'Full',
    aboutTitle: 'About this class',
    learnTitle: "What you'll learn",
    instructorTitle: 'Instructor',
    locationTitle: 'Location',
    reviewsTitle: 'Reviews',
    scheduleTitle: 'Schedule',
    availabilityTitle: 'Availability',
    capacityNote: 'Group of up to {count}',
    priceNote: '{price} · {duration}',
    cancellationNote: 'Free cancellation up to {hours} before the class.',
    waitlistNote: 'This class is full. Join the waitlist and we will notify you if a spot opens.',
    similarTitle: 'Similar classes',
    similarEmpty: 'No similar classes in this style yet.',
  },

  instructor: {
    verifiedBadge: 'Verified',
    aboutTitle: 'About {name}',
    stylesTitle: 'Styles',
    specializationsTitle: 'Specializations',
    experienceTitle: 'Experience',
    experiencePresent: 'Present',
    experienceRange: '{from} — {to}',
    venuesTitle: 'Teaches at',
    classesTitle: 'Classes',
    classesEmpty: 'No group classes scheduled right now.',
    privateSessionsTitle: 'Private sessions',
    availabilityTitle: 'Availability',
    reviewsTitle: 'Reviews',
    bookPanelTitle: 'Book a session',
    rateFrom: 'From {price} / hour',
    locationNote: '{studio} or your location',
    availabilityNote: 'Available this week',
    travelAvailable: 'Travels to you within {radius}',
    travelUnavailable: 'Studio and online sessions only',
    quickBookTitle: 'Quick book',
    quickBookNext: 'Next available: {when}',
    statsRating: '{rating} ({count})',
    statsStudents: '{count}+ students',
    becomeInstructorCta: 'Teach on ArtDance',
  },

  studio: {
    title: 'Studios',
    subtitle: 'Rehearsal and teaching spaces across Yerevan.',
    aboutTitle: 'About the space',
    amenitiesTitle: 'Amenities',
    roomsTitle: 'Rooms',
    rulesTitle: 'House rules',
    classesTitle: 'Classes here',
    classesEmpty: 'No classes scheduled here yet.',
    eventsTitle: 'Events here',
    mapTitle: 'Getting there',
    areaLabel: 'Area',
    capacityNote: 'Up to {count} dancers',
    districtLabel: 'District',
    bookCta: 'Book the space',
    rentPerHour: '{price} / hour',
    areaNote: '{area} · {amenities}',
    listYourStudioCta: 'List your studio',
    amenities: {
      mirrors: 'Mirrors',
      soundSystem: 'Sound system',
      sprungFloor: 'Sprung floor',
      woodFloor: 'Wood floor',
      barre: 'Barre',
      showers: 'Showers',
      lockers: 'Lockers',
      changingRoom: 'Changing room',
      airConditioning: 'Air conditioning',
      naturalLight: 'Natural light',
      parking: 'Parking',
      wifi: 'Wi-Fi',
      waterDispenser: 'Water dispenser',
      wheelchairAccess: 'Wheelchair access',
    },
  },

  events: {
    title: 'Events',
    subtitle: 'Workshops, battles, masterclasses and showcases.',
    aboutTitle: 'About this event',
    whenTitle: 'When',
    whereTitle: 'Where',
    spotsTitle: 'Spots',
    capacityNote: 'Capacity {count}',
    registerCta: 'Register',
    typeWorkshop: 'Workshop',
    typeBattle: 'Battle',
    typeMasterclass: 'Masterclass',
    typeShowcase: 'Showcase',
    typeSocial: 'Social',
    typeCompetition: 'Competition',
    freeEntry: 'Free entry',
    openEntry: 'Open',
    timeRange: '{start}–{end}',
  },

  courses: {
    title: 'Online courses',
    subtitle: 'Learn at your own pace, from the instructors you already trust.',
    lessonsCount: '{count, plural, one {# lesson} other {# lessons}}',
    totalDuration: 'Total {duration}',
    enrollCta: 'Enroll',
    enrolledBadge: 'Enrolled',
    progressLabel: '{percent} complete',
    curriculumTitle: 'Curriculum',
    requirementsTitle: 'Requirements',
  },

  shop: {
    title: 'Shop',
    subtitle: 'Premium dancewear, shoes and accessories.',
    categoriesTitle: 'Categories',
    descriptionTitle: 'Description',
    variantTitle: 'Choose your option',
    relatedTitle: 'You may also like',
    galleryLabel: 'Product photos',
    chooseAmount: 'Choose an amount',
    selectVariantFirst: 'Choose an option before adding to your bag',
    sizeLabel: 'Size',
    colorLabel: 'Color',
    sizeGuide: 'Size guide',
    inStock: 'In stock',
    lowStock: 'Only {count} left',
    outOfStock: 'Out of stock',
    notifyMe: 'Notify me when available',
    giftCardTitle: 'Gift card',
    giftCardSubtitle: 'Let them choose. Valid for {months} months.',
    freeDeliveryHint: 'Free delivery on orders over {threshold}.',
    returnsHint: '{days}-day returns.',
  },

  cart: {
    title: 'Your bag',
    empty: 'Your bag is empty',
    emptyHint: 'Add classes, gear or a gift card to get started.',
    emptyCta: 'Browse the shop',
    summaryTitle: 'Order summary',
    itemsCount: 'Subtotal ({count, plural, one {# item} other {# items}})',
    promoPlaceholder: 'Promo code',
    promoApply: 'Apply',
    promoApplied: 'Code {code} applied',
    promoInvalid: 'This code is not valid',
    pricesChanged: 'Prices in your bag have changed. Check the total before you pay.',
    trustSecure: 'Secure',
    trustReturns: 'Free returns',
    trustPayments: 'ARCA / Idram / Telcell',
    removedToast: '{name} removed from your bag',
  },

  checkout: {
    title: 'Checkout',
    steps: {
      contact: 'Contact',
      delivery: 'Delivery',
      payment: 'Payment',
      confirm: 'Confirm',
    },
    contact: {
      title: 'Contact details',
      firstName: 'First name',
      lastName: 'Last name',
      email: 'Email',
      phone: 'Phone',
      createAccountLabel: 'Create an account to track my orders',
      guestNote: 'You can check out as a guest.',
    },
    delivery: {
      title: 'Delivery',
      methodCourier: 'Courier',
      methodPickup: 'Pickup point',
      address: 'Address',
      city: 'City',
      postalCode: 'Postal code',
      notes: 'Delivery notes',
      estimate: 'Estimated {min}–{max} business days',
    },
    payment: {
      title: 'Payment method',
      methodCard: 'Bank card',
      methodArca: 'ARCA',
      methodIdram: 'Idram',
      methodTelcell: 'Telcell',
      methodQr: 'ArcaQR',
      methodCash: 'Cash on delivery',
      cardNumber: 'Card number',
      expiry: 'Expiry',
      cvv: 'CVV',
      cardholder: 'Cardholder name',
      billingTitle: 'Billing address',
      sameAsDelivery: 'Same as delivery address',
      redirectNote: 'You will be redirected to your bank to complete the payment.',
      submitCta: 'Complete payment — {total}',
    },
    trust: {
      ssl: '256-bit SSL',
      arcaVerified: 'Verified by ARCA',
      buyerProtection: 'Buyer protection',
      returns: '{days}-day returns',
    },
    result: {
      successTitle: 'Payment received',
      successSubtitle: 'Order {orderNumber} is confirmed. We emailed you the details.',
      pendingTitle: 'Payment is being processed',
      pendingSubtitle: 'This usually takes under a minute. We will email you as soon as it clears.',
      failedTitle: 'Payment did not go through',
      failedSubtitle: 'No money has been taken. You can try another method.',
      viewOrderCta: 'View order',
      retryCta: 'Try again',
    },
    /**
     * Ссылки — теги, а не плейсхолдеры: подпись ссылки должна переводиться
     * вместе с фразой (в русском и армянском она стоит в косвенном падеже).
     */
    termsConsent:
      'By placing this order you accept the <terms>Terms of Service</terms> and <refund>Refund Policy</refund>.',
  },

  booking: {
    title: 'Choose date & time',
    /** Страница входа в бронирование: сначала инструктор, потом дата и время. */
    startTitle: 'Book a session',
    startSubtitle: 'Pick an instructor and choose a time that works for you.',
    subtitleWith: '{title} with {instructor}',
    calendarTitle: '{month}',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    availableTimes: 'Available times — {date}',
    noSlots: 'No available times on this date',
    noSlotsHint: 'Try another day or check the instructor’s availability.',
    /** Диапазон занятия: «18:00–19:30». Тире — не дефис, а короткое тире. */
    timeRange: '{start}–{end}',
    locationTitle: 'Location options',
    locationStudio: 'At the studio',
    locationStudioNote: '{studio} · included',
    locationCustomer: 'My location',
    locationCustomerNote: '+{fee} travel fee',
    locationOnline: 'Online',
    locationOnlineNote: 'Video call session',
    summaryTitle: 'Booking summary',
    summaryClass: 'Class',
    summaryInstructor: 'Instructor',
    summaryDate: 'Date',
    summaryTime: 'Time',
    summaryDuration: 'Duration',
    summaryLocation: 'Location',
    summaryFee: 'Class fee',
    continueCta: 'Continue to payment',
    cancellationNote: 'Free cancellation up to {hours} before the session.',
    holdNotice: 'This slot is held for you for {minutes}.',
    holdExpired: 'Your slot hold expired. Please pick a time again.',
    conflictError: 'This time was just taken. Please choose another slot.',
    leadTimeError: 'Bookings must be made at least {hours} in advance.',
    horizonError: 'Bookings open up to {days} ahead.',
    confirmedTitle: 'Booking confirmed',
    confirmedSubtitle: 'See you on {when}.',
    cancelTitle: 'Cancel this booking?',
    cancelFree: 'You are within the free cancellation window — you will be refunded in full.',
    cancelLate: 'You are past the free window: {rate} of the price will be withheld.',
    rescheduleTitle: 'Reschedule booking',
    rescheduleLimit: 'You have reached the maximum number of reschedules for this booking.',
  },

  auth: {
    signIn: {
      title: 'Welcome back',
      subtitle: 'Sign in to manage your bookings.',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      forgotLink: 'Forgot password?',
      submit: 'Sign in',
      noAccount: 'New to ArtDance?',
      signUpLink: 'Create an account',
      googleCta: 'Continue with Google',
      orDivider: 'or',
      invalidCredentials: 'Email or password is incorrect.',
      tooManyAttempts: 'Too many attempts. Try again in {minutes}.',
    },
    signUp: {
      title: 'Create your account',
      subtitle: 'Book classes, save favorites, track your progress.',
      nameLabel: 'Full name',
      submit: 'Create account',
      hasAccount: 'Already have an account?',
      signInLink: 'Sign in',
      termsConsent:
        'I accept the <termsLink>Terms of service</termsLink> and <privacyLink>Privacy policy</privacyLink>',
      emailTaken: 'An account with this email already exists.',
      verifySent: 'We sent a confirmation link to {email}.',
    },
    forgotPassword: {
      title: 'Reset your password',
      subtitle: 'We will email you a reset link.',
      submit: 'Send reset link',
      sent: 'If an account exists for {email}, the link is on its way.',
      backToSignIn: 'Back to sign in',
    },
    resetPassword: {
      title: 'Choose a new password',
      newPassword: 'New password',
      confirmPassword: 'Confirm password',
      submit: 'Update password',
      success: 'Password updated. You can sign in now.',
      invalidToken: 'This reset link is invalid or has expired.',
    },
    otp: {
      title: 'Enter the code',
      subtitle: 'We sent a {length}-digit code to {target}.',
      resend: 'Resend code',
      resendIn: 'Resend available in {seconds}',
      invalid: 'That code is not correct.',
      expired: 'The code has expired. Request a new one.',
    },
    roles: {
      customer: 'Dancer',
      instructor: 'Instructor',
      venueOwner: 'Studio owner',
      admin: 'Administrator',
      support: 'Support',
    },
  },

  account: {
    title: 'My account',
    nav: {
      overview: 'Overview',
      bookings: 'Bookings',
      orders: 'Orders',
      favorites: 'Favorites',
      reviews: 'My reviews',
      subscription: 'Subscription',
      settings: 'Settings',
    },
    bookings: {
      title: 'My bookings',
      upcoming: 'Upcoming',
      past: 'Past',
      cancelled: 'Cancelled',
      empty: 'No bookings yet',
      emptyCta: 'Find a class',
    },
    orders: {
      title: 'My orders',
      empty: 'No orders yet',
      orderNumber: 'Order {number}',
      placedOn: 'Placed {date}',
      trackCta: 'Track order',
      invoiceCta: 'Download invoice',
    },
    settings: {
      title: 'Settings',
      profileSection: 'Profile',
      preferencesSection: 'Preferences',
      notificationsSection: 'Notifications',
      securitySection: 'Security',
      dangerSection: 'Danger zone',
      notifyEmail: 'Email notifications',
      notifySms: 'SMS notifications',
      notifyMarketing: 'News and offers',
      changePassword: 'Change password',
      deleteAccount: 'Delete account',
      deleteAccountNote:
        'Your account will be deactivated immediately and permanently deleted after {days}.',
    },
  },

  pricing: {
    eyebrow: 'Membership',
    title: 'Choose your path',
    subtitle: 'Flexible plans for every dancer — from curious beginner to committed performer.',
    monthly: 'Monthly',
    yearly: 'Yearly',
    yearlySaveBadge: 'Save {percent}',
    perMonth: '/ month',
    perYear: '/ year',
    mostPopular: 'Most popular',
    trialBadge: '{days} free',
    selectCta: 'Choose {plan}',
    currentPlan: 'Current plan',
    comparisonTitle: 'Compare plans',
    comparisonSubtitle: 'Everything each plan includes, side by side.',
    includedTitle: 'What you get',
    yearlyNote: 'or {price} billed yearly',
    vatNote: 'All prices include VAT at {rate}.',
    cancelAnytime: 'Cancel any time — the plan runs to the end of the period you paid for.',
    planColumn: 'Plan',
    quota: {
      groupClasses: 'Group classes per month',
      privateSessions: 'Private sessions per month',
      styles: 'Dance styles',
      priorityBooking: 'Priority booking',
      progressJournal: 'Progress journal',
      studioDiscount: 'Studio rental discount',
      guestWorkshops: 'Guest instructor workshops',
      competitionPrep: 'Competition preparation',
      vipEvents: 'VIP event access',
      unlimited: 'Unlimited',
      allStyles: 'All',
      included: 'Included',
      notIncluded: 'Not included',
    },
    payAsYouGo: {
      title: 'Not ready to commit?',
      body: 'Every class can be booked one at a time, at the price shown in the catalogue. A plan only pays off from about four classes a month.',
      cta: 'Browse classes',
    },
    comingSoon: {
      title: 'Memberships are on the way',
      body: 'For now every class, private lesson and hall is booked and paid for one at a time.',
      cta: 'Browse classes',
    },
    plans: {
      starter: {
        name: 'Starter',
        description: 'For beginners exploring dance.',
      },
      pro: {
        name: 'Pro Dancer',
        description: 'For dedicated dancers ready to level up.',
      },
      elite: {
        name: 'Elite',
        description: 'For serious performers who want everything.',
      },
    },
    features: {
      groupClasses: '{count} group classes per month',
      unlimitedGroupClasses: 'Unlimited group classes',
      privateSessions: '{count} private sessions per month',
      unlimitedPrivateSessions: 'Unlimited private sessions',
      styleAccess: 'Access to {count} dance styles',
      allStyles: 'All dance styles',
      communityEvents: 'Community events',
      mobileApp: 'Mobile app access',
      progressJournal: 'Dance journal & progress tracking',
      priorityBooking: 'Priority booking',
      performanceOpportunities: 'Performance opportunities',
      everythingInPro: 'Everything in Pro Dancer',
      competitionPrep: 'Competition preparation',
      guestWorkshops: 'Guest instructor workshops',
      studioRentalDiscount: '{percent} off studio rentals',
      vipEvents: 'VIP event access',
    },
  },

  reviews: {
    title: 'Reviews',
    writeTitle: 'Write a review',
    ratingLabel: 'Your rating',
    textLabel: 'Your review',
    textPlaceholder: 'What was the class like? What should other dancers know?',
    submit: 'Publish review',
    pendingNotice: 'Thanks — your review will appear after a quick moderation check.',
    verifiedBadge: 'Verified booking',
    averageOf: '{rating} out of {max}',
    notEnough: 'Not enough reviews yet',
    empty: 'No reviews yet',
    emptyHint: 'Be the first to share how it went.',
    onlyAfterBooking: 'You can review a class after attending it.',
    windowClosed: 'The review window for this booking has closed.',
  },

  /**
   * Избранное. Отдельный namespace, а не пара строк в `common.actions`: у
   * кнопки есть состояние «нужен вход», у списка — пустое состояние, и оба они
   * относятся к разделу, а не к надписи на кнопке.
   */
  favorites: {
    title: 'Favorites',
    empty: 'Nothing saved yet',
    emptyHint: 'Tap the heart on a class, instructor or studio to keep it here.',
    signInRequired: 'Sign in to save favorites',
    added: 'Saved to favorites',
    removed: 'Removed from favorites',
    toggleLabel: 'Save {name} to favorites',
    toggleLabelActive: 'Remove {name} from favorites',
  },

  danceStyles: {
    hipHop: 'Hip-Hop',
    ballet: 'Ballet',
    salsa: 'Salsa',
    bachata: 'Bachata',
    contemporary: 'Contemporary',
    heels: 'Heels',
    kpop: 'K-Pop',
    latin: 'Latin',
    tango: 'Tango',
    armenianFolk: 'Armenian Folk',
    jazz: 'Jazz',
    breaking: 'Breaking',
    flamenco: 'Flamenco',
    ballroom: 'Ballroom',
    afro: 'Afro',
    weddingDance: 'Wedding Dance',
    kids: 'Kids',
    stretching: 'Stretching & Conditioning',
  },

  levels: {
    allLevels: 'All levels',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    professional: 'Professional',
  },

  /**
   * Хабы направлений (`/styles`, `/styles/[style]`).
   *
   * `styles.*` — редакционный материал платформы: чем этот танец является, кому
   * подходит, что взять на первое занятие. Он и делает страницу самостоятельным
   * документом, а не каталогом с подставленным названием. Остальные ключи —
   * каркас, одинаковый для всех восемнадцати направлений, поэтому название
   * подставляется плейсхолдером.
   */
  styleHub: {
    eyebrow: 'Dance style',
    index: {
      title: 'Dance styles in Yerevan',
      subtitle:
        'Eighteen directions, from ballet to breaking. Open one to see who teaches it, where, at what level and for how much.',
      liveTitle: 'On the timetable now',
      liveSubtitle: 'Directions with classes you can book this week.',
      allTitle: 'Every direction',
      allSubtitle: 'Including the ones we are still looking for instructors for.',
    },
    title: '{style} classes in Yerevan',
    aboutTitle: 'What {style} is',
    gearTitle: 'What to bring to the first class',
    classesTitle: '{style} classes',
    classesAll: 'All {style} classes',
    classesEmptyTitle: 'No {style} classes on the timetable yet',
    classesEmptyBody:
      'Nobody is teaching {style} on ArtDance this week. Try a related direction below, or bring your own classes here.',
    instructorsTitle: 'Who teaches {style}',
    instructorsAll: 'All {style} instructors',
    instructorsEmptyTitle: 'No {style} instructors yet',
    instructorsEmptyBody: 'If you teach {style} in Yerevan, this page is waiting for you.',
    studiosTitle: 'Where {style} is taught',
    studiosAll: 'All studios',
    relatedTitle: 'Close to {style}',
    relatedSubtitle: 'Dancers who train {style} usually try these next.',
    cta: {
      title: 'Ready to try {style}?',
      subtitle: 'Take a place in a group class, or book a private lesson and start at your own pace.',
      primary: 'Browse classes',
      secondary: 'Find an instructor',
    },
    /** Направление объявлено, но преподавателя ещё нет. Честнее, чем «0 занятий». */
    seeking: 'Looking for instructors',
    styles: {
      hipHop: {
        lede: 'Groove, isolations and choreography out of the street tradition. The most-taught direction in Yerevan, and the easiest one to start with.',
        about:
          'Hip-hop grew out of block parties in the Bronx in the seventies and turned into a family of styles — from bouncy old-school grooves to hard-hitting choreography of the internet era. Classes teach the basics first: how weight moves, how a beat is answered. Routines come after that.',
        gear: 'Trainers with a flat sole, loose trousers, a t-shirt and water. Nothing else is needed for the first class.',
      },
      ballet: {
        lede: 'Barre, alignment and turnout — the school standing behind every other stage dance. Adults start here more often than children.',
        about:
          'Ballet is a four-hundred-year-old system with its own vocabulary in French and its own logic of movement. Adult classes keep the structure — barre, centre, allegro — without the ambition of a professional career: they build the alignment, control and strength every other style borrows.',
        gear: 'Ballet slippers or thick socks, fitted clothes so the teacher can see the line, hair tied back.',
      },
      salsa: {
        lede: 'A Caribbean partner dance with fast turns and an open hold. Two lessons are enough to dance a whole social night.',
        about:
          'Salsa is counted in eight beats with a pause, and that pause is what makes it forgiving: the pattern comes back every bar. Yerevan dances mostly the linear LA style and the circular Cuban one. Both are taught in pairs with partners rotating, so coming alone is normal.',
        gear: 'Shoes with a smooth sole that lets the foot turn, comfortable clothes, a spare t-shirt.',
      },
      bachata: {
        lede: 'Four steps, a hip on the fourth and a close hold. The gentlest way into partner dancing in the city.',
        about:
          'Bachata came from the Dominican Republic and reached the world in its modern, sensual form. The basic step takes a single class; everything after that is connection, body movement and musicality rather than new figures.',
        gear: 'Shoes that turn easily, clothes you can move sideways in, deodorant — this is a close-hold dance.',
      },
      contemporary: {
        lede: 'Floorwork, breath and weight instead of fixed positions. The direction people choose when they want to dance their own thing.',
        about:
          'Contemporary grew from a refusal of classical rules and kept the technique: release, contraction, contact with the floor. A class is usually a warm-up on the floor, a travelling phrase and time for improvisation — the part most people come back for.',
        gear: 'Bare feet or socks, knees covered for floorwork, layers you can peel off.',
      },
      heels: {
        lede: 'Choreography in heels: posture, ankle control and stage presence. Height comes later than technique.',
        about:
          'Heels is a young direction rooted in jazz and cabaret, built around the way heels change balance and lengthen a line. The first weeks go on walking, transferring weight and holding the ankle; choreography follows once the floor feels safe.',
        gear: 'Closed-toe heels with a strap, five to seven centimetres for the first months, knee pads and water.',
      },
      kpop: {
        lede: 'Routines from Korean releases, learned note for note — as a group, in formation, with the camera in mind.',
        about:
          'K-pop covers are a discipline of precision: the class learns an existing routine in the original formation, with the same accents and the same framing. The technique comes from hip-hop and jazz-funk; the pleasure comes from moving in sync with seven other people.',
        gear: 'Trainers, clothes close to the original if you like, and a phone with a full battery for the video.',
      },
      latin: {
        lede: 'Salsa, bachata, cha-cha and merengue in one course — the fastest way to find which of them is yours.',
        about:
          'Latin classes cover the family rather than a single dance: the same weight change and the same lead work in all of them, and the differences live in rhythm and character. Useful when you want to dance at any party rather than to specialise.',
        gear: 'Shoes with a smooth sole, comfortable clothes, water.',
      },
      tango: {
        lede: 'Argentine tango: an embrace, a walk and a pause. Danced slowly, learned for years, enjoyed from the first month.',
        about:
          'Tango is improvisation inside a strict frame: no set routine, only an embrace, a shared axis and a walk that answers the music. Classes work in pairs with rotation, and the first weeks go almost entirely on walking together.',
        gear: 'Shoes with a leather or suede sole and a secure heel, clothes that do not restrict the torso.',
      },
      armenianFolk: {
        lede: 'Kochari, Shalakho and the dances of the regions — the ones that open every wedding and every village celebration.',
        about:
          'Armenian folk dance is a set of regional traditions kept alive by ensembles and family celebrations: shoulder-to-shoulder circle dances, men’s dances with weight in the knees, women’s dances built on the wrists. Classes teach the steps and where they come from.',
        gear: 'Soft shoes with a flat sole, clothes that allow a wide step, nothing loose on the wrists.',
      },
      jazz: {
        lede: 'Stage jazz: clean lines, sharp accents and turns. The technique behind musical theatre and half of all show choreography.',
        about:
          'Jazz dance took ballet’s discipline and gave it syncopation and freedom in the torso. A class runs through a warm-up, isolations and progressions across the floor, then a combination — usually to something with brass in it.',
        gear: 'Jazz shoes or socks, fitted clothes, water.',
      },
      breaking: {
        lede: 'Toprock, footwork, freezes and power moves. An Olympic sport that is still a street dance.',
        about:
          'Breaking is the oldest of the street styles and the most physical: danced on the floor, in a circle, in exchanges with other dancers. Beginners spend months on toprock and six-step before anything spins, and that order is what protects wrists and shoulders.',
        gear: 'Trainers with a firm sole, long sleeves and long trousers, knee pads, a cap if you like.',
      },
      flamenco: {
        lede: 'The compás, footwork and arms of Andalusia — a dance you learn to clap before you learn to dance it.',
        about:
          'Flamenco is built on rhythmic cycles that the dancer marks with heels, hands and posture rather than on choreography. Classes start with palmas and the twelve-beat compás, because in flamenco the count carries the dance, not the step.',
        gear: 'Shoes with a hard heel, a skirt or trousers that let you feel the leg, water.',
      },
      ballroom: {
        lede: 'Standard and Latin in pairs: waltz, tango, quickstep, cha-cha, rumba, jive. Learned as a couple, useful for life.',
        about:
          'Ballroom is a codified system of ten dances with strict frames, taught in couples from the first class. The technique transfers — posture, lead and follow, floorcraft — which is why couples preparing for a wedding and dancers preparing for competitions share the same room.',
        gear: 'Shoes with a suede sole, clothes with a defined waist, a partner if you have one — if not, we rotate.',
      },
      afro: {
        lede: 'Afrobeats and traditional West African dance: grounded weight, a loose chest and a great deal of rhythm.',
        about:
          'Afro classes in the city mix two things: traditional forms that follow live-drum logic, and modern Afrobeats out of Lagos and Accra. Both start low in the knees and ask the ribcage to move on its own — which is exactly what makes them the best cardio on the timetable.',
        gear: 'Bare feet or light trainers, clothes that breathe, water and a towel.',
      },
      weddingDance: {
        lede: 'Your first dance, rehearsed to the song you chose, in the shoes and the dress you will actually wear.',
        about:
          'A wedding dance is a short private course rather than a style: two to eight sessions in which a choreographer builds a routine around your song, your dress and your level. Most couples start six to eight weeks before the date; three sessions are enough for a calm, clean minute and a half.',
        gear: 'From the second session — the shoes you will wear on the day, and a recording of your song.',
      },
      kids: {
        lede: 'Dance for children from four: coordination, rhythm and a stage they can walk onto without fear.',
        about:
          'Children’s classes are not adult classes made shorter. They are built around attention span and a growing body: games that teach rhythm, floor exercises instead of loaded jumps, and a small performance at the end of term — the part children remember.',
        gear: 'Comfortable clothes with no hood or drawstrings, soft shoes, and a water bottle with a name on it.',
      },
      stretching: {
        lede: 'Stretching and conditioning for dancers: mobility, splits, and the strength that keeps them safe.',
        about:
          'This is the class that makes the other classes possible: hips and shoulders open, the spine articulates, the centre holds. Sessions mix active stretching with strength work, because range without strength is what injures dancers rather than what protects them.',
        gear: 'A mat if you have one, fitted clothes, socks, and a belt or towel for holds.',
      },
    },
  },

  status: {
    booking: {
      pending: 'Pending',
      confirmed: 'Confirmed',
      completed: 'Completed',
      cancelledByCustomer: 'Cancelled by you',
      cancelledByProvider: 'Cancelled by provider',
      noShow: 'No-show',
      rescheduled: 'Rescheduled',
      waitlisted: 'Waitlisted',
      expired: 'Expired',
    },
    payment: {
      pending: 'Awaiting payment',
      authorized: 'Authorized',
      paid: 'Paid',
      partiallyRefunded: 'Partially refunded',
      refunded: 'Refunded',
      failed: 'Failed',
      cancelled: 'Cancelled',
      chargeback: 'Chargeback',
    },
    order: {
      created: 'Created',
      paid: 'Paid',
      packing: 'Packing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      returned: 'Returned',
    },
    payout: {
      scheduled: 'Scheduled',
      processing: 'Processing',
      paid: 'Paid',
      failed: 'Failed',
      onHold: 'On hold',
    },
    moderation: {
      pending: 'Pending review',
      approved: 'Published',
      rejected: 'Rejected',
    },
  },

  footer: {
    description:
      "Armenia's premium dance marketplace. Connecting dancers, instructors and studios — and everything you need to move.",
    exploreTitle: 'Explore',
    companyTitle: 'Company',
    supportTitle: 'Support',
    businessTitle: 'Business',
    legalTitle: 'Legal',
    about: 'About us',
    contact: 'Contact',
    faq: 'FAQ',
    help: 'Help center',
    blog: 'Blog',
    becomeInstructor: 'Become an instructor',
    listStudio: 'List your studio',
    giftCards: 'Gift cards',
    terms: 'Terms of service',
    privacy: 'Privacy policy',
    refundPolicy: 'Refund policy',
    cancellationPolicy: 'Cancellation policy',
    cookies: 'Cookie policy',
    communityGuidelines: 'Community guidelines',
    copyright: '© {year} {brand}. All rights reserved.',
    paymentMethodsLabel: 'We accept',
  },

  errors: {
    generic: {
      title: 'Something went wrong',
      description: 'We logged the problem. Please try again in a moment.',
      cta: 'Try again',
    },
    notFound: {
      title: 'Page not found',
      description: 'The page you are looking for does not exist or has moved.',
      cta: 'Back to home',
    },
    forbidden: {
      title: 'No access',
      description: 'You do not have permission to view this page.',
    },
    unauthorized: {
      title: 'Please sign in',
      description: 'This page is only available to signed-in users.',
    },
    rateLimited: {
      title: 'Too many requests',
      description: 'Please wait {seconds} and try again.',
    },
    serverError: {
      title: 'Service unavailable',
      description: 'We are working on it. Please try again shortly.',
    },
    paymentFailed: {
      title: 'Payment failed',
      description: 'Your card was not charged. Try a different payment method.',
    },
    slotUnavailable: {
      title: 'Slot no longer available',
      description: 'Someone booked this time while you were deciding. Pick another slot.',
    },
    outOfStock: {
      title: 'Out of stock',
      description: '{name} is no longer available in the selected variant.',
    },
  },

  validation: {
    required: 'This field is required',
    email: 'Enter a valid email address',
    phone: 'Enter a valid phone number',
    minLength: 'At least {min} characters',
    maxLength: 'No more than {max} characters',
    min: 'Minimum {min}',
    max: 'Maximum {max}',
    passwordTooShort: 'Password must be at least {min} characters',
    passwordNeedsNumber: 'Password must contain a number',
    passwordsDoNotMatch: 'Passwords do not match',
    passwordBreached: 'This password appears in known data breaches. Choose another.',
    invalidDate: 'Enter a valid date',
    dateInPast: 'Date cannot be in the past',
    invalidCard: 'Check the card number',
    invalidExpiry: 'Check the expiry date',
    invalidCvv: 'Check the CVV',
    fileTooLarge: 'File is larger than {max}',
    fileType: 'Unsupported file type',
    fileExtension: 'Files with extension .{extension} are not allowed',
    fileNameInvalid: 'This file name is not allowed',
    tooManyFiles: 'No more than {max} files',
    termsRequired: 'You need to accept the terms to continue',
    captchaRequired: 'Please complete the verification',
  },

  seo: {
    home: {
      title: "Dance classes, instructors and studios in Yerevan",
      description:
        'Book dance classes, private lessons and studio time in Yerevan. Verified instructors, real reviews, secure payment in AMD.',
    },
    discover: {
      title: 'Discover dance classes in Yerevan',
      description:
        'Browse hip-hop, ballet, salsa, bachata, contemporary and more. Filter by level, price and schedule.',
    },
    classes: {
      title: 'Dance classes in Yerevan',
      description:
        'Group classes for every level and style. Compare schedules, prices and instructors, and book online.',
    },
    styles: {
      title: 'Dance styles in Yerevan',
      description:
        'Hip-hop, ballet, salsa, bachata, contemporary, heels and twelve more directions — what each one is, who teaches it and what it costs.',
    },
    instructors: {
      title: 'Dance instructors in Yerevan',
      description: 'Verified dance instructors with real reviews. Compare styles, rates and availability.',
    },
    studios: {
      title: 'Dance studios for rent in Yerevan',
      description: 'Rent rehearsal and teaching space by the hour. Mirrors, sound, sprung floors.',
    },
    shop: {
      title: 'Dancewear and accessories',
      description: 'Shoes, apparel and accessories chosen by working dancers. Delivery across Armenia.',
    },
    events: {
      title: 'Dance events, workshops and battles',
      description: "What's on in Yerevan's dance scene — workshops, masterclasses, battles and socials.",
    },
    pricing: {
      title: 'Membership plans',
      description: 'Monthly plans for group classes, private sessions and studio discounts.',
    },
    about: {
      title: 'About ArtDance',
      description:
        "Who we are and why we built Armenia's dance marketplace: verified instructors, transparent prices, booking in one minute.",
    },
    contact: {
      title: 'Contact us',
      description: 'Support for bookings, orders and partnerships. We reply within one business day.',
    },
    faq: {
      title: 'Frequently asked questions',
      description:
        'Booking, payments, cancellations, refunds, delivery and working with us as an instructor or studio.',
    },
    help: {
      title: 'Help centre',
      description: 'Answers about bookings, payments, your account, orders and platform rules.',
    },
    becomeInstructor: {
      title: 'Teach dance in Yerevan',
      description:
        'Bring your classes to ArtDance: students who are already searching, an automatic schedule, online payments and weekly payouts.',
    },
    listYourStudio: {
      title: 'Rent out your dance studio',
      description:
        'List your hall on ArtDance and fill the empty hours: one calendar, prepaid rentals, weekly payouts.',
    },
    giftCards: {
      title: 'Dance gift cards',
      description: 'A gift card for classes, private lessons, studio time and the shop. Valid for a year.',
    },
  },

  legal: {
    lastUpdated: 'Last updated {date}',
    tocTitle: 'On this page',
    contactNote: 'Questions about this document? Write to {email}.',
    versionNote: 'Version {version}, in force from {date}',
    draftNotice:
      'Working draft. The text below states how the platform actually operates and is awaiting review by a lawyer before it becomes binding.',
    documentsTitle: 'All documents',
    cookieBanner: {
      title: 'Cookies',
      description: 'We use essential cookies to run the site and optional ones to understand usage.',
      acceptAll: 'Accept all',
      essentialOnly: 'Essential only',
      manage: 'Manage',
      policyLink: 'Cookie policy',
    },
    documents: {
      terms: {
        title: 'Terms of service',
        intro:
          'These terms govern the use of the {brand} platform. By creating an account or making a booking you accept them.',
        sections: {
          role: {
            title: 'What we are',
            body: '{legalEntity} operates a marketplace: we connect dancers with instructors and studios, process payments and hold the record of the booking. The lesson itself is provided by the instructor or the studio, not by us.',
          },
          account: {
            title: 'Your account',
            body: 'One person, one account, real contact details. You are responsible for what happens under your login, and we may suspend an account used for fraud, harassment or repeated no-shows.',
          },
          booking: {
            title: 'Bookings',
            body: 'A booking exists once payment has cleared — a confirmation page alone is not proof. The price, the time and the cancellation terms are fixed at that moment and later changes to our rules do not apply to it retroactively.',
          },
          payments: {
            title: 'Payments',
            body: 'All charges are in Armenian drams and include VAT at {vatRate}. Payment is processed by a licensed provider; we never store your card details.',
          },
          providers: {
            title: 'Instructors and studios',
            body: 'Providers set their own prices and schedules and keep their own students. We charge a commission on paid bookings — {instructorRate} on classes and {venueRate} on hall rentals — and pay out the rest on a weekly basis.',
          },
          conduct: {
            title: 'Behaviour',
            body: 'Dance is physical and shared. Discrimination, harassment, filming people without their consent and turning up intoxicated are grounds for removal from the platform without a refund.',
          },
          liability: {
            title: 'Risk and liability',
            body: 'Dancing carries a risk of injury; take part within your own limits and tell the instructor about conditions that matter. Our liability is limited to the amount you paid for the booking in question.',
          },
          changes: {
            title: 'Changes to these terms',
            body: 'We will announce material changes by email at least two weeks before they take effect. Bookings already paid for keep the terms they were made under.',
          },
        },
      },
      privacy: {
        title: 'Privacy policy',
        intro:
          'What we collect, why, and what you can demand from us. Written to be read, not to be survived.',
        sections: {
          controller: {
            title: 'Who is responsible',
            body: '{legalEntity}, {city}, {country}, is the controller of your personal data. Questions and requests: {legalEmail}.',
          },
          data: {
            title: 'What we collect',
            body: 'Your name, email, phone and language; bookings, orders and payments; messages you send us; and technical data such as device type and pages visited. Card numbers never reach our servers.',
          },
          purposes: {
            title: 'Why we use it',
            body: 'To run bookings and orders, to send confirmations and reminders, to prevent fraud, to comply with accounting law, and — separately and only with your consent — to send you a newsletter.',
          },
          sharing: {
            title: 'Who else sees it',
            body: 'The instructor or studio you book sees your name and contact details, because they have to let you in. Payment providers, our email service and our hosting provider process data on our behalf under contract. We do not sell data.',
          },
          retention: {
            title: 'How long we keep it',
            body: 'Account data until you delete the account, then {accountDeletionDays} days of grace in case you change your mind. Financial records are kept for {financialYears} years as the law requires; raw analytics for {analyticsDays} days.',
          },
          rights: {
            title: 'Your rights',
            body: 'Access, correction, deletion, a copy of your data in a portable format, and withdrawal of marketing consent at any time. Write to {legalEmail} and we answer within thirty days.',
          },
          security: {
            title: 'How we protect it',
            body: 'Encrypted connections, hashed passwords, access limited by role and logged, and rate limits on sign-in. No system is perfect, and if a breach affects you we will tell you.',
          },
          contact: {
            title: 'Complaints',
            body: 'If our answer does not satisfy you, you may complain to the Personal Data Protection Agency of the Republic of Armenia.',
          },
        },
      },
      refundPolicy: {
        title: 'Refund policy',
        intro: 'When money comes back, how much of it, and how long it takes.',
        sections: {
          scope: {
            title: 'What this covers',
            body: 'Everything paid on the platform: classes, private lessons, hall rentals, event tickets, shop orders and gift cards. Each has its own rule, listed below.',
          },
          bookings: {
            title: 'Classes and lessons',
            body: 'Cancel more than {freeCancellationHours} before the start and you get everything back. Later than that we keep {lateFeeRate} of the price. A no-show is not refunded. If the provider cancels, you get the full amount regardless of timing.',
          },
          goods: {
            title: 'Shop orders',
            body: 'Unworn items with their tags can be returned within {returnWindowDays} days of delivery; we refund the price of the goods. Return shipping is yours unless the item arrived faulty.',
          },
          giftCards: {
            title: 'Gift cards',
            body: 'Gift cards are not refundable and cannot be exchanged for cash. The balance stays usable for {giftCardMonths} months and can be spent across several bookings.',
          },
          method: {
            title: 'How the money comes back',
            body: 'Always to the payment method used for the purchase — we cannot redirect a refund to another card or to cash. We send it the same day; your bank adds its own processing time.',
          },
          disputes: {
            title: 'If you disagree',
            body: 'Write to {supportEmail} with the booking or order number before contacting your bank. A chargeback freezes the case for weeks; we can usually settle it the same day.',
          },
        },
      },
      cancellationPolicy: {
        title: 'Cancellation policy',
        intro:
          'One rule for everyone, recorded at the moment of booking so it cannot change afterwards.',
        sections: {
          window: {
            title: 'Free cancellation',
            body: 'Up to {freeCancellationHours} before the session starts, cancellation is free and the refund is full. The window is shown on the booking itself.',
          },
          late: {
            title: 'Late cancellation',
            body: 'Inside the window we keep {lateFeeRate} of the price. This is not a penalty for its own sake: an hour that late cannot be resold, and the instructor has already arranged their day around it.',
          },
          noShow: {
            title: 'No-show',
            body: 'Not turning up without cancelling is charged in full. Cancelling late always costs less than not cancelling at all.',
          },
          reschedule: {
            title: 'Moving a booking',
            body: 'Up to {maxReschedules} times per booking, no later than {freeRescheduleHours} before the start, subject to availability. A more expensive slot requires paying the difference.',
          },
          providerCancels: {
            title: 'If the provider cancels',
            body: 'You receive the full amount back whatever the timing, plus the closest alternatives for the same style and level. Repeated cancellations affect a provider\u2019s standing in the catalogue.',
          },
          rentals: {
            title: 'Hall rentals',
            body: 'Studio bookings can be cancelled free of charge up to {venueCancellationHours} before the start. Minimum rental is {minRentalMinutes}.',
          },
        },
      },
      cookies: {
        title: 'Cookie policy',
        intro: 'What we store in your browser and what you can switch off.',
        sections: {
          what: {
            title: 'What cookies are',
            body: 'Small files a site stores in your browser. Some are needed for the site to work at all; the rest are optional and require your consent.',
          },
          essential: {
            title: 'Essential',
            body: 'Your session, the language you chose, the theme, the contents of your cart and protection against cross-site request forgery. Without these you cannot stay signed in or complete a booking.',
          },
          analytics: {
            title: 'Analytics',
            body: 'Aggregated statistics about which pages are used and where people give up. They are loaded only after you agree, and they never carry your name.',
          },
          thirdParty: {
            title: 'Third parties',
            body: 'Payment pages, maps and the bot-protection widget set their own cookies when you use them. Their policies apply in addition to ours.',
          },
          control: {
            title: 'Your control',
            body: 'Change your choice at any time from the cookie banner or in your browser settings. Blocking essential cookies will break sign-in and checkout.',
          },
        },
      },
      communityGuidelines: {
        title: 'Community guidelines',
        intro:
          'A dance floor is a shared space. These rules keep it usable for everyone — including the people teaching in it.',
        sections: {
          respect: {
            title: 'Respect comes first',
            body: 'No discrimination by gender, origin, body, age or ability. No unsolicited comments on someone\u2019s appearance. Ask before touching, and stop when asked.',
          },
          reviews: {
            title: 'Honest reviews',
            body: 'Write about a class you attended and about the class itself, not about the person. Reviews are published after a moderation check; paid, traded or retaliatory reviews are removed.',
          },
          safety: {
            title: 'Safety',
            body: 'Tell the instructor about injuries and conditions that matter. Do not film people without asking. Do not attend intoxicated, and do not bring alcohol into a studio.',
          },
          offPlatform: {
            title: 'Keeping bookings on the platform',
            body: 'Moving payment off the platform removes your protection: no record, no refund, no support if something goes wrong. Systematically doing so ends a provider\u2019s account.',
          },
          enforcement: {
            title: 'What we do about breaches',
            body: 'Depending on severity: a warning, removal of content, loss of the verification badge, or a permanent ban without refund of unused bookings. Serious incidents are reported to the police.',
          },
        },
      },
    },
  },

  email: {
    common: {
      greeting: 'Hi {name},',
      signature: 'The {brand} team',
      footerNote: 'You received this email because you have an account on {brand}.',
      unsubscribe: 'Unsubscribe',
      viewInBrowser: 'View in browser',
    },
    verifyEmail: {
      subject: 'Confirm your email',
      heading: 'Confirm your email address',
      body: 'Click the button below to finish creating your {brand} account. The link is valid for {hours}.',
      cta: 'Confirm email',
    },
    resetPassword: {
      subject: 'Reset your password',
      heading: 'Reset your password',
      body: 'Use the button below to set a new password. If you did not request this, ignore this email.',
      cta: 'Reset password',
    },
    bookingConfirmed: {
      subject: 'Booking confirmed — {title}',
      heading: 'You are booked',
      body: '{title} with {instructor} on {when} at {location}.',
      cta: 'View booking',
      cancellationNote: 'Free cancellation up to {hours} before the session.',
    },
    bookingReminder: {
      subject: 'Reminder: {title} {when}',
      heading: 'See you soon',
      body: '{title} with {instructor} starts {when} at {location}.',
      cta: 'View booking',
    },
    bookingCancelled: {
      subject: 'Booking cancelled — {title}',
      heading: 'Your booking was cancelled',
      body: '{title} on {when} has been cancelled. Refund: {refund}.',
      cta: 'Find another class',
    },
    orderConfirmed: {
      subject: 'Order {orderNumber} confirmed',
      heading: 'Thanks for your order',
      body: 'We received your payment of {total}. We will let you know when it ships.',
      cta: 'View order',
    },
    payoutProcessed: {
      subject: 'Payout {amount} sent',
      heading: 'Your payout is on the way',
      body: 'We sent {amount} for the period {periodStart} — {periodEnd}.',
      cta: 'View earnings',
    },
    newsletterConfirm: {
      subject: 'Confirm your subscription',
      heading: 'One click and you are in',
      body: 'Confirm this address to start getting new classes, events and workshops once a week.',
      cta: 'Confirm subscription',
      footnote: 'If you did not request this, ignore the email — nothing will be sent.',
    },
  },

  about: {
    eyebrow: 'About us',
    title: 'We are building the shortest path from wanting to dance to dancing.',
    subtitle:
      'ArtDance connects dancers, instructors and studios in Yerevan. One place to find a class, book a private lesson, rent a hall and buy what you need to move.',
    mission: {
      title: 'Why we exist',
      body: 'Finding a class in Yerevan used to mean asking friends, scrolling Instagram and hoping someone replied. Instructors lost students to unanswered messages; studios stood empty between rehearsals. We put schedules, prices and availability in one place — and made booking take a minute instead of a week.',
    },
    values: {
      title: 'What we hold to',
      trust: {
        title: 'Verified, not just listed',
        body: 'Every instructor profile is reviewed before it goes live, and reviews come only from people who actually attended.',
      },
      craft: {
        title: 'Prices without asterisks',
        body: 'What you see is what you pay, in Armenian drams. Cancellation terms are recorded at the moment of booking and cannot change afterwards.',
      },
      local: {
        title: 'Built for Yerevan',
        body: 'Local payment methods, three languages, districts instead of abstract map pins, and support that answers in the language you wrote in.',
      },
      openness: {
        title: 'The scene comes first',
        body: 'Studios and instructors keep their own students and their own name. We take a transparent commission and never stand between them and their community.',
      },
    },
    story: {
      title: 'Where we are now',
      body: 'The platform opened in {year} with dance classes, instructor profiles, studio rentals and a shop. Online courses, corporate programmes and city-wide events are next — in that order, and only when each of them works properly.',
    },
    cta: {
      title: 'Come dance with us',
      subtitle: 'Browse classes, or bring your own students onto the platform.',
      primary: 'Explore classes',
      secondary: 'Work with us',
    },
  },

  contact: {
    eyebrow: 'Contact',
    title: 'Talk to a human',
    subtitle: 'Questions about a booking, an order, or working with us — write and we will answer.',
    responseTime: 'We reply within one business day.',
    channels: {
      title: 'Direct lines',
      generalTitle: 'General enquiries',
      generalNote: 'Partnerships, press, anything that is not about a specific booking.',
      supportTitle: 'Support',
      supportNote: 'Bookings, payments, refunds. Include your booking or order number.',
      socialTitle: 'Social',
      socialNote: 'We read direct messages, but written requests are handled faster by email.',
      cityTitle: 'Where we are',
      cityNote: 'We work across {city}. There is no walk-in office yet — everything happens online or at the studio.',
    },
    form: {
      title: 'Send a message',
      nameLabel: 'Your name',
      emailLabel: 'Email for the reply',
      topicLabel: 'What is it about',
      messageLabel: 'Message',
      messagePlaceholder: 'Tell us what happened, and add a booking or order number if you have one.',
      submit: 'Send message',
      topics: {
        booking: 'A booking or class',
        order: 'An order from the shop',
        instructor: 'Becoming an instructor or listing a studio',
        press: 'Press and partnerships',
        other: 'Something else',
      },
      successTitle: 'Message sent',
      successBody: 'We have it. Expect a reply at {email} within one business day.',
      failedTitle: 'The message did not go through',
      failedBody: 'Something broke on our side. Write to {email} directly — that inbox is monitored.',
    },
  },

  faq: {
    eyebrow: 'FAQ',
    title: 'Questions people actually ask',
    subtitle: 'Booking, payments, cancellations and working with us. If something is missing, write to us.',
    groups: {
      booking: {
        title: 'Booking',
        items: {
          howToBook: {
            question: 'How do I book a class?',
            answer:
              'Pick a class, choose a time, and pay online. Your place is confirmed the moment the payment goes through, and the confirmation arrives by email.',
          },
          account: {
            question: 'Do I need an account?',
            answer:
              'For a class booking, yes — the booking has to belong to someone so it can be cancelled, moved or refunded. Signing up takes an email and a password.',
          },
          leadTime: {
            question: 'How late can I book?',
            answer: 'Up to {minutes} before the session starts, as long as places are left.',
          },
          waitlist: {
            question: 'The class is full. What now?',
            answer:
              'Join the waitlist. If someone cancels, the first person in line gets {claimHours} to claim the place before it moves on.',
          },
          firstTime: {
            question: 'I have never danced. Where do I start?',
            answer:
              'Filter by the beginner level, or pick a class marked for all levels — those are built so that a first-timer and a returning dancer can stand in the same room.',
          },
        },
      },
      payments: {
        title: 'Payments and prices',
        items: {
          methods: {
            question: 'How can I pay?',
            answer:
              'Local cards and payment services, in Armenian drams. Cash is not accepted for online bookings: the place is only held once payment clears.',
          },
          vat: {
            question: 'Are prices final?',
            answer: 'Yes. Catalogue prices include VAT at {vat}, and nothing is added at checkout except delivery for shop orders.',
          },
          currency: {
            question: 'Can I pay in another currency?',
            answer:
              'Prices can be displayed in other currencies for reference, but the charge is always in drams — that is what your bank will show.',
          },
          receipt: {
            question: 'Will I get a receipt?',
            answer: 'Every payment produces a receipt by email. Order and booking history lives in your account.',
          },
        },
      },
      cancellation: {
        title: 'Cancellations and refunds',
        items: {
          freeWindow: {
            question: 'Can I cancel?',
            answer:
              'Cancel more than {hours} before the start and the refund is full. Later than that, {feeRate} of the price is kept — that is the instructor\u2019s time, which can no longer be resold.',
          },
          reschedule: {
            question: 'Can I move a booking instead?',
            answer:
              'Yes, up to {maxTimes} times, no later than {hours} before the start. If the new session costs more, you pay the difference.',
          },
          noShow: {
            question: 'What if I simply do not come?',
            answer: 'A no-show without cancellation is not refunded. Cancelling — even late — always costs less.',
          },
          providerCancels: {
            question: 'What if the instructor cancels?',
            answer:
              'You get the full amount back, whatever the timing, plus a list of the closest alternatives for the same style.',
          },
          refundTiming: {
            question: 'How long does a refund take?',
            answer: 'We send it the same day. Banks add their own time — usually up to five business days.',
          },
        },
      },
      providers: {
        title: 'Instructors and studios',
        items: {
          join: {
            question: 'How do I teach on ArtDance?',
            answer:
              'Send a profile with your styles, experience and rates. We check it, help you set up your schedule, and you go live in the catalogue.',
          },
          commission: {
            question: 'What does it cost?',
            answer:
              'No subscription and no listing fee. The platform keeps {instructorRate} of a class and {venueRate} of a hall rental, and only when a booking is actually paid.',
          },
          payout: {
            question: 'When do I get paid?',
            answer:
              'Weekly, {holdbackDays} days after the session is completed, once the balance passes {minimum}. The delay is the dispute window, not our float.',
          },
          ownStudents: {
            question: 'Do I keep my own students?',
            answer:
              'They are yours. We do not hide your name, we do not forbid your own channels, and we do not charge for students who found you elsewhere.',
          },
        },
      },
      shop: {
        title: 'Shop and gift cards',
        items: {
          delivery: {
            question: 'How does delivery work?',
            answer:
              'Yerevan in {yerevanDays}, other regions in {regionDays}. Orders over {threshold} ship free; below that, delivery is added at checkout.',
          },
          returns: {
            question: 'Can I return something?',
            answer:
              'Unworn items with tags can be returned within {days} days. Gift cards and delivery fees are not refundable.',
          },
          giftCards: {
            question: 'How do gift cards work?',
            answer:
              'You choose the amount, the recipient gets a code, and it covers anything on the platform for {months} months.',
          },
        },
      },
    },
  },

  help: {
    eyebrow: 'Help centre',
    title: 'What do you need help with?',
    subtitle: 'Start here: the answers below cover most questions. Anything else goes to a human.',
    topics: {
      booking: {
        title: 'Bookings and classes',
        body: 'How booking works, joining a waitlist, moving a session, what happens if an instructor cancels.',
        cta: 'Read the answers',
      },
      payments: {
        title: 'Payments and refunds',
        body: 'Accepted methods, what is included in the price, refund timing and who to contact about a charge.',
        cta: 'Payment answers',
      },
      account: {
        title: 'Account and data',
        body: 'Signing in, changing your details, notification settings, deleting your account and what happens to your data.',
        cta: 'Privacy policy',
      },
      providers: {
        title: 'Teaching and renting out space',
        body: 'Joining as an instructor or studio, commission, payouts and how the schedule works.',
        cta: 'Work with us',
      },
      rules: {
        title: 'Rules and policies',
        body: 'Terms of service, cancellation and refund policies, community guidelines and cookies.',
        cta: 'Read the documents',
      },
      shop: {
        title: 'Orders and delivery',
        body: 'Delivery times and costs, returns, sizes and gift cards.',
        cta: 'Shop answers',
      },
    },
    stillStuck: {
      title: 'Still stuck?',
      body: 'Write to us with your booking or order number and we will sort it out.',
      cta: 'Contact support',
    },
  },

  becomeInstructor: {
    eyebrow: 'For instructors',
    title: 'Teach. We handle the rest.',
    subtitle:
      'Bring your classes to a place where students are already looking. Schedule, payments, reminders and receipts are ours; the dancing is yours.',
    primaryCta: 'Start the conversation',
    secondaryCta: 'See the commission',
    benefits: {
      title: 'What you get',
      demand: {
        title: 'Students who are searching right now',
        body: 'People arrive with intent: they filter by style, level and district, and they book the same visit.',
      },
      schedule: {
        title: 'A schedule that defends itself',
        body: 'You set availability once. Double bookings, buffers between sessions and the booking horizon are handled for you.',
      },
      money: {
        title: 'Money that arrives on time',
        body: 'Online payment before the class, automatic receipts, and weekly payouts with no invoices to chase.',
      },
      noShows: {
        title: 'Fewer empty spots',
        body: 'Reminders before every session, a waitlist for full groups, and a cancellation fee that protects your time.',
      },
    },
    steps: {
      title: 'How it works',
      apply: {
        title: 'Send your profile',
        body: 'Styles, experience, rates and a few photos. Twenty minutes of your time.',
      },
      review: {
        title: 'We verify it',
        body: 'A short check of your experience and documents. That verification badge is why students trust the catalogue.',
      },
      publish: {
        title: 'Set your schedule',
        body: 'Availability, class formats, prices, and where you teach — a studio, the client\u2019s place or online.',
      },
      earn: {
        title: 'Take bookings',
        body: 'Your profile goes live in search, bookings land in your calendar, and payouts run weekly.',
      },
    },
    earnings: {
      title: 'What it costs',
      body: 'No subscription, no listing fee, no charge for a profile that sits idle. We earn only when you do.',
      commission: 'Platform commission on a class: {rate}',
      minimumFee: 'Minimum commission per transaction: {amount}',
      payout: 'Payouts weekly, {days} days after the session, from {minimum}',
      cardFees: 'Card fees are on us, not deducted from your payout',
    },
    requirements: {
      title: 'What we ask for',
      experience: 'Real teaching experience and a style you can name.',
      documents: 'An identity document and, where the style requires it, a certificate.',
      reliability: 'Answering requests within a day and turning up to what you accepted.',
      conduct: 'Agreement with our community guidelines — they exist to protect your students.',
    },
    cta: {
      title: 'Ready when you are',
      subtitle: 'Write to us and we will walk you through setting up your first class.',
      primary: 'Contact us',
      secondary: 'Read the terms',
    },
  },

  listYourStudio: {
    eyebrow: 'For studios',
    title: 'Fill the hours your hall stands empty.',
    subtitle:
      'Rehearsal and teaching space rented by the hour, to instructors and dancers who are already on the platform looking for a room.',
    primaryCta: 'List your space',
    secondaryCta: 'See the commission',
    benefits: {
      title: 'What you get',
      occupancy: {
        title: 'Bookings in the gaps',
        body: 'Mornings and weekday afternoons are the hours studios lose. They are exactly the hours dancers rehearse in.',
      },
      calendar: {
        title: 'One calendar, no phone calls',
        body: 'Availability, minimum rental time and buffers are set once. Nobody books a hall that is already taken.',
      },
      payment: {
        title: 'Paid before the door opens',
        body: 'Rental is paid online in advance, so a no-show is not your loss.',
      },
      exposure: {
        title: 'A profile that works as a shopfront',
        body: 'Photos, floor, mirrors, sound, area and district — everything renters ask on the phone, answered before they call.',
      },
    },
    steps: {
      title: 'How it works',
      apply: {
        title: 'Tell us about the space',
        body: 'Address, area, floor type, equipment, photos and your hourly rate.',
      },
      review: {
        title: 'We check and publish',
        body: 'A quick review of the details and the photos, then the hall appears in the rental catalogue.',
      },
      calendar: {
        title: 'Open your hours',
        body: 'Set working hours, minimum rental of {minMinutes} and the days you keep for yourself.',
      },
      earn: {
        title: 'Take rentals',
        body: 'Bookings arrive with the renter\u2019s details paid in advance, and payouts run weekly.',
      },
    },
    earnings: {
      title: 'What it costs',
      body: 'You set the hourly rate. We add nothing on top of it for the renter and take our share only from a paid booking.',
      commission: 'Platform commission on a rental: {rate}',
      cancellation: 'Free cancellation window for renters: {hours}',
      payout: 'Payouts weekly, {days} days after the rental, from {minimum}',
      control: 'You keep the right to refuse a booking that does not suit the hall',
    },
    requirements: {
      title: 'What we ask for',
      space: 'A room fit for dancing: a proper floor, ventilation, a place to change.',
      documents: 'Proof that you may rent the space out.',
      honesty: 'Photos and equipment lists that match reality — renters check on arrival.',
      availability: 'A calendar you keep up to date.',
    },
    cta: {
      title: 'Let us look at your hall',
      subtitle: 'Send the details and we will come back with a plan for the empty hours.',
      primary: 'Contact us',
      secondary: 'Read the terms',
    },
  },

  giftCards: {
    eyebrow: 'Gift cards',
    title: 'Give someone the thing they keep meaning to start.',
    subtitle:
      'A gift card works for anything on the platform: group classes, private lessons, studio time, workshops and the shop.',
    amountsTitle: 'Choose an amount',
    amountsNote: 'Any amount from {min} to {max}, in steps of {step}.',
    validityNote: 'Valid for {months} months from purchase.',
    steps: {
      title: 'How it works',
      choose: {
        title: 'Pick the amount',
        body: 'A preset value, or your own — whatever fits the occasion.',
      },
      pay: {
        title: 'Pay online',
        body: 'The card is issued the moment payment clears. No plastic, no waiting.',
      },
      send: {
        title: 'Send the code',
        body: 'Forward it yourself, or have us deliver it by email on the date you choose.',
      },
      redeem: {
        title: 'They spend it',
        body: 'The code is entered at checkout and covers the whole amount or part of it. The balance stays on the card.',
      },
    },
    terms: {
      title: 'The fine print, plainly',
      noExpiryReset: 'The balance can be spent in several bookings — it does not have to go all at once.',
      nonRefundable: 'A gift card cannot be exchanged for cash and is not refundable.',
      combinable: 'It works alongside catalogue prices, but not together with a promo code on the same order.',
      lostCode: 'Lost the code? We can resend it to the buyer\u2019s email.',
    },
    cta: {
      title: 'Gift cards are almost ready',
      subtitle: 'Buying them online is part of the shop release. Until then, write to us and we will issue one by hand.',
      primary: 'Contact us',
      secondary: 'Read the refund policy',
    },
  },

  a11y: {
    ratingStars: 'Rated {rating} out of {max}',
    mainNav: 'Main navigation',
    loading: 'Content is loading',
    imageOf: 'Photo of {subject}',
    closeDialog: 'Close dialog',
    openInNewTab: 'opens in a new tab',
    currentPage: 'current page',
    breadcrumbNav: 'Breadcrumb',
    paginationNav: 'Pagination',
    goToPage: 'Go to page {page}',
    carouselPrevious: 'Previous slide',
    carouselNext: 'Next slide',
    quantityIncrease: 'Increase quantity',
    quantityDecrease: 'Decrease quantity',
    selectedFilterCount: '{count} filters applied',
    sortResults: 'Sort results',
    searchScope: 'Search scope',
    galleryThumbnail: 'Show photo {index}',
  },
} as const;

export default en;
