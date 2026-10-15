'use strict';

// Paired source: identical section/illustration structure, independently authored text.
// Routes and behavior checked against src/config/admin.ts, server/actions and page components.
const sections = [];
function add(id, route, shots, en, hy) {
  sections.push({ id, route, shots, en, hy });
}
const shot = (id, route, focus) => ({ id, route, ...(focus ? { focus } : {}) });

// Each section below is a procedure, not a claim that an integration is live.

add('workspace', '/admin', [shot('dashboard', '/admin')], {
  title: '01. Sign-in, workspace and daily navigation',
  lead: 'Use an individual staff account. The language prefix changes the interface, not the database or permission level.',
  steps: [
    ['Enter safely', 'Open the approved site and /en/admin. Sign in using Email and Password; wait for the dashboard rather than submitting repeatedly. Choose /hy/admin for Armenian. Never paste a session token into a browser or share a staff password.'],
    ['Find the right workspace', 'Check your identity, role and sidebar. Catalog contains offers and website records; Operations contains bookings, orders and moderation; Money contains payouts and campaigns; System contains controls. Missing sections may reflect permissions.'],
    ['Read queues before acting', 'Review pending moderation and approvals. Open the underlying queue to inspect each record: dashboard totals are not evidence of payment or completion. A zero queue is legitimate after filters and access have been checked.'],
    ['Search and hand off', 'Use the section search and status filter, then Apply. Clear both when a record is missing. Use the command palette to navigate, not to bypass permissions. At shift end, record unresolved references and sign out.'],
  ],
  notes: ['All illustrations are from a separate, seeded local database. Example orders, balances and people are fictitious; no production records or payments were used.'],
}, {
  title: '01. Մուտք, աշխատավայր և ամենօրյա նավարկում',
  lead: 'Օգտագործեք ձեր անձնական աշխատակցային հաշիվը։ Լեզվի նախածանցը փոխում է միջերեսը, ոչ թե տվյալների բազան կամ իրավունքները։',
  steps: [
    ['Անվտանգ մուտք', 'Բացեք հաստատված կայքը և /hy/admin հասցեն։ Լրացրեք էլեկտրոնային հասցեն ու գաղտնաբառը և սպասեք վահանակին՝ կրկնակի սեղմելու փոխարեն։ Անգլերենի համար օգտագործեք /en/admin։ Մի փոխանցեք գաղտնաբառը կամ սեսիայի նշանը։'],
    ['Գտնել բաժինը', 'Ստուգեք ձեր անունը, դերը և կողային ընտրացանկը։ Կատալոգում առաջարկներն ու կայքի գրառումներն են, գործառնություններում՝ ամրագրումները, պատվերներն ու մոդերացիան, ֆինանսներում՝ փոխանցումներն ու արշավները։ Բաժնի բացակայությունը կարող է կախված լինել իրավունքներից։'],
    ['Նախ ստուգել հերթերը', 'Դիտեք սպասող մոդերացիան ու հաստատումները։ Բացեք համապատասխան հերթը և ուսումնասիրեք գրառումը. ամփոփման թիվը վճարման ապացույց չէ։ Զտիչներն ու հասանելիությունը ստուգելուց հետո դատարկ հերթը կարող է լինել բնական վիճակ։'],
    ['Որոնել և փոխանցել աշխատանքը', 'Օգտագործեք բաժնի որոնումն ու կարգավիճակի զտիչը, ապա սեղմեք Կիրառել։ Բացակայող գրառման դեպքում մաքրեք երկուսը։ Հրամանների վահանակը չի շրջանցում թույլտվությունները։ Հերթափոխի վերջում փոխանցեք չլուծված համարները և դուրս եկեք։'],
  ],
  notes: ['Բոլոր նկարները ստացվել են առանձին տեղական փորձնական բազայից։ Պատվերները, մնացորդներն ու անձինք ուսումնական օրինակներ են. իրական վճարումներ չեն կատարվել։'],
});

add('classes', '/admin/classes', [shot('classes', '/admin/classes'), shot('sessions', '/admin/sessions')], {
  title: '02. Classes, sessions and capacity',
  lead: 'A class describes the offer. A session supplies the actual date, room and sellable capacity; both must be correct.',
  steps: [
    ['Create the offer', 'Open Classes → Add. Enter a unique slug, localized title and description, instructor, style, level, lesson type, duration and price. A DanceSport discipline is more specific than the broad dance style. Save and reopen the record.'],
    ['Schedule a session', 'Open the class’s Sessions child section or /admin/sessions. Add the class, instructor, venue/room, start and end times and capacity. Check the displayed timezone and the room’s availability before saving.'],
    ['Check sellable places', 'Review active state, future start time, capacity and booked count. A PAIR booking needs two participant places. Do not lower capacity below existing commitments or change a session to work around a booking conflict.'],
    ['Verify the public result', 'Open the corresponding public class page in EN and HY and inspect the schedule. If unavailable, check class status, session date, capacity and moderation before changing prices or creating duplicates.'],
  ], notes: ['Class and session changes affect future offers; historical booking prices and cancellation conditions are snapshots.'],
}, {
  title: '02. Դասեր, անցկացումներ և տեղերի քանակ',
  lead: 'Դասը նկարագրում է առաջարկը, իսկ անցկացումը՝ օրը, դահլիճն ու հասանելի տեղերը։ Երկուսն էլ պետք է ճիշտ լինեն։',
  steps: [
    ['Ստեղծել առաջարկը', 'Բացեք Դասեր → Ավելացնել։ Նշեք եզակի հասցեային անունը, թարգմանված վերնագիրն ու նկարագրությունը, մարզչին, ոճը, մակարդակը, ձևաչափը, տևողությունն ու գինը։ Մարզական պարի դիսցիպլինան ավելի ճշգրիտ է, քան ընդհանուր ոճը։ Պահեք և կրկին բացեք գրառումը։'],
    ['Ավելացնել անցկացումը', 'Բացեք դասի անցկացումների բաժինը կամ /admin/sessions։ Նշեք դասը, մարզչին, վայրը/դահլիճը, սկզբի ու ավարտի ժամը և տեղերի քանակը։ Պահելուց առաջ ստուգեք ժամային գոտին ու դահլիճի ազատ լինելը։'],
    ['Ստուգել ազատ տեղերը', 'Ստուգեք ակտիվ վիճակը, ապագա ժամը, տարողությունն ու զբաղված տեղերը։ PAIR ամրագրումը զբաղեցնում է երկու տեղ։ Մի նվազեցրեք տարողությունն առկա պարտավորություններից ցածր և մի փոխեք անցկացումը՝ հակասությունը շրջանցելու համար։'],
    ['Ստուգել հանրային արդյունքը', 'Բացեք դասի հանրային էջը հայերեն և անգլերեն ու դիտեք ժամանակացույցը։ Անհասանելիության դեպքում ստուգեք կարգավիճակը, օրը, տեղերն ու մոդերացիան, ոչ թե ստեղծեք կրկնօրինակ։'],
  ], notes: ['Դասի փոփոխությունը վերաբերում է առաջարկին. հին ամրագրման գինն ու չեղարկման պայմանները պահպանված են առանձին։'],
});

add('availability', '/studio/availability', [shot('instructors', '/admin/instructors'), shot('availability', '/studio/availability')], {
  title: '03. Instructors and availability',
  lead: 'Weekly rules and dated exceptions control free private lessons. They do not automatically create group sessions or cancel existing reservations.',
  steps: [
    ['Maintain the profile', 'In /admin/instructors review the linked user, biography, languages, styles, DanceSport disciplines, rates and moderation status. Save before attaching photos. Check the public profile after approval.'],
    ['Open the schedule', 'An instructor opens /studio/availability with their own linked profile. Add a weekday and start/end time, optional validity dates and active state. Times are interpreted in the business timezone, Asia/Yerevan.'],
    ['Represent breaks and days off', 'Use two weekly windows for a lunch break rather than one continuous window. Add a dated unavailable exception for leave or closure; an available exception can add an extra window. Check overlap and end-after-start validation.'],
    ['Verify availability', 'Reopen the editor and check the public private-lesson date picker. Existing bookings and room conflicts can still block a slot. A schedule edit is not a cancellation; contact affected clients through the supported booking workflow.'],
  ], notes: ['The current editor is profile-bound. A global administrator does not gain a teacher-selection schedule editor merely from their role; use the authorized instructor workflow.'],
}, {
  title: '03. Մարզիչներ և հասանելիության ժամանակացույց',
  lead: 'Շաբաթական կանոններն ու ամսաթվային բացառությունները կառավարում են ազատ անհատական ժամերը։ Դրանք ինքնուրույն չեն ստեղծում խմբային անցկացումներ կամ չեղարկում ամրագրումներ։',
  steps: [
    ['Խնամել պրոֆիլը', '/admin/instructors բաժնում ստուգեք կապված հաշվին, կենսագրությունը, լեզուները, ոճերը, մարզական դիսցիպլինաները, գներն ու մոդերացիան։ Լուսանկարներ կցելուց առաջ պահեք գրառումը։ Հաստատումից հետո ստուգեք հանրային էջը։'],
    ['Բացել ժամանակացույցը', 'Մարզիչն իր կապված հաշվով բացում է /studio/availability։ Ավելացրեք շաբաթվա օրը, սկզբի ու ավարտի ժամը, անհրաժեշտության դեպքում՝ գործողության ամսաթվերը և ակտիվ վիճակը։ Ժամերը մեկնաբանվում են Asia/Yerevan ժամային գոտով։'],
    ['Նշել ընդմիջումներն ու արձակուրդը', 'Ճաշի ընդմիջման համար սահմանեք երկու առանձին աշխատանքային միջակայք։ Հանգստի կամ փակման համար ավելացրեք տվյալ օրվա անհասանելի բացառություն։ Հասանելի բացառությունը կարող է ավելացնել ժամեր։ Ստուգեք համընկնումն ու ավարտի ժամը։'],
    ['Ստուգել արդյունքը', 'Կրկին բացեք խմբագրիչը և հանրային անհատական դասի օրացույցը։ Առկա ամրագրումն ու դահլիճի զբաղվածությունը կարող են փակել ժամը։ Ժամանակացույցի խմբագրումը չեղարկում չէ. հաճախորդի հարցը լուծեք ամրագրման ընթացակարգով։'],
  ], notes: ['Այս խմբագրիչը կապված է մարզչի պրոֆիլին։ Միայն ադմինիստրատորի դերը չի տալիս կամայական մարզչի ժամանակացույց ընտրելու միջերես։'],
});

