# Apple App Store payment rules (3.1.1 / 3.1.2 / 3.1.3) for CoursePro, a web-sold subscription with a SwiftUI companion app (as of Oct 19, 2026)

Scope: CoursePro sells a $5/month or $50/year plan with a 14-day trial on the web through Paddle (Merchant of Record). Paid plans are "coming soon" and the service is free today. The native SwiftUI iOS app ships worldwide, mostly to the US. Guideline text below was fetched live from developer.apple.com on 2026-10-19. The guidelines page shows no "last updated" date. Apple's newsroom lists the most recent revision as **October 16, 2026**.

## 1. Current verbatim text of 3.1.1, 3.1.1(a), 3.1.2, 3.1.3(a)–(g), 3.1.4, and what changed

### Takeaway
3.1.1 still says: "If you want to unlock features or functionality within your app ... you must use in-app purchase." Since May 1, 2025, the US storefront is exempt from the *anti-steering* parts of the rules: links, buttons, and calls to action are allowed, with no entitlement needed. The US carve-out sits in 3.1.1(a), 3.1.3 and 3.1.3(a). The core IAP requirement in 3.1.1, and the "also available as in-app purchases" condition in 3.1.3(b), were not rewritten.

### Cited Findings
- **3.1.1 (verbatim, first bullet):** "If you want to unlock features or functionality within your app, (by way of example: subscriptions, in-game currencies, game levels, access to premium content, or unlocking a full version), you must use in-app purchase. Apps may not use their own mechanisms to unlock content or functionality, such as license keys, augmented reality markers, QR codes, cryptocurrencies and cryptocurrency wallets, etc." Another bullet: "you should make sure you have a restore mechanism for any restorable in-app purchases." A trial bullet for **non-subscription** apps describes a $0 Non-Consumable "XX-day Trial". It says that before the trial starts the app "must clearly identify its duration, the content or services that will no longer be accessible when the trial ends, and any downstream charges." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **3.1.1(a) Link to Other Purchase Methods (verbatim):** "Developers may apply for entitlements to provide a link in their app to a permitted destination in order to purchase digital content or services. These entitlements are not required for developers to include buttons, external links, or other calls to action in their United States storefront apps." Sub-bullet: "StoreKit External Purchase Link Entitlements: apps on the App Store in specific regions may offer in-app purchases and also use a StoreKit External Purchase Link Entitlement or, where permitted, a Music Streaming Services Entitlement to include a link to a permitted destination that informs users of other ways to purchase digital goods or services. Approved destinations may vary by region. ... The entitlements are limited to use only in specific storefronts of the App Store, and only on certain platforms in each of those storefronts. **In all other storefronts, except for the United States storefront, where this prohibition does not apply, apps and their metadata may not include buttons, external links, or other calls to action that direct customers to purchasing mechanisms other than in-app purchase.**" It also says: "If your app engages in misleading marketing practices, scams, or fraud in relation to the entitlement, your app will be removed..." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **3.1.2 Subscriptions (verbatim, key parts):** "Apps may offer auto-renewable in-app purchase subscriptions, regardless of category." Under 3.1.2(a): "you must provide ongoing value to the customer, and the subscription period must last at least seven days and be available across all of the user's devices." It lists SaaS and cloud support as appropriate uses. "Auto-renewable subscription apps may offer a free trial period to customers by providing the relevant information set forth in App Store Connect." On bait-and-switch: apps that "attempt to trick users into purchasing a subscription under false pretenses or engage in bait-and-switch and scam practices ... will be removed." 3.1.2(b): "Users should have a seamless upgrade/downgrade experience and should not be able to inadvertently subscribe to multiple variations of the same thing." 3.1.2(c): "Before asking a customer to subscribe, you should clearly describe what the user will get for the price ... Ensure you clearly communicate the requirements described in Schedule 2 of the Apple Developer Program License Agreement." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **3.1.3 intro (verbatim):** "The following apps may use purchase methods other than in-app purchase. Apps in this section cannot, within the app, encourage users to use a purchasing method other than in-app purchase, except for apps on the United States storefront and as set forth in 3.1.1(a) and 3.1.3(a). Developers can send communications outside of the app to their user base about purchasing methods other than in-app purchase." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **3.1.3(a) Reader apps (verbatim):** "Apps may allow a user to access previously purchased content or content subscriptions (specifically: magazines, newspapers, books, audio, music, and video). Reader apps may offer account creation for free tiers, and account management functionality for existing customers. Reader app developers may apply for the External Link Account Entitlement ... This entitlement is not required for developers to include buttons, external links, or other calls to action in their United States storefront apps." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **3.1.3(b) Multiplatform Services (verbatim):** "Apps that operate across multiple platforms may allow users to access content, subscriptions, or features they have acquired in your app on other platforms or your web site, including consumable items in multi-platform games, **provided those items are also available as in-app purchases within the app.**" — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **3.1.3(c) Enterprise (verbatim):** "If your app is only sold directly by you to organizations or groups for their employees or students (for example professional databases and classroom management tools), you may allow enterprise users to access previously-purchased content or subscriptions. Consumer, single user, or family sales must use in-app purchase." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **3.1.3(d) Person-to-Person (verbatim):** applies to "real-time person-to-person services between two individuals (for example tutoring students, medical consultations ...)". "One-to-few and one-to-many real-time services must use in-app purchase." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **3.1.3(e):** goods and services consumed outside the app must use non-IAP payment. **3.1.3(g):** covers advertising management apps. — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **3.1.3(f) Free Stand-alone Apps (verbatim):** "Free apps acting as a stand-alone companion to a paid web-based tool for VoIP, Cloud Storage, Email Services, or Web Hosting do not need to use in-app purchase, provided there is no purchasing inside the app, or calls to action for purchase outside of the app." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **3.1.4 Hardware-Specific Content:** features that depend on specific hardware may unlock without IAP. Features that work with an optional physical product may unlock without IAP "provided that an in-app purchase option is available as well." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **Change, May 1, 2025:** "The App Review Guidelines have been updated for compliance with a United States court decision regarding buttons, external links, and other calls to action in apps. These changes affect apps distributed on the United States storefront of the App Store, and are reflected in updates to Guidelines 3.1.1, 3.1.1(a), 3.1.3, and 3.1.3(a)." — [Apple Developer News, May 1 2025](https://developer.apple.com/news/?id=9txfddzf)
- **Change, Oct 16, 2026 (latest revision):** in 3.1.1(a), the separate Music Streaming Services Entitlements bullet was folded into the StoreKit External Purchase Link Entitlements bullet. The revision also clarifies that links go to a "permitted destination." The same revision tightened 2.5.19, which now bars misrepresenting an app during review and adding features after approval, and covers "bait-and-switch apps". — [Apple Developer News](https://developer.apple.com/news/)
- Other 2025–26 guideline revisions found (Nov 13 2025: 4.7 mini apps, 3.2.2(ix) loans; Feb 6 2026: 1.2 chat apps) do not touch 3.1.x subscription or web-purchase rules. — [Apple Developer News](https://developer.apple.com/news/)

### Inferences
- The guideline text has **no** clause saying a US-storefront app may skip IAP entirely. The US carve-outs only lift the bans on *encouraging, linking or calls to action*. Read literally, 3.1.1 ("must use in-app purchase" to unlock features) and the 3.1.3(b) condition ("provided those items are also available as in-app purchases") still apply in the US.
- CoursePro does not fit any IAP-exempt category. It is not a reader app, because its content is not magazines, newspapers, books, audio, music, or video. It is not 3.1.3(f), whose list is closed to VoIP, Cloud Storage, Email, and Web Hosting. It is not 3.1.3(d), since it is not live 1:1 tutoring. 3.1.3(c) would apply only if schools bought CoursePro for their students; individual student sales are "consumer, single user" and must use IAP. That leaves **3.1.3(b)**, which needs IAP to be offered as well.
- The new 2.5.19 wording means the iOS app's paid gating must be in the binary App Review sees. Turning on paid gating server-side after approval is risky. This matters for a "coming soon" launch that will later flip a server flag.

### Gaps
- I could not see the exact diff of the Oct 16, 2026 revision beyond Apple's summary.
- I found no Apple statement on whether a US-only, web-purchase-only build with no IAP, for a non-reader app, passes 3.1.1. See section 2 Gaps.

## 2. Epic v. Apple (April 30, 2025 injunction), Apple's May 2025 US changes, the appeal, and the commission question

### Takeaway
On the **US storefront**, apps can show buttons and links to web checkout with no entitlement. As of mid-2026 Apple charges **0% commission** on those purchases under court order. The Ninth Circuit (Dec 11, 2025) upheld contempt but said Apple may eventually charge a cost-based commission. It sent the rate back to the district court, where Apple proposed 15%/10%/5% on Aug 13, 2026; that proposal is not approved. The Supreme Court granted cert on June 30, 2026 and has not ruled. Both the 0% rate and the US link freedom could change in 2027.

### Cited Findings
- On May 1, 2025, Apple updated 3.1.1, 3.1.1(a), 3.1.3 and 3.1.3(a) for US-storefront apps "for compliance with a United States court decision regarding buttons, external links, and other calls to action." — [Apple Developer News](https://developer.apple.com/news/?id=9txfddzf)
- The current guideline says entitlements "are not required for developers to include buttons, external links, or other calls to action in their United States storefront apps." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Ninth Circuit, **December 11, 2025**: it affirmed the civil contempt finding and largely upheld the remedies. It **vacated the total commission ban** and remanded so the district court can enter a purgeable civil sanction or a tailored modification. Apple may charge a commission on linked-out purchases limited to costs "genuinely and reasonably necessary" to coordinate external links, "and no more." It also called a ban on any commission "more like a punitive criminal contempt sanction." — [Perkins Coie: Epic v. Apple, the Ninth Circuit weighs in](https://perkinscoie.com/insights/update/epic-v-apple-ninth-circuit-weighs); [Fenwick](https://www.fenwick.com/insights/publications/ninth-circuit-largely-upholds-ruling-in-epic-v-apple); [Cravath](https://www.cravath.com/news-insights/epic-games-ninth-circuit-win-affirming-civil-contempt-finding.html). I saw these through search summaries; Cravath's page would not load.
- The Ninth Circuit also reportedly **upheld the bar on Apple limiting the design or placement of steering links**. — search summary of [Fenwick](https://www.fenwick.com/insights/publications/ninth-circuit-largely-upholds-ruling-in-epic-v-apple) / [Ashurst Perkins Coie](https://www.ashurstperkinscoie.com/en/insights/epic-v-apple-the-ninth-circuit-weighs-in/). Not verified against the opinion.
- En banc rehearing was denied on March 30, 2026. On April 29, 2026 the Ninth Circuit reportedly ordered Apple to keep allowing external links at zero commission while the stay dispute continued. — search summaries citing [IPWatchdog](https://ipwatchdog.com/2026/06/30/high-court-grants-cert-in-apples-challenge-to-ninth-circuit-contempt-ruling-in-app-store-dispute/). The page would not load; secondary.
- The Supreme Court (circuit justice) **denied Apple's application to stay the Ninth Circuit mandate** around May 6, 2026. — [Digital Policy Alert](https://digitalpolicyalert.org/event/39722-circuit-justice-denied-apples-application-to-stay-ninth-circuit-mandate-in-epic-games-v-apple); [Aaj TV / wire report](https://english.aaj.tv/news/amp/330458434); [Epic's SCOTUS response (PDF)](https://www.courthousenews.com/wp-content/uploads/2026/05/epic-response-scotus-emergency-docket-apple-app-store.pdf)
- Apple petitioned for certiorari (filed around May 22, 2026). **Cert was granted June 30, 2026** (Apple Inc. v. Epic Games, No. 25-1311). The questions presented reportedly cover whether a single-plaintiff injunction can bind the whole developer ecosystem, and whether contempt can rest on the order's "spirit." Apple's merits brief was filed Sept 14, 2026, asking the Court to vacate the contempt finding. — [Oyez No. 25-1311](https://www.oyez.org/cases/2026/25-1311); [IPWatchdog](https://ipwatchdog.com/2026/06/30/high-court-grants-cert-in-apples-challenge-to-ninth-circuit-contempt-ruling-in-app-store-dispute/); [MacDailyNews, Sept 15 2026](https://macdailynews.com/2026/09/15/apple-asks-u-s-supreme-court-to-vacate-app-store-contempt-finding-arguing-it-never-violated-the-orders-text/); [Mealey's](https://www.mealeys.com/mealeys/amp/articles/2525726); [Sigma Law](https://sigmalawgroup.com/blog/2026-05-26-apple-epic-cert/)
- **Remand commission proposal (Aug 13, 2026):** Apple asked the N.D. Cal. court (Judge Yvonne Gonzalez Rogers) for **15%** on linked-out purchases by standard apps. It asked for **10%** for Video/News/Mini Apps partner programs and subscription renewals, and **5%** for Small Business Program apps. Apple also asked to pause the rate proceedings until the Supreme Court rules. The rates are **not approved**. — [iClarified](https://www.iclarified.com/101778/apple-seeks-court-approval-for-15-commission-on-external-app-purchases); [Mac Observer](https://www.macobserver.com/news/apple-epic-link-out-commission-proposal-15-percent/); [MobileMarketingReads](https://www.mobilemarketingreads.com/apple-proposes-up-to-15-commission-on-us-purchases-made-through-app-store-link-outs/)
- Secondary sources say US developers currently pay 0% on link-outs while a replacement rate is settled, and that oral argument is unlikely before 2027. — [Beancount accounting guide, July 2026](https://beancount.io/blog/2026/07/11/apple-app-store-external-purchase-links-accounting-guide); [TechTimes, Sept 15 2026](https://www.techtimes.com/articles/327527/20260915/app-store-commission-limbo-enters-new-phase-apples-epic-merits-brief-opens-scotus-fight.htm). Not primary.
- Paddle published a 2025 changelog entry and guide for launching hosted checkouts from iOS apps (link-out). Hosted checkout reportedly needs extra approval from Paddle on live accounts. — [Paddle changelog: mobile hosted checkouts for iOS apps](https://developer.paddle.com/changelog/2025/add-mobile-hosted-checkouts-ios-apps); [Paddle: launch iOS app checkout](https://developer.paddle.com/build/launch-ios-app-checkout). Page did not load; details come from the search snippet.
- RevenueCat's "Web Purchase Button" shows US iOS users a web checkout option while other users stay on native IAP. — [RevenueCat blog: web paywall buttons](https://www.revenuecat.com/blog/growth/introducing-web-paywall-buttons.md); [RevenueCat: can you use Stripe for IAP](https://www.revenuecat.com/blog/engineering/can-you-use-stripe-for-in-app-purchases/). Search summary only; page did not load.

### Inferences
- In practice, today's US option is: **US storefront only**, show a "Subscribe on the web" button that opens Paddle checkout in Safari (not a web view). There is no entitlement, no Apple disclosure sheet, and no commission for now. Gate it on `Storefront.current?.countryCode == "USA"` (StoreKit 2) so non-US builds show nothing.
- Design for reversal. A Supreme Court win for Apple in 2026–27 could restore anti-steering in the US or allow a commission (Apple proposed 15%). Keep the link behind a server flag, and keep IAP as the baseline so the app stays compliant whatever happens.
- Apple's legal leeway to restrict link *design or placement* was cut. That limits what Apple can demand about the shape of the link. It does not settle whether App Review will accept a non-reader app with *no* IAP at all.

### Gaps
- I could not open the Ninth Circuit opinion, the district-court docket, or IPWatchdog/Cravath directly. Dates and holdings come from consistent secondary summaries across several firms and outlets.
- I found no authoritative source saying whether US-storefront App Review accepts a **non-reader** app that unlocks paid features only through web purchase, with no IAP. Big-name US examples of link-only apps are mostly reader apps (music, books), which have their own exemption. Treat "US link-only, no IAP" as **unverified and higher-risk**.
- No primary confirmation that the 0% rate still applies as of Oct 2026. Secondary sources say it does pending remand.

## 3. Outside the US: external purchase link entitlements (EU DMA, reader apps, South Korea, Japan), and what happens if a worldwide app shows web links

### Takeaway
Outside the US, a worldwide app may not have buttons, links or calls to action toward web purchase in the app **or its metadata**, unless it holds a region-specific entitlement. Those entitlements generally require IAP alongside, a system disclosure sheet, and a 10–15%+ commission on web sales. For CoursePro, every non-US storefront must be free of any purchase steering, unless IAP is added and the developer chooses to take on entitlement programs.

### Cited Findings
- The rule is that "In all other storefronts, except for the United States storefront ... apps and their metadata may not include buttons, external links, or other calls to action that direct customers to purchasing mechanisms other than in-app purchase." — [App Review Guidelines 3.1.1(a)](https://developer.apple.com/app-store/review/guidelines/)
- **EU (effective Oct 1, 2026, single set of business terms under DPLA Attachment 14):**
  - Apps under 3.1.3(b) Multiplatform Services "must offer Apple In-App Purchase and/or in-app alternative payment processing as an option."
  - Fees: IAP 26% standard / 15% reduced; in-app alternative processing 20%/10%; out-of-app offers via actionable link 15%/10%. The link commission applies to sales within 7 days of a link tap.
  - The app must call `ExternalPurchaseCustomLink.showNotice(type:)` (a system sheet) on each tap. The product page shows an "External Purchases" notation.
  - Entitlement key: `com.apple.developer.storekit.custom-purchase-link.allowed-regions`, which requires iOS 26.2+.
  - Monthly reporting is due within 15 days of month end. Under-13 users cannot get out-of-app offers.

  — [Apple: alternative payment options in the EU](https://developer.apple.com/support/apps-using-alternative-payment-providers-in-the-eu/); [Apple Developer News, Aug 18 2026](https://developer.apple.com/news/)
- **Japan (MSCA, announced Dec 17, 2025; iOS 26.2):** apps may use alternative in-app payment or link out to a website, but these options "will always be presented alongside Apple In-App Purchase", and an in-app sheet tells users they are not transacting with Apple. Fees: IAP 21% base + 5% processing; alternative in-app payment 21%; web link 15% (10% for program participants). Non-Kids apps cannot link to web transactions for users under 13. Developers had to accept the updated DPLA by March 17, 2026. — [9to5Mac Dec 17 2025](https://9to5mac.com/2025/12/17/apple-announces-sweeping-app-store-and-iphone-changes-in-japan); [MacRumors](https://macrumors.com/2025/12/17/japan-app-store-feature-updates); [Michael Tsai summary of Apple's notice](https://mjtsai.com/blog/2025/12/18/japan-app-marketplaces-external-payments-new-fee-structure); [Apple Developer News](https://developer.apple.com/news/)
- **Brazil (June 18, 2026; iOS 26.5, CADE agreement):** alternative payments and out-of-app offers are allowed under DPLA Attachment 12. — [Apple Developer News](https://developer.apple.com/news/)
- **Reader app External Link Account Entitlement:**
  - Eligible only if the app's *primary* function is magazines, newspapers, books, audio, music, or video.
  - The app must "Not offer in-app purchases on iOS, iPadOS, or tvOS while using the External Link Account Entitlement."
  - Available in any storefront.
  - The link must open in the default browser (not a web view), must "Not include pricing language," may be displayed once per page, needs a modal sheet before each tap, and URLs must be set in `SKExternalLinkAccount` in Info.plist.
  - "Reader apps may link out to an external website for account creation and management only from the app" (not metadata).

  — [Apple: Reader apps / External Link Account Entitlement](https://developer.apple.com/support/reader-apps/)
- **South Korea:** I found no 2026 source in this session. Apple's newsroom items for Korea in 2026 concern age ratings and Sign in with Apple, not payment changes. — [Apple Developer News](https://developer.apple.com/news/)

### Inferences
- CoursePro is not eligible for the reader-app entitlement, because study tooling for Canvas courses is not a listed content type.
- If a worldwide build shows a "Subscribe on our website" button to non-US users, that breaks 3.1.1(a) / 3.1.3 on those storefronts. The likely outcome is a 3.1.1 rejection, or removal later if it is spotted after approval. Storefront detection must cover App Store metadata as well, because metadata is global per localization, not per storefront. For example, a US-English description that says "subscribe at coursepro.app" can be seen in other English-speaking storefronts. Keep metadata free of web-purchase calls to action unless the app is US-only.
- Region entitlements (EU, Japan, Brazil) require IAP alongside or carry fees (15%+), and add reporting overhead. For a $5/month product that is mainly US, they are probably not worth pursuing at launch.

### Gaps
- South Korea's current entitlement terms (historically an in-app alternative-payment entitlement at a 26% commission, not a link-out) were not verified for 2026.
- I did not confirm whether US metadata (description, promo text) may mention web pricing when the app is sold in many storefronts. The guideline exempts the "United States storefront", but a single English (U.S.) localization is shown in several countries.

## 4. 3.1.3(b): can web subscribers use their subscription in the app without IAP being offered?

### Takeaway
No. 3.1.3(b) lets an app **honor** web-bought subscriptions only "provided those items are also available as in-app purchases within the app." Recent forum reports (Dec 2025, May 2026) show App Review rejecting companion apps that unlock paid features for web subscribers without IAP. The rejection text is "Your app accesses digital content purchased outside the app, and that content is not available through in-app purchase."

### Cited Findings
- 3.1.3(b) is quoted verbatim in section 1. The condition is "provided those items are also available as in-app purchases within the app." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- The EU terms restate the same condition: 3.1.3(b) apps "must offer Apple In-App Purchase and/or in-app alternative payment processing as an option." — [Apple EU alternative payments page](https://developer.apple.com/support/apps-using-alternative-payment-providers-in-the-eu/)
- **Rejection, Dec 2025 (Apple forums):**
  - The app is a B2B coaching SaaS companion with existing accounts only. It has no IAP, no pricing, no upsell, and no sign-up, and is unusable without a paid web account.
  - It was rejected with: "Your app accesses digital content purchased outside the app, and that content is not available through in-app purchase."
  - The developer cited 3.1.3(b) without success. No Apple reply, outcome unknown.

  — [Apple Developer Forums thread 811018](https://developer.apple.com/forums/thread/811018)
- **Rejection, May 2026 (Apple forums):**
  - The app is a cross-platform productivity SaaS. Its iOS app is free, with no IAP, pricing, or paywalls.
  - A "tier-aware" build, where web subscribers saw extra features, was rejected. App Review's position was that 3.1.3(b) requires items to be "also available as in-app purchases," so paid features visible on iOS without IAP fall under 3.1.1.
  - The developer then shipped a **"tier-identical"** build, where every iOS user gets the same features regardless of web plan, and says that **resolved** the review. The cost was a feature gap and support tickets.

  — [Apple Developer Forums thread 825551](https://developer.apple.com/forums/thread/825551)
- An older thread contrasting 3.1.1 and 3.1.3(b) exists. Other developer reports: one white-label fitness app was still rejected after adding a free in-app sign-up. Another was approved after adding a free account tier in-app. — [Apple Developer Forums 740710](https://developer.apple.com/forums/thread/740710); search summary of forum threads
- A wrapper/WebView app was told to remove "account registration links, and any other fully qualified links to the site that could indirectly provide access to external purchase mechanisms." — [Apple Developer Forums 684850](https://developer.apple.com/forums/thread/684850)

### Inferences
- "May allow users to access content acquired elsewhere" lets CoursePro **honor** a Paddle subscription on iOS. It applies **only if** the same plan is also sold through IAP in the app, so it permits web purchases *in addition to* IAP, not instead of it. Without IAP, unlocking paid features for web subscribers on iOS is the textbook 3.1.1 rejection.
- The proven no-IAP pattern is **tier-identical**: the iOS app gives every signed-in user the same feature set and never shows paid gating, prices, or upgrade prompts.

### Gaps
- No official Apple statement on whether a US-storefront-only build may use a web link-out *instead of* IAP for a non-reader app. Forum and blog reports conflict, and the guideline text still says "must use in-app purchase."

## 5. Free now, paid "coming soon": what the app may say; paywalls without IAP

### Takeaway
While everything is free, the safest submission has **no** pricing, "Pro," "coming soon," or "subscribe on our website" text in the app or metadata, at least outside the US. It should also have no lock screens. A paywall that blocks the app for unpaid users with no IAP is the classic 3.1.1 rejection worldwide. Gating paid features after approval risks a 2.5.19 or bait-and-switch violation.

### Cited Findings
- Outside the US, "apps and their metadata may not include buttons, external links, or other calls to action that direct customers to purchasing mechanisms other than in-app purchase." — [App Review Guidelines 3.1.1(a)](https://developer.apple.com/app-store/review/guidelines/)
- Even reader apps that are allowed to link must have links that "Not include pricing language." — [Apple reader apps page](https://developer.apple.com/support/reader-apps/)
- 3.1.3(f) free stand-alone companions avoid IAP only if "there is no purchasing inside the app, or calls to action for purchase outside of the app." The category list does not include study tools, but it shows the standard Apple applies. — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- App Review has rejected companion apps that are "unusable without an existing paid account," even with no purchase UI. — [Forums 811018](https://developer.apple.com/forums/thread/811018)
- A secondary analysis says companion apps for web subscriptions get flagged under 3.1.1 "even without a buy button." — [ptkd.com: Apple rejection 3.1.1 IAP links](https://ptkd.com/journal/apple-rejection-3-1-1-in-app-purchase-links)
- 2.5.19 (Oct 16, 2026) prohibits misrepresenting an app during review and adding features after approval. 3.1.2(a) removes apps doing "bait-and-switch." — [Apple Developer News](https://developer.apple.com/news/); [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 3.1.2(a): "If you are changing your existing app to a subscription-based business model, you should not take away the primary functionality existing users have already paid for." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

### Inferences
- **Today (free):** ship the iOS app fully functional for any signed-in user. In-app sign-up is fine, and so is sign-in for users who first signed up on the web. Do not show "Pro" badges, locked features, prices ($5/$50), "14-day trial," or "coming soon" upsells. Keep the description free of web-pricing calls to action. Mentioning "free" is fine.
- **When paid launches, either:**
  - **(A) Tier-identical iOS (no IAP):** iOS keeps a feature set every user gets. Web subscribers get nothing extra on iOS. Lowest risk, but this has to be real: iOS cannot unlock Pro features for Paddle subscribers.
  - **(B) Add IAP auto-renewable subscriptions:** at $4.99/month and $49.99/year (nearest price points) with a 14-day free trial as an introductory offer. Honor Paddle subscriptions through the shared account (3.1.3(b)). On the **US storefront only**, optionally add a "Subscribe on the web (cheaper)" button to Paddle checkout opening in Safari. Apple currently takes no commission on that, but this could change.
  - **(C) US-only build with web link-out and no IAP:** possibly allowed post-May 2025, but unverified for non-reader apps and exposed to the pending Supreme Court case. Not recommended for a worldwide app.
- Apple's Small Business Program rate (15%) applies to IAP for developers under $1M in proceeds. That figure is not verified in this session.
- Add a Review Notes entry explaining: free service, no paid features in this build, how web accounts work, and a demo account. This pre-empts a "content purchased outside the app" flag.

### Gaps
- No Apple source says outright whether the word "free" or a neutral "Plans coming later" line is a problem. Avoiding any plan or pricing language is the conservative reading.
- Small Business Program rates were not re-verified for 2026.

## 6. If IAP subscriptions are added: the 3.1.2 and Schedule 2 checklist

### Takeaway
The sign-up screen must show the subscription name, duration, and what it includes. It must show the full renewal price, localized, as the most prominent pricing element. Free-trial screens must show the trial length and the price billed after the trial. The app needs a restore or sign-in option. Terms of Use (EULA) and Privacy Policy links must appear both in the app and in App Store metadata.

### Cited Findings
- Apple lists what "must be included in your subscription's sign-up screen":
  - "Subscription name and duration, and the content or services provided during the subscription period"
  - "Full renewal price, shown clearly and prominently, and localized in available currencies"
  - "A way for current subscribers to sign in or restore purchases"

  — [Apple: Auto-renewable subscriptions](https://developer.apple.com/app-store/subscriptions/)
- "In the purchase flow, the amount that will be billed must be the most prominent pricing element in the layout." A per-month breakdown of an annual plan must be "displayed in a subordinate position and size to the annual price." — [Apple: Auto-renewable subscriptions](https://developer.apple.com/app-store/subscriptions/)
- Free trials: "clearly indicate how long the free trial lasts and the price billed once the free trial is over." — [Apple: Auto-renewable subscriptions](https://developer.apple.com/app-store/subscriptions/)
- "your app and App Store metadata must include links to your Terms of Use and Privacy Policy." — [Apple: Auto-renewable subscriptions](https://developer.apple.com/app-store/subscriptions/)
- 3.1.2(c) requires describing "what the user will get for the price" and communicating "the requirements described in Schedule 2." 3.1.2(a) requires subscriptions to be "available across all of the user's devices" and at least 7 days long. 3.1.2(b) requires that users not "inadvertently subscribe to multiple variations." 3.1.1 requires "a restore mechanism." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 3.1.2(a): "Auto-renewable subscription apps may offer a free trial period ... by providing the relevant information set forth in App Store Connect." This means the 14-day trial is set up as an introductory offer on the IAP. — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

### Inferences
- For CoursePro, put monthly and yearly in **one subscription group** to satisfy 3.1.2(b) (no double-subscribing). Use StoreKit 2 `SubscriptionStoreView`, which renders compliant disclosures plus restore and policy links.
- Add the Terms of Use URL (Apple's standard EULA or your own) and the Privacy Policy URL in App Store Connect. Linking the standard EULA in the description is common practice.
- Avoid double-charging. If a user already has an active Paddle plan, hide the IAP paywall for that account; 3.1.2(b) favors this. Make the server the source of truth for entitlements across Paddle and StoreKit, for example via App Store Server Notifications.
- Typical first-try rejection causes: no restore button, missing EULA link in metadata, trial price after the trial not shown, or the per-month equivalent shown larger than the annual charge.

### Gaps
- I did not fetch Schedule 2's verbatim disclosure clauses (the DPLA is a large PDF), or the Human Interface Guidelines subscription page.

## 7. Real 2025–2026 rejection reports (web subscriptions, Paddle/Stripe, reader claims, US change)

### Takeaway
The pattern in reports is consistent. Companion apps that unlock web-bought features without IAP get 3.1.1 rejections, and claiming 3.1.3(b) or "reader" status does not help. Tier-identical builds pass. US Stripe web-checkout attempts have hit unclear rejections; advice is to open checkout in Safari, not a web view. These are anecdotal.

### Cited Findings
- Dec 2025: a B2B SaaS companion was rejected under 3.1.1 with "Your app accesses digital content purchased outside the app, and that content is not available through in-app purchase"; its 3.1.3(b) argument got no traction. — [Forums 811018](https://developer.apple.com/forums/thread/811018)
- May 2026: a tier-aware productivity companion was rejected and a tier-identical build resolved it. A commenter suggested booking an App Review "Meet with Apple" consultation. — [Forums 825551](https://developer.apple.com/forums/thread/825551)
- A US-storefront app was reportedly rejected repeatedly after adding Stripe web checkout, with unclear feedback from App Review. A commenter suggested sending users to an external browser instead of an in-app web view. Anecdotal Reddit post. — [r/iOSProgramming thread (redlib mirror)](https://redlib.hackliberty.org/r/iOSProgramming/s/IQSy3afCAH)
- A WebView wrapper was told to remove account registration links and other links that could "indirectly provide access to external purchase mechanisms." — [Forums 684850](https://developer.apple.com/forums/thread/684850)
- Oct 2024 (RevenueCat community): a false-positive "subscription can be purchased using payment mechanisms other than IAP" rejection was fixed by resubmitting with a clear reviewer note. Apple had missed approving the IAP products. — [RevenueCat Community 5231](https://community.revenuecat.com/sdks-51/apple-app-rejection-the-subscription-can-be-purchased-in-the-app-using-payment-mechanisms-other-than-in-app-purchase-5231)
- Reader eligibility requires that content be the app's *primary* function: "Apps that let people access digital content such as music or video, but not as the primary functionality, are not considered reader apps." — [Apple reader apps page](https://developer.apple.com/support/reader-apps/)

### Inferences
- Claiming "reader app" status for CoursePro would very likely fail.
- If going route (B) with a US link, submit the IAP products *with* the binary. Explain the US-only link in Review Notes and state that it opens Safari and appears only on the US storefront. That pre-empts a non-US reviewer seeing the link.

### Gaps
- I found no specific Paddle-related rejection reports, and could not load Paddle's or RevenueCat's own pages to check their 2026 guidance.
- No large, systematic data on US link-out approval rates. Everything here is anecdotal.