add('venues', '/admin/venues', [shot('venues', '/admin/venues')], {
  title: '04. Venues and rooms', lead: 'A venue is the address and operator; its rooms are separate resources used by scheduled sessions and rental bookings.',
  steps: [
    ['Review the venue', 'Open Venues, search the record and verify name, address, city/district, coordinates, amenities, contact information and moderation. Enter real coordinates, not a link copied from a map.'],
    ['Maintain rooms', 'Open the Rooms child section. Check the parent venue, room name, capacity, rental price and active state. Do not create the same physical room twice to bypass overlap checks.'],
    ['Attach media', 'Save the venue or room, then use its media section to upload suitable photos and descriptive alternative text. Confirm the first image and ordering before publication.'],
    ['Validate a change', 'Reopen the saved room and public venue page. Verify the address and booking availability. Resolve affected future sessions before deactivating a room; deleting a catalog record is not a refund.'],
  ], notes: ['City and district choices come from managed geography records, not from Access settings.'],
}, {
  title: '04. Վայրեր և դահլիճներ', lead: 'Վայրը պահում է հասցեն և կազմակերպչի տվյալները, իսկ դահլիճները առանձին ռեսուրսներ են դասերի ու վարձակալության համար։',
  steps: [
    ['Ստուգել վայրը', 'Բացեք վայրերի բաժինը, գտեք գրառումը և ստուգեք անունը, հասցեն, քաղաքն ու շրջանը, կոորդինատները, հարմարությունները, կապի տվյալներն ու մոդերացիան։ Քարտեզի հղման փոխարեն նշեք կոորդինատները։'],
    ['Կառավարել դահլիճները', 'Բացեք Դահլիճներ ենթաբաժինը։ Ստուգեք ծնող վայրը, անունը, տարողությունը, վարձակալության գինն ու ակտիվ վիճակը։ Մի ստեղծեք նույն ֆիզիկական դահլիճի կրկնօրինակը՝ համընկնումը շրջանցելու համար։'],
    ['Կցել լուսանկարները', 'Պահեք վայրը կամ դահլիճը, հետո մեդիայի բաժնում վերբեռնեք լուսանկարներն ու նկարագրական այլընտրանքային տեքստը։ Հրապարակելուց առաջ ստուգեք առաջին նկարը և հերթականությունը։'],
    ['Ստուգել փոփոխությունը', 'Կրկին բացեք գրառումն ու հանրային էջը։ Ստուգեք հասցեն և ամրագրելիությունը։ Ապաակտիվացնելուց առաջ լուծեք ապագա անցկացումների հարցը. կատալոգից հեռացնելը գումարի վերադարձ չէ։'],
  ], notes: ['Քաղաքներն ու շրջանները ընտրվում են աշխարհագրական կատալոգից, ոչ թե հասանելիության կարգավորումներից։'],
});

add('products', '/admin/products', [shot('products', '/admin/products')], {
  title: '05. Products and inventory', lead: 'Product descriptions, purchasable variants and order fulfilment are different operations.',
  steps: [
    ['Create or edit', 'Open Products → Add or select a row. Check slug, category, translated title/description and active state. Save the parent product before adding images or variants.'],
    ['Configure a variant', 'Open Variants and set the unique SKU, size/color where applicable, price and stock. Confirm the variant belongs to the intended product; an active product without a purchasable variant cannot be sold normally.'],
    ['Check the storefront', 'Upload images through the saved product’s media section. Preview the public product in both languages, select the variant and verify its price and available stock. Do not place a live payment merely to test the copy.'],
    ['Reconcile changes', 'Change stock only after checking reservations and open orders. A product price edit does not rewrite the price snapshot of an existing order. Use Orders for packing, shipping, cancellation and refund work.'],
  ], notes: ['Amounts displayed in AMD are dram amounts, not decimal fractions or foreign-currency totals.'],
}, {
  title: '05. Ապրանքներ և պաշարներ', lead: 'Ապրանքի նկարագրությունը, վաճառվող տարբերակներն ու պատվերի կատարումը տարբեր գործողություններ են։',
  steps: [
    ['Ստեղծել կամ խմբագրել', 'Բացեք Ապրանքներ → Ավելացնել կամ ընտրեք տողը։ Ստուգեք հասցեային անունը, կատեգորիան, թարգմանված վերնագիրն ու նկարագրությունը և ակտիվ վիճակը։ Նկարներից ու տարբերակներից առաջ պահեք ապրանքը։'],
    ['Սահմանել տարբերակը', 'Տարբերակներ բաժնում նշեք եզակի SKU-ն, չափը/գույնը, գինն ու պաշարը։ Ստուգեք ծնող ապրանքը։ Առանց վաճառվող տարբերակի ակտիվ ապրանքը սովորաբար հնարավոր չէ գնել։'],
    ['Ստուգել խանութը', 'Պահպանված ապրանքի մեդիայի բաժնով վերբեռնեք նկարները։ Հանրային էջում երկու լեզվով ընտրեք տարբերակը և ստուգեք գինն ու պաշարը։ Տեքստը փորձելու համար իրական վճարում մի կատարեք։'],
    ['Համադրել փոփոխությունները', 'Պաշարը փոխելուց առաջ ստուգեք պահումները և բաց պատվերները։ Ապրանքի նոր գինը չի փոխում հին պատվերի պահպանված գինը։ Հավաքումը, առաքումը, չեղարկումն ու վերադարձը կատարվում են Պատվերներ բաժնում։'],
  ], notes: ['AMD-ով ցուցադրված գումարները դրամով են, ոչ թե դրամի հարյուրերորդականներով կամ արտարժույթով։'],
});

add('competitions', '/admin/events', [shot('events', '/admin/events'), shot('categories', '/admin/competition-categories/new')], {
  title: '06. Events, DanceSport and tournament registration', lead: 'Competitions are events with a registration window and categories. Ordinary event booking is not the same as athlete registration.',
  steps: [
    ['Set up the event', 'Open Events → Add. Select COMPETITION for a tournament; set dates, venue, federation, registration opening/closing dates and participation terms. Save the event and preview it before advertising registration.'],
    ['Create categories', 'Open Competition categories and select the event. Set name, age bounds, program, optional discipline, entry fee and capacity. Programs currently supported are STANDARD and LATINE; choose a compatible discipline.'],
    ['Explain the athlete flow', 'A signed-in participant uses the competition page to choose a category and provide athlete details. Registration checks the window, age, duplicate entries and category capacity. The first registration creates an athlete profile. Investigate the exact rejected condition instead of creating another account.'],
    ['Keep pair concepts separate', 'Partner Full Name is required for a scheduled PAIR lesson booking. It is not proof of a linked second athlete account or completed tournament pair registration. Verify the actual competition entry separately.'],
  ], notes: ['There is no 10-Dance program selector or automatic WDSF calendar import in this release. WDSF events must be entered manually; do not advertise unsupported registration or payment automation.'],
}, {
  title: '06. Միջոցառումներ, մարզական պար և մրցումների հայտեր', lead: 'Մրցումը գրանցման ժամանակահատված ու կատեգորիաներ ունեցող միջոցառում է։ Սովորական միջոցառման ամրագրումը մարզիկի հայտ չէ։',
  steps: [
    ['Ստեղծել միջոցառումը', 'Բացեք Միջոցառումներ → Ավելացնել։ Մրցման համար ընտրեք COMPETITION, նշեք օրերը, վայրը, ֆեդերացիան, գրանցման բացման/փակման ժամկետներն ու մասնակցության պայմանները։ Պահեք և ստուգեք հանրային էջը։'],
    ['Ավելացնել կատեգորիաները', 'Մրցման կատեգորիաներում ընտրեք միջոցառումը։ Նշեք անունը, տարիքային սահմանները, ծրագիրը, անհրաժեշտ դիսցիպլինան, մասնակցության վճարն ու տեղերի սահմանը։ Այժմ աջակցվում են STANDARD և LATINE ծրագրերը։'],
    ['Բացատրել մարզիկի ընթացքը', 'Մուտք գործած մասնակիցը մրցման էջում ընտրում է կատեգորիան և լրացնում մարզիկի տվյալները։ Ստուգվում են ժամկետը, տարիքը, կրկնվող հայտը և տարողությունը։ Առաջին հայտը ստեղծում է մարզիկի պրոֆիլ։ Մերժման դեպքում ստուգեք պատճառը, ոչ թե նոր հաշիվ ստեղծեք։'],
    ['Տարբերակել զույգի հասկացությունները', 'Գործընկերոջ ամբողջական անունը պարտադիր է նախատեսված PAIR դասի համար։ Դա երկրորդ մարզիկի կապված հաշիվ կամ մրցման զույգի ամբողջական հայտ չի նշանակում։ Մրցման գրանցումը ստուգեք առանձին։'],
  ], notes: ['Այս տարբերակում չկան 10-Dance ծրագրի ընտրիչ և WDSF օրացույցի ավտոմատ ներմուծում։ Միջոցառումները մուտքագրվում են ձեռքով. մի խոստացեք չիրականացված ավտոմատացում։'],
});

add('courses', '/admin/courses', [shot('courses', '/admin/courses/new')], {
  title: '07. Courses and learning content', lead: 'A course groups learning material; it does not replace the schedule of in-person classes.',
  steps: [
    ['Describe the course', 'Open Courses → Add. Enter slug, localized title/description, instructor, level, style and discipline where applicable. Review price and publication state. Save before adding dependent content.'],
    ['Arrange lessons', 'Open the course’s Lessons child section. Give each lesson a clear title and order; check duration and the supported video/content fields. Reopen to confirm the saved order.'],
    ['Preview as a learner', 'Open the public course page and inspect its outline, cover and language. Test access with an authorized test account rather than assuming administrator access matches customer entitlement.'],
    ['Distinguish packages', 'Group class passes are not online courses. Group passes do not pay for private or pair lessons. Public package purchase is currently disabled pending payment integration; do not promise activation from a displayed calculated price.'],
  ], notes: ['A catalog record is not evidence that a payment has succeeded or a learner has been granted access.'],
}, {
  title: '07. Դասընթացներ և ուսումնական նյութ', lead: 'Դասընթացը միավորում է ուսումնական նյութը և չի փոխարինում առկա դասերի ժամանակացույցին։',
  steps: [
    ['Նկարագրել դասընթացը', 'Բացեք Դասընթացներ → Ավելացնել։ Լրացրեք հասցեային անունը, թարգմանված վերնագիրն ու նկարագրությունը, մարզչին, մակարդակը, ոճն ու դիսցիպլինան։ Ստուգեք գինն ու հրապարակման վիճակը։ Նախ պահեք հիմնական գրառումը։'],
    ['Դասավորել նյութերը', 'Բացեք դասընթացի դասերի ենթաբաժինը։ Նշեք հստակ վերնագիրն ու հերթականությունը, ստուգեք տևողությունն ու տեսանյութի աջակցվող դաշտերը։ Կրկին բացեք և համոզվեք, որ կարգը պահպանվել է։'],
    ['Ստուգել սովորողի տեսքը', 'Հանրային էջում ստուգեք ծրագիրը, շապիկն ու լեզուն։ Հասանելիությունը փորձեք թույլատրված թեստային հաշվով. ադմինիստրատորի հասանելիությունը չի հավասարվում գնորդի իրավունքին։'],
    ['Տարբերակել փաթեթները', 'Խմբային դասերի փաթեթը առցանց դասընթաց չէ և չի վճարում անհատական կամ զույգի դասի համար։ Հանրային փաթեթների գնումը փակված է մինչև վճարման ինտեգրումը։ Հաշվարկված գինը ակտիվացման ապացույց չէ։'],
  ], notes: ['Կատալոգի գրառումը ինքնին վճարման կամ ուսումնական հասանելիության հաստատում չէ։'],
});

add('banners', '/admin/banners', [shot('banners', '/admin/banners/new'), shot('content', '/admin/content')], {
  title: '08. Homepage banners and content blocks', lead: 'The banner editor is /admin/banners. /admin/content is a block overview, not an arbitrary homepage text editor.',
  steps: [
    ['Create a banner', 'Open Banners → Add. Enter a unique key, then complete the title fields for Armenian, Russian and English. Set the destination link and nonnegative sort order. Keep inactive until the text, link and image are ready.'],
    ['Save, then add the poster', 'Save the record and reopen it. Use its media section to upload or replace the poster. Do not paste an external image URL into the destination-link field: that field is where clicking the banner goes.'],
    ['Publish and preview', 'Set Active and save. Open the homepage in /hy, /ru and /en; check text, poster, relative order and destination. Lower sort values are shown earlier. If unchanged, verify the key and active record before reporting a cache issue.'],
    ['Understand block scope', 'Use /admin/content to inspect ContentBlock keys, locale, order and active state. This overview does not expose free-form editing of every homepage string. Use the supported banner/catalog editor or request an authorized content change.'],
  ], notes: ['Titles require real translations. Repeating the English copy in HY does not create an Armenian version.'],
}, {
  title: '08. Գլխավոր էջի բաններներ և բովանդակության բլոկներ', lead: 'Բանների խմբագրիչը /admin/banners հասցեում է։ /admin/content-ը բլոկների ամփոփում է, ոչ թե կամայական տեքստի խմբագրիչ։',
  steps: [
    ['Ստեղծել բանները', 'Բացեք Բաններներ → Ավելացնել։ Նշեք եզակի բանալին և լրացրեք վերնագիրը հայերեն, ռուսերեն ու անգլերեն։ Սահմանեք նպատակակետ հղումն ու ոչ բացասական հերթականությունը։ Մինչև նկարի ու տեքստի պատրաստ լինելը պահեք ոչ ակտիվ։'],
    ['Պահել, հետո կցել պաստառը', 'Պահեք գրառումը և կրկին բացեք այն։ Մեդիայի բաժնով վերբեռնեք կամ փոխարինեք պաստառը։ Նկարի արտաքին URL-ը մի տեղադրեք նպատակակետ հղման դաշտում. այդ դաշտը բանների սեղմման հասցեն է։'],
    ['Հրապարակել և ստուգել', 'Միացրեք ակտիվ վիճակը և պահեք։ Բացեք գլխավոր էջը /hy, /ru և /en լեզուներով. ստուգեք տեքստը, նկարը, կարգն ու հղումը։ Փոքր հերթականության արժեքը ցուցադրվում է ավելի շուտ։'],
    ['Հասկանալ բլոկների սահմանը', '/admin/content-ում դիտեք ContentBlock բանալին, լեզուն, կարգն ու ակտիվ վիճակը։ Այստեղ գլխավոր էջի բոլոր տեքստերի ազատ խմբագրում չկա։ Օգտագործեք համապատասխան կատալոգային խմբագրիչը կամ դիմեք պատասխանատուին։'],
  ], notes: ['Վերնագրերը պահանջում են իրական թարգմանություն։ Հայերեն դաշտում անգլերենը կրկնելը թարգմանություն չէ։'],
});

add('media', '/admin/media', [shot('media-upload', '/admin/banners/manual-banner', 'section[aria-labelledby="admin-form-media"] > div:last-child')], {
  title: '09. Uploading media directly to R2', lead: 'Save the owning record first. Upload controls attach the stored asset to that record; they replace the old external-URL workflow.',
  steps: [
    ['Choose the correct owner', 'Open the saved class, instructor, venue, product or banner and find its media section. Single-image owners show replacement controls; gallery owners show PhotoUploader. Check which record you are changing.'],
    ['Select the file', 'Drag a supported image into the uploader or use the file picker. JPEG, PNG, WebP and AVIF are supported. Most images allow up to 5 MB; avatars allow 2 MB. Follow the displayed entity limit and size guidance.'],
    ['Wait for completion', 'Provide meaningful alternative text and the offered purpose/order fields. Wait for the upload and attachment to finish, then reload the record and inspect the preview. Selecting a file alone is not a completed upload.'],
    ['Recover from errors', 'For invalid format or excess size, export a compliant file. For permission, connection or storage errors, keep the original and retry only after checking whether the asset already exists. Never expose R2 keys or attempt a public-bucket workaround.'],
  ], notes: ['Removing an image and deleting its owning catalog record are different actions. Verify the public page after replacement; upload completion is not a guarantee that an old CDN image has refreshed everywhere.'],
}, {
  title: '09. Մեդիայի ուղիղ վերբեռնում R2', lead: 'Նախ պահեք նկարը կրող գրառումը։ Վերբեռնիչը ֆայլը կապում է այդ գրառմանը՝ արտաքին URL մուտքագրելու փոխարեն։',
  steps: [
    ['Ընտրել ճիշտ գրառումը', 'Բացեք պահպանված դասը, մարզչին, վայրը, ապրանքը կամ բանները և գտեք մեդիայի բաժինը։ Մեկ նկար ունեցող ռեսուրսն ունի փոխարինման գործիք, պատկերասրահը՝ PhotoUploader։ Ստուգեք, թե որ գրառումն եք փոխում։'],
    ['Ընտրել ֆայլը', 'Քաշեք պատկերը վերբեռնիչի վրա կամ ընտրեք ֆայլը։ Աջակցվում են JPEG, PNG, WebP և AVIF։ Պատկերների մեծ մասի սահմանը 5 MB է, ավատարինը՝ 2 MB։ Հետևեք տվյալ ռեսուրսի քանակի ու չափերի ցուցումներին։'],
    ['Սպասել ավարտին', 'Լրացրեք նկարագրական այլընտրանքային տեքստը և առաջարկվող նպատակի/կարգի դաշտերը։ Սպասեք վերբեռնման ու կցման ավարտին, հետո վերաբացեք գրառումն ու ստուգեք նկարը։ Միայն ֆայլ ընտրելը ավարտված վերբեռնում չէ։'],
    ['Լուծել սխալը', 'Չաջակցվող ձևաչափի կամ մեծ չափի դեպքում արտահանեք համապատասխան ֆայլ։ Կապի, պահոցի կամ իրավունքի սխալի դեպքում պահպանեք բնօրինակը և կրկնելուց առաջ ստուգեք՝ արդյոք նկարը կցվել է։ Մի տարածեք R2 բանալիներ։'],
  ], notes: ['Նկարի հեռացումն ու ծնող գրառման ջնջումը տարբեր գործողություններ են։ Փոխարինումից հետո ստուգեք հանրային էջը. CDN-ի հին պատկերը կարող է դեռ ցուցադրվել։'],
});

add('geography-footer', '/admin/cities', [shot('cities', '/admin/cities'), shot('footer', '/admin/footer-links/new')], {
  title: '10. Cities, districts and footer links', lead: 'These are catalog resources. /admin/settings manages permissions, not the geography or footer.',
  steps: [
    ['Maintain a city', 'Open Cities → Add or edit. Set slug, localized name/description, latitude and longitude, moderation and active state. Coordinates must be numeric and inside the latitude/longitude ranges.'],
    ['Maintain a district', 'Open the city’s Districts child section or /admin/districts. Select its parent city, supply localized name, slug, coordinates, display order and active state. Check linked venue addresses before deactivation.'],
    ['Create a footer link', 'Open /admin/footer-links → Add. Select a group, supply an existing translation label key and destination, set order and Active. The label key is not arbitrary visible copy; unknown keys can render incorrectly.'],
    ['Check all languages', 'Inspect the footer and geography selectors on the public site in HY/RU/EN. Optional feature gating may hide a link even when active. Check destination and ordering; avoid duplicate links or unsupported translation keys.'],
  ], notes: ['Relative internal destinations should point to supported site routes. Do not paste administrative or secret URLs into the public footer.'],
}, {
  title: '10. Քաղաքներ, շրջաններ և ստորատակի հղումներ', lead: 'Սրանք կատալոգի ռեսուրսներ են։ /admin/settings-ը կառավարում է իրավունքները, ոչ թե աշխարհագրությունն ու ստորատակը։',
  steps: [
    ['Կառավարել քաղաքը', 'Բացեք Քաղաքներ → Ավելացնել կամ խմբագրեք գրառումը։ Նշեք հասցեային անունը, թարգմանված անունն ու նկարագրությունը, լայնությունն ու երկայնությունը, մոդերացիան և ակտիվ վիճակը։ Կոորդինատները պետք է լինեն թույլատրելի թվային միջակայքում։'],
    ['Կառավարել շրջանը', 'Բացեք քաղաքի Շրջաններ ենթաբաժինը կամ /admin/districts։ Ընտրեք ծնող քաղաքը, անունը, հասցեային անունը, կոորդինատները, կարգն ու ակտիվ վիճակը։ Ապաակտիվացնելուց առաջ ստուգեք կապված վայրերը։'],
    ['Ստեղծել ստորատակի հղումը', '/admin/footer-links բաժնում ընտրեք Ավելացնել։ Նշեք խումբը, գոյություն ունեցող թարգմանության բանալին, նպատակակետը, կարգն ու ակտիվ վիճակը։ Բանալին ազատ ցուցադրվող տեքստ չէ. անհայտ բանալին կարող է սխալ երևալ։'],
    ['Ստուգել երեք լեզուները', 'Հանրային կայքում ստուգեք ստորատակը և աշխարհագրական ընտրիչները HY/RU/EN լեզուներով։ Հնարավորության պայմանը կարող է թաքցնել նույնիսկ ակտիվ հղումը։ Ստուգեք նպատակակետն ու հերթականությունը։'],
  ], notes: ['Ներքին հղումները պետք է տանեն աջակցվող հանրային էջերի։ Մի հրապարակեք գաղտնի կամ ադմինիստրատիվ URL-ներ։'],
});

add('bookings', '/admin/bookings', [shot('bookings', '/admin/bookings'), shot('booking-detail', '/admin/bookings/manual-booking-0')], {
  title: '11. Booking desk and pair lessons', lead: 'A booking is an operational record. Confirm the person, session, participants and frozen commercial terms before changing it.',
  steps: [
    ['Find the reservation', 'Open /admin/bookings. Search the reference, customer name or email and apply a status filter only when useful. Open the matching row and verify session, date, instructor, venue, participants and amount.'],
    ['Handle a pair lesson', 'For lesson type PAIR, participants is two and Partner Full Name is required. The stored price is for the pair; the session capacity counts people. Do not create a second booking for the partner.'],
    ['Change status', 'Use only the transition offered for the current status. Completion and no-show are not cancellation. Cancellation uses the separate action with a factual reason and calculates the frozen policy outcome.'],
    ['Reschedule carefully', 'A scheduled session can be moved only through the supported flow that atomically reserves a new session. Check the reschedule window and remaining limit; never edit dates directly to make a conflict disappear.'],
  ], notes: ['Partner name support does not create a second customer account or a linked competition partnership.'],
}, {
  title: '11. Ամրագրումների կենտրոն և զույգի դասեր', lead: 'Ամրագրումը գործառնական գրառում է։ Փոփոխությունից առաջ հաստատեք անձին, անցկացումը, մասնակիցներին ու պահպանված առևտրային պայմանները։',
  steps: [
    ['Գտնել ամրագրումը', 'Բացեք /admin/bookings։ Որոնեք հղման համարով, հաճախորդի անունով կամ հասցեով և անհրաժեշտության դեպքում զտեք կարգավիճակով։ Բացեք ճիշտ տողը և ստուգեք անցկացումը, օրը, մարզչին, վայրը, մասնակիցներն ու գումարը։'],
    ['Աշխատել զույգի դասի հետ', 'PAIR ձևաչափի դեպքում մասնակիցների թիվը երկու է, իսկ Partner Full Name-ը պարտադիր է։ Գինը զույգի համար է, տարողությունը հաշվում է մարդկանց։ Գործընկերոջ համար երկրորդ ամրագրում մի ստեղծեք։'],
    ['Փոխել կարգավիճակը', 'Օգտագործեք միայն տվյալ կարգավիճակի համար ցուցադրվող անցումը։ Ավարտվածն ու չներկայանալը չեղարկում չեն։ Չեղարկումը կատարեք առանձին գործողությամբ՝ փաստական պատճառով և պահպանված կանոնների հաշվարկով։'],
    ['Փոխել ժամը', 'Նախատեսված անցկացումը տեղափոխեք միայն աջակցվող հոսքով, որը նոր տեղը ամրագրում է ատոմար։ Ստուգեք տեղափոխման ժամկետն ու մնացած քանակը. ամսաթիվը ձեռքով մի փոխեք հակասությունը թաքցնելու համար։'],
  ], notes: ['Գործընկերոջ անվան աջակցությունը երկրորդ հաճախորդի հաշիվ կամ մրցման գործընկերության կապ չի ստեղծում։'],
});

add('orders', '/admin/orders', [shot('orders', '/admin/orders'), shot('order-detail', '/admin/orders/manual-order-0')], {
  title: '12. Orders, fulfilment and refunds', lead: 'Keep fulfilment status and payment status distinct. A refund request is not proof that money has returned.',
  steps: [
    ['Locate the order', 'Open /admin/orders. Search order number, customer name or contact email. Confirm contact details, line items, totals, payment rows and current fulfilment status before replying.'],
    ['Move fulfilment forward', 'Use the offered order transition: Paid → Packing → Shipped → Delivered, or the supported cancellation/return path. Record the physical hand-off outside the app according to warehouse policy.'],
    ['Register a manual refund', 'In the order payment panel enter an amount no greater than the refundable paid total and a reason of at least three characters. Under the configured manual limit the app registers a pending provider refund. It does not claim completed settlement.'],
    ['Escalate a large refund', 'An amount above the manual threshold creates a Maker-Checker ApprovalRequest. Leave it pending until an independent authorized reviewer approves it. Never split a refund to evade the threshold.'],
  ], notes: ['The current provider adapter records a pending refund; the bank/provider completion must be confirmed before communicating “returned”.'],
}, {
  title: '12. Պատվերներ, կատարում և վերադարձներ', lead: 'Կատարման և վճարման կարգավիճակները տարբեր են։ Վերադարձի հայտը դեռ չի նշանակում, որ գումարը վերադարձվել է։',
  steps: [
    ['Գտնել պատվերը', 'Բացեք /admin/orders։ Որոնեք պատվերի համարը, հաճախորդի անունը կամ կապի հասցեն։ Պատասխանելուց առաջ հաստատեք կոնտակտները, տողերը, ընդհանուր գումարը, վճարումները և կատարման կարգավիճակը։'],
    ['Առաջ տանել կատարումը', 'Օգտագործեք առաջարկվող անցումը՝ Վճարված → Հավաքվում է → Ուղարկված → Առաքված, կամ աջակցվող չեղարկման/վերադարձի ուղին։ Ֆիզիկական փոխանցումը գրանցեք նաև պահեստի կանոններով։'],
    ['Գրանցել ձեռքով վերադարձը', 'Վճարման բաժնում նշեք վերադարձվող գումարը՝ ոչ ավելի, քան վճարված մնացորդը, և առնվազն երեք նիշով պատճառ։ Ձեռքով սահմանաչափի ներքո համակարգը գրանցում է մատակարարի սպասող վերադարձ, ոչ թե կատարված գումար։'],
    ['Մեծ վերադարձը փոխանցել հաստատման', 'Ձեռքով սահմանաչափից բարձր գումարը ստեղծում է Maker-Checker հաստատման հայտ։ Թողեք սպասման մեջ մինչև անկախ լիազորված ստուգողը հաստատի։ Սահմանաչափը շրջանցելու համար վերադարձը մի բաժանեք մասերի։'],
  ], notes: ['Ընթացիկ ադապտերը վերադարձը պահում է սպասող վիճակում։ «Վերադարձված» գրեք միայն բանկի կամ մատակարարի հաստատումից հետո։'],
});

add('moderation', '/admin/moderation?tab=reviews&status=PENDING', [shot('moderation', '/admin/moderation?tab=reviews&status=PENDING')], {
  title: '13. Moderation and reviews', lead: 'Moderation protects the public catalog. Decide from the submitted record and evidence, not from a queue count.',
  steps: [
    ['Choose the queue', 'Open Moderation and select Reviews, Instructor profiles or Venues. Keep the tab and status visible in the URL when handing work to another operator.'],
    ['Review context', 'Check the author or applicant, target record, rating/body or profile fields and verification state. A verified purchase is context, not automatic approval.'],
    ['Decide once', 'Use the record’s decision control and provide a factual rejection reason when requested. Reopen the queue and confirm the new status. Do not approve another item to clear an empty-looking screen.'],
    ['Escalate disputes', 'Preserve the record and audit trail if a review is abusive, a profile is unsafe or the target has a financial dispute. Use the designated escalation rather than editing evidence out of the database.'],
  ], notes: ['Empty tabs are valid when no matching pending records exist. Clear filters before reporting a missing submission.'],
}, {
  title: '13. Մոդերացիա և կարծիքներ', lead: 'Մոդերացիան պաշտպանում է հանրային կատալոգը։ Որոշումը հիմնեք գրառման ու ապացույցի վրա, ոչ թե հերթի թվի։',
  steps: [
    ['Ընտրել հերթը', 'Բացեք Մոդերացիա և ընտրեք Կարծիքներ, Մարզիչների էջեր կամ Վայրեր։ Աշխատանք փոխանցելիս URL-ում պահեք ներդիրն ու կարգավիճակը։'],
    ['Ստուգել համատեքստը', 'Դիտեք հեղինակին, թիրախ գրառումը, գնահատականը/տեքստը կամ պրոֆիլի դաշտերը և հաստատման վիճակը։ Հաստատված գնումը համատեքստ է, ոչ ավտոմատ հաստատում։'],
    ['Որոշել մեկ անգամ', 'Օգտագործեք տվյալ գրառման որոշման գործողությունը և անհրաժեշտության դեպքում գրեք փաստական մերժման պատճառ։ Վերաբացեք հերթը և ստուգեք նոր վիճակը։ Դատարկ ցանկը «մաքրելու» համար ուրիշ գրառում մի հաստատեք։'],
    ['Փոխանցել վեճը', 'Վիրավորական կարծիքի, վտանգավոր պրոֆիլի կամ ֆինանսական վեճի դեպքում պահպանեք գրառումն ու մատյանը։ Օգտագործեք սահմանված փոխանցման գործընթացը, ոչ թե ջնջեք ապացույցը։'],
  ], notes: ['Դատարկ ներդիրը բնական է, եթե համապատասխան սպասող գրառում չկա։ Զտիչները մաքրեք՝ բացակայությունը հաղորդելուց առաջ։'],
});

add('promotions', '/admin/promo-codes', [shot('promo-codes', '/admin/promo-codes'), shot('gift-cards', '/admin/gift-cards')], {
  title: '14. Promo codes, gift cards and banners', lead: 'Campaign configuration changes customer pricing. Validate scope, dates and limits before activating it.',
  steps: [
    ['Review a promo code', 'Open /admin/promo-codes. Check code, percent/fixed type, value, minimum order, maximum discount, applicable line items, usage limits and dates.'],
    ['Create a controlled campaign', 'Use Add with a unique code and explicit start/end dates. Keep it inactive while confirming the campaign owner’s approval and test a non-live cart calculation if available.'],
    ['Check gift cards', 'Open /admin/gift-cards and verify code, initial amount, remaining balance, recipient and expiry. Do not expose recipient contact data in a public screenshot or hand-off.'],
    ['Coordinate the banner', 'A banner can advertise a campaign but does not grant a discount. Link it to the supported public destination and test the full path in each advertised locale.'],
  ], notes: ['Promo and gift-card balances are financial state. Do not “fix” a mismatch by editing a customer order or creating a replacement code.'],
}, {
  title: '14. Զեղչի կոդեր, նվեր քարտեր և բաններներ', lead: 'Արշավի կարգավորումը փոխում է հաճախորդի գինը։ Ակտիվացնելուց առաջ ստուգեք շրջանակը, ժամկետներն ու սահմանները։',
  steps: [
    ['Ստուգել զեղչի կոդը', 'Բացեք /admin/promo-codes։ Ստուգեք կոդը, տոկոսային/ֆիքսված տեսակը, չափը, նվազագույն պատվերը, առավելագույն զեղչը, կիրառվող տողերը, սահմաններն ու ժամկետները։'],
    ['Ստեղծել վերահսկվող արշավ', 'Ավելացնելով նշեք եզակի կոդ ու հստակ սկիզբ/ավարտ։ Արշավի պատասխանատուի հաստատումը ստանալուց և փորձնական հաշվարկը ստուգելուց հետո միայն միացրեք այն։'],
    ['Ստուգել նվեր քարտերը', 'Բացեք /admin/gift-cards և ստուգեք կոդը, սկզբնական գումարը, մնացորդը, ստացողին ու ժամկետը։ Հանրային նկարում կամ փոխանցման գրառման մեջ մի բացահայտեք կոնտակտային տվյալը։'],
    ['Համադրել բանները', 'Բանները կարող է գովազդել արշավը, բայց ինքնուրույն զեղչ չի տալիս։ Կապեք աջակցվող հանրային հասցեին և ամբողջ ճանապարհը ստուգեք գովազդվող լեզուներով։'],
  ], notes: ['Զեղչերն ու նվեր քարտերի մնացորդը ֆինանսական վիճակ են։ Անհամապատասխանությունը մի շրջանցեք նոր կոդ կամ պատվեր ստեղծելով։'],
});

add('payouts-approvals', '/admin/payouts', [shot('payouts', '/admin/payouts'), shot('approvals', '/admin/approvals')], {
  title: '15. Payouts and Maker-Checker approvals', lead: 'Payout release and approval review are separate control steps. A row in the queue is not an instruction to pay.',
  steps: [
    ['Reconcile a payout', 'Open Payouts and verify reference, period, payee account, masked destination, amount and status. Compare the period with commission/source records before release.'],
    ['Respect account masking', 'Only masked payout details should be visible in the panel. If a destination looks wrong, hold the payout and use the approved finance escalation; never ask an operator to paste full banking data into chat.'],
    ['Review an approval', 'Open /admin/approvals. Read action, requester, reason, payload summary, expiry and prior audit activity. Independently confirm the underlying order or operation.'],
    ['Close the control loop', 'Approve or reject only if authorized and add a factual note. Reopen the queue and audit log. If the request expires or the evidence is incomplete, leave it pending/escalate rather than approve by assumption.'],
  ], notes: ['The manual refund threshold creates an approval request; the reviewer is intentionally separate from the requester.'],
}, {
  title: '15. Փոխանցումներ և Maker-Checker հաստատումներ', lead: 'Փոխանցումն ու հաստատումը տարբեր վերահսկման քայլեր են։ Հերթի գրառումը ինքնին վճարման հրահանգ չէ։',
  steps: [
    ['Համադրել փոխանցումը', 'Բացեք Փոխանցումներ և ստուգեք համարը, ժամանակահատվածը, ստացող հաշիվը, քողարկված ուղղությունը, գումարն ու կարգավիճակը։ Համեմատեք ժամանակահատվածը միջնորդավճարի գրառումների հետ։'],
    ['Պահել քողարկումը', 'Վահանակում երևում են միայն քողարկված վճարային տվյալներ։ Սխալ ուղղության դեպքում պահեք փոխանցումը և դիմեք ֆինանսական պատասխանատուին. ամբողջ բանկային տվյալը մի տեղադրեք հաղորդագրության մեջ։'],
    ['Ստուգել հաստատումը', 'Բացեք /admin/approvals։ Կարդացեք գործողությունը, հարցնողին, պատճառը, գումարի ամփոփումը, ժամկետը և նախորդ մատյանը։ Անկախ ստուգեք պատվերը կամ հիմքում ընկած գործողությունը։'],
    ['Փակել վերահսկման շրջանը', 'Հաստատեք կամ մերժեք միայն լիազորության դեպքում և գրեք փաստական նշում։ Կրկին բացեք հերթն ու մատյանը։ Թերի ապացույցի դեպքում թողեք սպասման մեջ կամ փոխանցեք պատասխանատուին։'],
  ], notes: ['Ձեռքով վերադարձի սահմանաչափից բարձր գումարը ստեղծում է հաստատման հայտ. հարցնողն ու ստուգողը պետք է տարբեր լինեն։'],
});

add('support', '/admin/support', [shot('support', '/admin/support'), shot('support-operations', '/admin/support/operations')], {
  title: '16. Support command center', lead: 'Support is an operator role with server-side allowlisting. Use it to find and explain records, not to bypass audit or payment controls.',
  steps: [
    ['Confirm operator mode', 'Open /admin/support and check the operator identity, capability notice, queue totals and recent activity. If the page denies access, do not attempt a direct action URL.'],
    ['Find a customer issue', 'Use the support queue or the approved global search. Search a booking reference, order number, customer email or support ticket identifier; confirm the returned record with the customer before acting.'],
    ['Use tools deliberately', 'Database Browser is read-oriented and paginated; Translation Editor validates parameters/tags before an override; Operations runs bounded jobs. Export only when the request and data policy authorize it.'],
    ['Respond and record', 'Reply to a ticket with factual, minimal information and distinguish an internal note from a customer reply. Refunds, impersonation and feature changes retain their own guards and audit events.'],
  ], notes: ['The current support screen does not expose a separate phone check-in/refund bypass workflow. Do not document or promise one.'],
}, {
  title: '16. Կաջակցության օպերատորի կենտրոն', lead: 'Աջակցությունը սերվերով թույլատրված օպերատորի դեր է։ Այն գտնում ու բացատրում է գրառումները, բայց չի շրջանցում մատյանն ու վճարային վերահսկումը։',
  steps: [
    ['Ստուգել օպերատորի ռեժիմը', 'Բացեք /admin/support և ստուգեք օպերատորի ինքնությունը, իրավասության ծանուցումը, հերթի թվերը ու վերջին գործողությունները։ Մերժման դեպքում ուղիղ action URL մի փորձեք։'],
    ['Գտնել հարցը', 'Օգտագործեք աջակցության հերթը կամ հաստատված ընդհանուր որոնումը։ Որոնեք ամրագրման հղումը, պատվերի համարը, հաճախորդի հասցեն կամ տոմսի համարը և հաճախորդի հետ հաստատեք ճիշտ գրառումը։'],
    ['Գործիքներն օգտագործել նպատակով', 'Տվյալների դիտարկիչը ընթերցման ու էջավորման համար է, Թարգմանության խմբագրիչը ստուգում է պարամետրերն ու թեգերը, Գործառնությունները գործարկում են սահմանափակ աշխատանքներ։ Արտահանումը կատարեք միայն լիազորված պահանջով։'],
    ['Պատասխանել և գրանցել', 'Տոմսին պատասխանեք փաստական և նվազագույն տեղեկատվությամբ, տարբերակեք ներքին նշումն ու հաճախորդի պատասխանը։ Վերադարձը, impersonation-ը և feature-ները պահում են իրենց guard-երն ու մատյանները։'],
  ], notes: ['Ընթացիկ էկրանում առանձին հեռախոսային check-in կամ Maker-Checker-ից դուրս վերադարձի հոսք չկա։ Մի խոստացեք այդպիսի գործառույթ։'],
});

add('operator-tools', '/admin/support/database', [shot('database-browser', '/admin/support/database'), shot('translations', '/admin/support/translations')], {
  title: '17. Database Browser and Translation Editor', lead: 'Operator tools are controlled views over live application data. They are not a replacement for domain actions or source-code review.',
  steps: [
    ['Browse safely', 'Open Database Browser from Support. Choose a model, page through rows and use a narrow search. Treat all values as sensitive; do not copy full rows to an external document.'],
    ['Export with a reason', 'Use Export only when the data request has a documented business purpose and approved destination. Keep the exported file private and delete it according to retention policy.'],
    ['Edit a translation override', 'Search for a key, choose HY/RU/EN, edit only the value and Save. The action validates parameter placeholders and markup tags; a rejected save means the value is structurally unsafe.'],
    ['Reset instead of layering', 'If a temporary override is no longer needed, use Reset Override. Reopen the public locale and check the resulting copy. Do not use the terminal to alter translation files or database values ad hoc.'],
  ], notes: ['The guide intentionally does not include a free-form terminal command recipe. Run only the bounded jobs exposed by the operator UI.'],
}, {
  title: '17. Տվյալների դիտարկիչ և թարգմանությունների խմբագրիչ', lead: 'Օպերատորի գործիքները վերահսկվող դիտումներ են։ Դրանք չեն փոխարինում դոմենային գործողություններին կամ սկզբնական կոդի ստուգմանը։',
  steps: [
    ['Դիտարկել անվտանգ', 'Աջակցությունից բացեք Տվյալների դիտարկիչը։ Ընտրեք մոդելը, թերթեք էջերը և օգտագործեք նեղ որոնում։ Բոլոր արժեքները զգայուն համարեք և ամբողջ տողերը արտաքին ֆայլ մի պատճենեք։'],
    ['Արտահանել հիմնավորմամբ', 'Արտահանումը կատարեք միայն փաստաթղթավորված նպատակով և հաստատված հասցեատիրոջ համար։ Ֆայլը պահեք մասնավոր և ջնջեք պահպանման կանոնով։'],
    ['Փոխել թարգմանության override-ը', 'Որոնեք բանալին, ընտրեք HY/RU/EN, փոխեք միայն արժեքը և պահեք։ Գործողությունը ստուգում է պարամետրերն ու markup թեգերը։ Մերժումը նշանակում է կառուցվածքային խնդիր։'],
    ['Վերականգնել, ոչ թե շերտավորել', 'Ժամանակավոր override-ը հեռացնելու համար ընտրեք Reset Override։ Վերաբացեք հանրային լեզուն և ստուգեք տեքստը։ Terminal-ով պատահական արժեքներ մի փոխեք։'],
  ], notes: ['Ուղեցույցը չի պարունակում ազատ terminal հրամանների բաղադրատոմս։ Օգտագործեք միայն UI-ում ցուցադրվող սահմանափակ աշխատանքները։'],
});

add('access-audit-trash', '/admin/settings', [shot('settings', '/admin/settings'), shot('audit-log', '/admin/audit-log'), shot('trash', '/admin/trash?tab=products')], {
  title: '18. Access, audit trail and trash recovery', lead: 'Permission changes and deletion recovery are high-impact controls. Make the smallest reversible change.',
  steps: [
    ['Grant least privilege', 'In Settings review the capability matrix and expiring grants. Grant only the required capability, role and duration; money, role changes and permanent purge are not ordinary temporary grants.'],
    ['Investigate the audit log', 'Search Audit log by actor, action or entity. Record timestamp, actor, entity and reason in the hand-off. Never delete or rewrite an audit record to hide a mistake.'],
    ['Recover from Trash', 'Open Trash, select the resource tab and inspect title, deleted-at time and available actions. Restore only the intended record after checking whether its slug or relationships now conflict.'],
    ['Purge only deliberately', 'Permanent purge is irreversible. Confirm the retention window, legal/business need and authorization; if any part is unclear, leave the record in Trash and escalate.'],
  ], notes: ['Admin and support access are server-checked. A visible menu item is not a reason to share a session or bypass a denied capability.'],
}, {
  title: '18. Հասանելիություն, մատյան և աղբարկղի վերականգնում', lead: 'Իրավունքի և ջնջման վերականգնման գործողությունները բարձր ազդեցություն ունեն։ Կատարեք ամենափոքր վերադարձելի փոփոխությունը։',
  steps: [
    ['Տալ նվազագույն իրավունք', 'Կարգավորումներում ստուգեք capability մատրիցն ու ժամկետով grants-ը։ Տվեք միայն անհրաժեշտ իրավունքն ու ժամկետը։ Գումարը, դերերի փոփոխությունն ու վերջնական ջնջումը սովորական ժամանակավոր grant չեն։'],
    ['Ուսումնասիրել մատյանը', 'Մատյանում որոնեք կատարողին, գործողությունը կամ գրառումը։ Փոխանցման մեջ նշեք ժամը, կատարողը, գրառումն ու պատճառը։ Սխալը թաքցնելու համար մատյանը մի ջնջեք կամ փոխեք։'],
    ['Վերականգնել աղբարկղից', 'Բացեք Աղբարկղը, ընտրեք ռեսուրսի ներդիրը և ստուգեք անունը, ջնջման պահն ու գործողությունները։ Վերականգնեք միայն ճիշտ գրառումը՝ ստուգելով հասցեի ու կապերի հակասությունները։'],
    ['Վերջնական ջնջել միայն գիտակցված', 'Անդարձելի ջնջումից առաջ հաստատեք պահպանման ժամկետը, իրավական/գործնական անհրաժեշտությունն ու լիազորությունը։ Անորոշության դեպքում թողեք աղբարկղում և փոխանցեք պատասխանատուին։'],
  ], notes: ['Ադմինիստրատորի և աջակցության իրավունքները ստուգվում են սերվերում։ Ցուցադրվող հղումը չի արդարացնում cookie-ի փոխանցումը կամ guard-ի շրջանցումը։'],
});

add('reports-integrations', '/admin/reports', [shot('reports', '/admin/reports'), shot('integrations', '/admin/integrations')], {
  title: '19. Reports and integrations', lead: 'Reports summarize the current accessible dataset; integrations describe configured services, not guaranteed delivery.',
  steps: [
    ['Set the reporting scope', 'Open Reports and choose the supported period/filter. Note timezone and role scope before comparing totals with a payment provider or spreadsheet.'],
    ['Explain a mismatch', 'Trace the total to orders, bookings, refunds and payout records. Separate pending/failed provider states from completed money. Do not “correct” a report by editing source history.'],
    ['Inspect integrations', 'Open Integrations to see configured service status and safe operational hints. Treat a missing credential or disabled service as an environment/engineering issue, not a reason to expose a secret.'],
    ['Hand off with evidence', 'Include report range, filters, record references and timestamps. Mask personal and banking information. A report export must follow the same data-retention policy as the source.'],
  ], notes: ['Provider credentials and R2 keys never belong in the manual, screenshots, tickets or browser fields.'],
}, {
  title: '19. Հաշվետվություններ և ինտեգրումներ', lead: 'Հաշվետվությունը ամփոփում է հասանելի ընթացիկ տվյալները, իսկ ինտեգրումների էկրանը ցույց է տալիս կարգավորումը, ոչ առաքման երաշխիքը։',
  steps: [
    ['Սահմանել հաշվետվության շրջանակը', 'Բացեք Հաշվետվություններ և ընտրեք աջակցվող ժամանակահատվածն ու զտիչը։ Նշեք ժամային գոտին ու դերի սահմանը՝ վճարային մատակարարի կամ աղյուսակի հետ համեմատելուց առաջ։'],
    ['Բացատրել տարբերությունը', 'Ընդհանուր թիվը հետագծեք պատվերների, ամրագրումների, վերադարձների ու փոխանցումների գրառումներով։ Սպասող/ձախողված մատակարարի վիճակը մի շփոթեք ավարտված գումարի հետ։'],
    ['Դիտել ինտեգրումները', 'Ինտեգրումների բաժնում տեսեք ծառայության վիճակն ու անվտանգ հուշումները։ Բացակայող գաղտնաբառը կամ անջատված ծառայությունը տեխնիկական հարց է, ոչ գաղտնիքը բացահայտելու պատճառ։'],
    ['Փոխանցել ապացույցով', 'Նշեք ժամանակահատվածը, զտիչները, գրառումների համարներն ու ժամերը։ Անձնական և բանկային տվյալները քողարկեք։ Արտահանված հաշվետվությունը պահեք աղբյուրի պահպանման կանոնով։'],
  ], notes: ['Մատակարարների գաղտնաբառերն ու R2 բանալիները չեն պատկանում ուղեցույցին, նկարներին, տոմսերին կամ բրաուզերի դաշտերին։'],
});

add('users', '/admin/users', [shot('users', '/admin/users')], {
  title: '20. Users and account support', lead: 'Account administration changes access to personal data and actions. Verify identity and scope before editing.',
  steps: [
    ['Find the account', 'Search exact name or email in Users. Confirm the customer/staff identity using the support context; do not use a similar email as a substitute.'],
    ['Edit profile data', 'Change only fields the workflow supports. Check email, active state and locale after saving. Do not place passwords, tokens or full payment details in profile notes.'],
    ['Review a role request', 'Role changes are privileged. Require the approved request and least-privilege reason, then confirm the resulting capability matrix and audit event.'],
    ['Impersonation boundary', 'Support impersonation is time-limited, excludes staff targets and must be started through its guarded action. Stop it after diagnosis and never perform an irreversible financial action while impersonating a customer.'],
  ], notes: ['Account deactivation takes effect on the next server authorization check even if an old browser session exists.'],
}, {
  title: '20. Օգտվողներ և հաշվի աջակցություն', lead: 'Հաշվի կառավարումը փոխում է անձնական տվյալների ու գործողությունների հասանելիությունը։ Խմբագրելուց առաջ ստուգեք ինքնությունն ու շրջանակը։',
  steps: [
    ['Գտնել հաշիվը', 'Օգտվողների բաժնում որոնեք ճշգրիտ անունով կամ հասցեով։ Աջակցության համատեքստով հաստատեք անձին. նման հասցեն փոխարինող չի։'],
    ['Խմբագրել պրոֆիլը', 'Փոխեք միայն ընթացակարգով աջակցվող դաշտերը։ Պահելուց հետո ստուգեք հասցեն, ակտիվ վիճակն ու լեզուն։ Գաղտնաբառ, token կամ ամբողջական վճարային տվյալ մի գրեք նշումներում։'],
    ['Քննել դերի հայտը', 'Դերի փոփոխությունը արտոնյալ է։ Պահանջեք հաստատված հայտ ու նվազագույն իրավունքի հիմնավորում, ապա ստուգեք capability մատրիցն ու մատյանի գրառումը։'],
    ['Impersonation-ի սահմանը', 'Աջակցության impersonation-ը ժամանակավոր է, չի ներառում աշխատակիցների հաշիվներ և սկսվում է պաշտպանված action-ով։ Ախտորոշումից հետո կանգնեցրեք այն և հաճախորդին նմանակելիս անդարձելի ֆինանսական գործողություն մի կատարեք։'],
  ], notes: ['Ապաակտիվացումը կիրառվում է հաջորդ սերվերային իրավունքի ստուգման ժամանակ՝ նույնիսկ հին բրաուզերային սեսիայի առկայությամբ։'],
});

add('pair-booking', '/admin/classes', [shot('pair-class', '/admin/classes/new')], {
  title: '21. DanceSport catalog and pair-booking rules', lead: 'DanceSport metadata is structured catalog data. Do not turn a pair lesson into a competition registration by copying names between screens.',
  steps: [
    ['Choose the lesson type', 'For a pair offer select PAIR. Set a price for the pair and ensure the session capacity can hold two people. The booking retains lesson type and participant count.'],
    ['Use precise taxonomy', 'Choose the broad style and, where relevant, a specific DanceSport discipline. Current programs are STANDARD and LATINE. A separate 10-Dance program is not currently selectable.'],
    ['Capture the partner', 'At booking, enter Partner Full Name exactly as supplied by the customer. It is required for the pair booking and is stored with the reservation; a partner account is not created automatically.'],
    ['Check cancellation', 'A pair occupies two places and is cancelled as one customer reservation. Apply the stored cancellation window and payment outcome; do not release only one place or create an informal second booking.'],
  ], notes: ['Tournament categories have their own program field and registration checks. Pair lesson rules do not implement WDSF pair registration.'],
}, {
  title: '21. Մարզական պարի կատալոգ և զույգի ամրագրման կանոններ', lead: 'Մարզական պարի մետատվյալները կառուցվածքային կատալոգի տվյալներ են։ Զույգի դասը մրցման հայտի մի վերածեք՝ էկրանների միջև անուններ պատճենելով։',
  steps: [
    ['Ընտրել ձևաչափը', 'Զույգի առաջարկի համար ընտրեք PAIR։ Գինը սահմանեք զույգի համար և համոզվեք, որ անցկացումը տեղ ունի երկու անձի համար։ Ամրագրումը պահում է ձևաչափն ու մասնակիցների թիվը։'],
    ['Օգտագործել ճշգրիտ դասակարգումը', 'Ընտրեք ընդհանուր ոճը և անհրաժեշտության դեպքում՝ մարզական պարի դիսցիպլինան։ Այժմ կան STANDARD և LATINE ծրագրերը։ Առանձին 10-Dance ծրագիր ընտրել հնարավոր չէ։'],
    ['Գրանցել գործընկերոջը', 'Ամրագրման ժամանակ լրացրեք Partner Full Name-ը հաճախորդի տրամադրած ձևով։ Այն պարտադիր է զույգի ամրագրման համար և պահվում է ամրագրումում, բայց գործընկերոջ հաշիվ ինքնուրույն չի ստեղծվում։'],
    ['Ստուգել չեղարկումը', 'Զույգը զբաղեցնում է երկու տեղ և չեղարկվում է որպես մեկ հաճախորդի ամրագրում։ Կիրառեք պահպանված ժամկետն ու վճարման արդյունքը. մեկ տեղը առանձին մի ազատեք։'],
  ], notes: ['Մրցման կատեգորիան իր ծրագրի դաշտն ու հայտի ստուգումներն ունի։ Զույգի դասի կանոնը WDSF զույգի հայտ չէ։'],
});

add('finance-controls', '/admin/orders', [shot('refund-dialog', '/admin/orders/manual-order-1')], {
  title: '22. Financial controls and safe customer communication', lead: 'Financial support must preserve the difference between a request, a pending provider operation and confirmed settlement.',
  steps: [
    ['Read the evidence', 'Use the order/payment rows and the booking’s frozen policy. Confirm amount paid, prior refunds, status and provider reference before discussing an outcome.'],
    ['State what is known', 'Say “refund registered/pending” when that is the state. Do not say “the bank returned the money” without provider confirmation. Include the internal reference and expected next owner, not private payloads.'],
    ['Avoid duplicate actions', 'Do not retry a charge, create a second order, or submit a second refund because a provider response is slow. Check the idempotent record and audit log first.'],
    ['Escalate exceptions', 'Chargebacks, provider failures, mismatched totals and requests above the manual limit go to finance/engineering with timestamps and references. Preserve the current record.'],
  ], notes: ['The screenshot shows a redacted synthetic order. It is a procedure illustration, not a customer receipt or a promise of provider timing.'],
}, {
  title: '22. Ֆինանսական վերահսկում և անվտանգ հաղորդակցություն', lead: 'Ֆինանսական աջակցությունը պետք է տարբերակի հայտը, մատակարարի սպասող գործողությունն ու հաստատված հաշվարկը։',
  steps: [
    ['Կարդալ ապացույցը', 'Օգտվեք պատվերի/վճարման տողերից և ամրագրման պահպանված կանոններից։ Հաղորդակցությունից առաջ հաստատեք վճարվածը, նախկին վերադարձները, կարգավիճակն ու մատակարարի հղումը։'],
    ['Ասել միայն հայտնի փաստը', 'Գրեք «վերադարձը գրանցված է/սպասում է», եթե դա է վիճակը։ Բանկի հաստատման բացակայությամբ «գումարը վերադարձվել է» մի ասեք։ Տվեք ներքին համարը, ոչ մասնավոր payload-ը։'],
    ['Խուսափել կրկնությունից', 'Դանդաղ մատակարարի պատասխանի պատճառով կրկին գումար մի գանձեք, երկրորդ պատվեր կամ վերադարձ մի ստեղծեք։ Նախ ստուգեք idempotent գրառումն ու մատյանը։'],
    ['Փոխանցել բացառությունները', 'Chargeback-ը, մատակարարի սխալը, անհամապատասխան ընդհանուր գումարը և սահմանաչափից բարձր հայտը փոխանցեք ֆինանսներին/տեխնիկական թիմին՝ ժամերով ու համարներով։ Պահպանեք ընթացիկ վիճակը։'],
  ], notes: ['Պատկերը քողարկված ուսումնական պատվեր է. այն անդորրագիր կամ մատակարարի ժամկետի խոստում չէ։'],
});

add('incident-routine', '/admin', [], {
  title: '23. Incident response and shift hand-off', lead: 'When the system is uncertain, preserve evidence and reduce the scope of the next action.',
  steps: [
    ['Stabilize', 'Stop repeated submits and do not mutate the record while a payment, booking or permission state is unclear. Note the route, local time, status and reference.'],
    ['Classify', 'Decide whether the issue is access, data, provider/payment, content/media, or a suspected security incident. Use the smallest approved tool for that class.'],
    ['Hand off', 'Send the owner a concise summary with reference, timestamps, observed status, action already taken and safe next step. Exclude passwords, cookies, full card/bank data and unnecessary customer text.'],
    ['Close', 'Reopen the record after any supported action, confirm the resulting state and record the audit event. Sign out on shared devices and remove temporary local exports.'],
  ], notes: ['A screenshot is evidence only when it is current, localized, loaded and redacted. Never use an old empty screenshot to prove that a queue is empty.'],
}, {
  title: '23. Միջադեպի արձագանք և հերթափոխի փոխանցում', lead: 'Երբ համակարգը անորոշ է, պահպանեք ապացույցը և հաջորդ գործողության շրջանակը փոքրացրեք։',
  steps: [
    ['Կայունացնել', 'Դադարեցրեք կրկնվող ուղարկումները և մի փոխեք գրառումը, քանի դեռ վճարման, ամրագրման կամ իրավունքի վիճակը պարզ չէ։ Նշեք հասցեն, տեղական ժամը, վիճակն ու համարը։'],
    ['Դասակարգել', 'Որոշեք՝ հարցը հասանելիությո՞ւն է, տվյալնե՞ր, վճարային մատակարա՞ր, բովանդակությո՞ւն/մեդիա, թե՞ անվտանգության կասկած։ Օգտագործեք տվյալ դասի փոքրագույն հաստատված գործիքը։'],
    ['Փոխանցել', 'Պատասխանատուին ուղարկեք կարճ ամփոփում՝ համարով, ժամերով, տեսած վիճակով, արված գործողությամբ ու անվտանգ հաջորդ քայլով։ Բաց թողեք գաղտնաբառը, cookie-ն, քարտի/բանկի ամբողջ տվյալը։'],
    ['Փակել', 'Աջակցվող գործողությունից հետո կրկին բացեք գրառումն ու ստուգեք նոր վիճակը, գրանցեք մատյանի իրադարձությունը։ Ընդհանուր սարքից դուրս եկեք և տեղական ժամանակավոր արտահանումները հեռացրեք։'],
  ], notes: ['Նկարը ապացույց է միայն երբ ընթացիկ, ճիշտ լեզվով, բեռնված և քողարկված է։ Հին դատարկ նկարը հերթի դատարկության ապացույց չէ։'],
});

add('release-checklist', '/admin', [], {
  title: '24. Close-to-open checklist', lead: 'Use this compact checklist at every shift change; stricter internal finance and privacy policies always win.',
  steps: [
    ['Open', 'Use your own account, confirm EN/HY locale, check Dashboard moderation and approvals, and open only assigned queues.'],
    ['Operate', 'For every change verify the record, use the supported action, provide a factual reason where requested and re-open to confirm the status.'],
    ['Escalate', 'Leave unclear payments, refunds above threshold, access changes and provider failures pending with a reference and timestamp.'],
    ['Close', 'Hand off unresolved work, remove local exports, check that no sensitive values are in notes or screenshots, and sign out.'],
  ], notes: ['Manual edition date and capture provenance are recorded in the generated manifest. Re-capture after material UI, locale or data-flow changes.'],
}, {
  title: '24. Հերթափոխը փակելու և սկսելու ստուգաթերթ', lead: 'Օգտագործեք այս կարճ ցանկը յուրաքանչյուր հերթափոխի ժամանակ։ Ֆինանսների ու գաղտնիության ավելի խիստ կանոնները գերակայում են։',
  steps: [
    ['Սկսել', 'Մուտք գործեք ձեր հաշվով, հաստատեք HY/EN լեզուն, դիտեք վահանակի մոդերացիան ու հաստատումները և բացեք միայն ձեզ հանձնարարված հերթերը։'],
    ['Գործել', 'Յուրաքանչյուր փոփոխությունից առաջ ստուգեք գրառումը, կիրառեք աջակցվող գործողությունը, անհրաժեշտության դեպքում գրեք փաստական պատճառ և կրկին բացեք՝ վիճակը հաստատելու համար։'],
    ['Փոխանցել', 'Անորոշ վճարումները, սահմանաչափից բարձր վերադարձները, իրավունքի փոփոխություններն ու մատակարարի սխալները թողեք սպասման մեջ՝ համարով ու ժամով։'],
    ['Փակել', 'Փոխանցեք չլուծված աշխատանքը, հեռացրեք տեղական արտահանումները, ստուգեք որ նշումներում/նկարներում զգայուն տվյալ չկա և դուրս եկեք հաշվից։'],
  ], notes: ['Նորից նկարեք պատկերները UI-ի, լեզվի կամ տվյալների հոսքի էական փոփոխությունից հետո։'],
});

function manual(locale) {
  const isHy = locale === 'hy';
  return {
    title: isHy ? 'ArtDance-ի կառավարման գործողությունների ուղեցույց' : 'ArtDance Admin Operations Manual',
    subtitle: isHy ? 'Ստուգված միջերեսով գործնական ուղեցույց՝ կառավարման թիմի համար։' : 'A verified, procedure-led handbook for the platform management team.',
    notice: isHy
      ? 'Այս հրատարակությունը նկարագրում է ընթացիկ հավելվածում ստուգված հասցեներն ու գործողությունները։ Նկարները ստացվել են առանձին տեղական ուսումնական բազայից։'
      : 'This edition documents routes and actions verified in the current application. Screenshots come from a separate local training database.',
    sections: sections.map(({ id, route, shots, en, hy }) => ({ id, route, shots, ...(isHy ? hy : en) })),
  };
}

module.exports = { en: manual('en'), hy: manual('hy') };
