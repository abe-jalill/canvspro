# App Store privacy, notification and age-rating requirements for a first iOS submission (CoursePro, as of October 2026)

Context assumed: CoursePro is a native SwiftUI app. It reads a student's Canvas LMS data (courses, assignments, grades, announcements) using a personal access token (PAT) that the student pastes in. The token is stored on the developer's Supabase backend. The app uses local notifications, APNs push, widgets and Live Activities, and offers an optional AI-assistant (MCP) connection on the website. New accounts are limited to ages 18+.

Research date: 2026-10-19. Apple's guideline page shows no "last updated" date, so the verbatim quotes below reflect the live page as fetched on this date.

## 1. Guidelines 5.1.1 and 5.1.2: privacy policy, consent, data minimization, login gating, sensitive data and third-party credentials

### Takeaway
The verbatim rules that matter most are:
- a privacy-policy link both in App Store Connect and inside the app;
- consent and an easy way to withdraw it;
- data minimization;
- no login for features that don't need an account;
- in-app account deletion if the app creates accounts;
- explicit disclosure and permission before sharing personal data "with third-party AI" (added November 2025);
- never requiring push or other system features to use the app.

The ban on storing tokens off the device in 5.1.1(v) is written only for **social-network** credentials. Canvas is not a social network, so the text does not cover a Canvas PAT stored on a server. A reviewer could still apply it by analogy, so the token flow needs to be disclosed clearly.

### Cited Findings
**5.1.1 verbatim (live guidelines page):**
- 5.1.1(i): "All apps must include a link to their privacy policy in the App Store Connect metadata field and within the app in an easily accessible manner. The privacy policy must clearly and explicitly: Identify what data, if any, the app/service collects, how it collects that data, and all uses of that data. Confirm that any third party with whom an app shares user data (in compliance with these Guidelines)—such as analytics tools, advertising networks and third-party SDKs, as well as any parent, subsidiary or other related entities that will have access to user data—will provide the same or equal protection of user data as stated in the app's privacy policy and required by these Guidelines. Explain its data retention/deletion policies and describe how a user can revoke consent and/or request deletion of the user's data." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 5.1.1(ii): "Apps that collect user or usage data must secure user consent for the collection, even if such data is considered to be anonymous at the time of or immediately following collection. Paid functionality must not be dependent on or require a user to grant access to this data. Apps must also provide the customer with an easily accessible and understandable way to withdraw consent. Ensure your purpose strings clearly and completely describe your use of the data. ... Apps that collect data for a legitimate interest without consent by relying on the terms of the European Union's General Data Protection Regulation ("GDPR") or similar statute must comply with all terms of that law." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 5.1.1(iii) Data Minimization: "Apps should only request access to data relevant to the core functionality of the app and should only collect and use data that is required to accomplish the relevant task. Where possible, use the out-of-process picker or a share sheet rather than requesting full access to protected resources like Photos or Contacts." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 5.1.1(iv) Access: "Apps must respect the user's permission settings and not attempt to manipulate, trick, or force people to consent to unnecessary data access. ... Where possible, provide alternative solutions for users who don't grant consent." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 5.1.1(v) Account Sign-In: "If your app doesn't include significant account-based features, let people use it without a login. If your app supports account creation, you must also offer account deletion within the app. Apps may not require users to enter personal information to function, except when directly relevant to the core functionality of the app or required by law. If your core app functionality is not related to a specific social network (such as Facebook, WeChat, Weibo, X, etc.), you must provide access without a login or via another mechanism. ... The app must also include a mechanism to revoke social network credentials and disable data access between the app and social network from within the app. An app may not store credentials or tokens to social networks off of the device and may only use such credentials or tokens to directly connect to the social network from the app itself while the app is in use." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 5.1.1(vi): "Developers that use their apps to surreptitiously discover passwords or other private data will be removed from the Apple Developer Program." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 5.1.1(viii): "Apps that compile personal information from any source that is not directly from the user or without the user's explicit consent, even public databases, are not permitted on the App Store or alternative distribution." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 5.1.1(ix): "Apps that provide services in highly regulated fields (such as banking and financial services, healthcare, gambling, legal cannabis use, air travel and crypto exchanges) or that require sensitive user information should be submitted by a legal entity that provides the services, and not by an individual developer." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 5.1.1(x): "Apps may request basic contact information (such as name and email address) so long as the request is optional for the user, features and services are not conditional on providing the information, and it complies with all other provisions of these guidelines, including limitations on collecting information from kids." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

**5.1.2 verbatim:**
- 5.1.2(i): "Unless otherwise permitted by law, you may not use, transmit, or share someone's personal data without first obtaining their permission. You must provide access to information about how and where the data will be used. You must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so. Data collected from apps may only be shared with third parties to improve the app or serve advertising (in compliance with the Apple Developer Program License Agreement). You must receive explicit permission from users via the App Tracking Transparency APIs to track their activity. ... Your app may not require users to enable system functionalities (such as push notifications, location services, tracking) in order to access functionality, content, use the app, or receive monetary or other compensation..." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 5.1.2(ii): "Data collected for one purpose may not be repurposed without further consent unless otherwise explicitly permitted by law." 5.1.2(iii): "Apps should not attempt to surreptitiously build a user profile based on collected data..." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 5.1.2(vi) names ClassKit data among data that "may not be used for marketing, advertising or use-based data mining, including by third parties". This applies only if the app uses Apple's ClassKit API, which CoursePro does not appear to. — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- The "including with third-party AI" wording in 5.1.2(i) was added in Apple's guidelines update of **November 13, 2025**. The previous text required consent for sharing but did not mention AI. — [Radom](https://www.radom.com/insights/apple-updates-app-review-guidelines-to-strengthen-privacy-protections-against-third-party-ai-data-sharing); [iGeeksBlog](https://www.igeeksblog.com/apple-app-store-ai-data-disclosure-guidelines). These are secondary sources; the wording itself is confirmed on Apple's live page above.
- Some blogs claim that reviewers now expect an in-app consent screen for AI data sharing and that a privacy-policy paragraph is not enough ([Product Hunt post](https://www.producthunt.com/p/murror/your-we-use-ai-line-is-now-a-consent-screen-apple-s-rule-5-1-2-i-has-been-live-since-november); [stora.sh guide](https://stora.sh/blog/2026-05-06-apple-ai-consent-rule-5-1-2-i-implementation-guide)). These are unverified practitioner claims.

**Related guidelines:**
- 2.1(a): "include demo account info (and turn on your back-end service!) if your app includes a login. If you are unable to provide a demo account due to legal or security obligations, you may include a built-in demo mode in lieu of a demo account with prior approval by Apple." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 4.8 Login Services: no alternative login is required if "Your app exclusively uses your company's own account setup and sign-in systems" or if "Your app is an education, enterprise, or business app that requires the user to sign in with an existing education or enterprise account". It is also not required if "Your app is a client for a specific third-party service and users are required to sign in to their mail, social media, or other third-party account directly to access their content." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 2.5.16: "Widgets, extensions, and notifications should be related to the content and functionality of your app." 4.5.3: "Do not use Apple Services to spam, phish, or send unsolicited messages to customers, including Game Center, Push Notifications, Live Activities, etc." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 2.5.19: "Don't include any hidden, dormant, or undocumented features in your app..." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

**Account deletion (Apple support page):**
- "Offer to delete the entire account record, along with associated personal data. ... only offering to temporarily deactivate or disable an account is insufficient." — [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- "Make the account deletion option easy to find in your app." Web completion is allowed: "If people need to visit a website to finish deleting their account, include a link directly to the page on your website where they can complete the process." — [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- "Apps not operating in highly regulated industries should not require people to make a phone call, send an email, use a chat support flow, or go through other support flows." — [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- If the app supports Sign in with Apple, it "should use the Sign in with Apple REST API to revoke user tokens." — [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)

**Purpose strings and when to ask for permission (HIG "Privacy"):**
- "Request permission only when your app clearly needs access to the data or resource. ... Ideally, wait to request permission until people actually use an app feature that requires access." — [HIG: Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy)
- "Avoid requesting permission at launch unless the data or resource is required for your app to function." — [HIG: Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy)
- A custom screen shown before a system alert should "Include only one button and make it clear that it opens the system alert", should use a term like "Continue" or "Next" rather than "Allow", and should not offer cancel or close options. — [HIG: Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy)
- "Data security" (Guideline 1.6) reads: "Apps should implement appropriate security measures to ensure proper handling of user information collected pursuant to the Apple Developer Program License Agreement and these Guidelines ... and prevent its unauthorized use, disclosure, or access by third parties." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

**How institutions treat Canvas tokens:**
- At least one university system (University of Missouri) publishes a "Canvas user API token policy" warning that giving tokens to third-party tools means delegating "full account access to unvetted third parties, creating unacceptable risk to student records". This was seen only in a search snippet; the page could not be fetched. — [UM System KB (search snippet)](https://tdx.umsystem.edu/TDClient/66/MOOnline/KB/PrintArticle?ID=2193)
- Canvas documents that users can create and manage their own access tokens. — [Canvas Community](https://community.canvaslms.com/docs/DOC-16041)

### Inferences
**Login gating (5.1.1(v)).** CoursePro's core feature, reading the student's own Canvas data, depends on an account plus a token, so a login is defensible. Features that don't need Canvas data, such as a Pomodoro timer or onboarding info, should not be locked behind sign-up. Reviewers need a working demo: Guideline 2.1 requires demo credentials, so give App Review a demo CoursePro account already linked to a sandbox or demo Canvas account. Alternatively, ask Apple in advance about a demo mode. A login-only app with no demo account is a classic first-submission rejection.

**Canvas token on the server.**
- Canvas is not a social network, so the literal ban on off-device token storage in 5.1.1(v) does not apply.
- The safest posture is to mirror its spirit:
  1. explain in the app's UI, before the user pastes the token, that it will be stored encrypted on CoursePro's servers to enable background alerts;
  2. offer an in-app "disconnect Canvas / revoke token" control that deletes the stored token;
  3. state this in the privacy policy.
- This also addresses 5.1.1(ii), consent plus withdrawal, and 1.6, security.

**5.1.1(ix) and education data.** Education is not on the list of regulated fields. However, "or that require sensitive user information" is open-ended. An individual-developer account could be asked to move to an organization account. That is low risk but possible.

**MCP / AI connection.** If the iOS app itself never sends Canvas data to an AI provider, 5.1.2(i)'s third-party-AI clause is mostly a website concern. If the app mentions or launches that flow, or any app data reaches an AI service through the backend, CoursePro needs:
- explicit, separate in-app consent;
- disclosure of which AI provider receives the data;
- a matching privacy-label entry ("shared with third parties").

The MCP connection forwards the user's OAuth bearer, and the user's own AI client receives the data. That is user-initiated, so Apple might not treat it as sharing by the developer. This is an interpretation; Apple has not published guidance on user-directed AI connectors.

**Social-network clause.** Don't describe CoursePro as a "social" app, so that the social-network clause is never triggered.

### Gaps
- No public report was found of an App Store rejection specifically for an LMS/Canvas app or for server-side storage of a non-social third-party token.
- The full 2026 guideline change log is missing: Apple's guidelines page shows no "last updated" date, and Apple's own November 2025 news post was not retrieved. The November 13, 2025 date comes from secondary sources.

## 2. Privacy manifests (PrivacyInfo.xcprivacy), required-reason APIs, SDK manifests, and ITMS-91053 / ITMS-91061

### Takeaway
CoursePro needs an app-level `PrivacyInfo.xcprivacy` with:
- `NSPrivacyTracking` = false;
- no tracking domains;
- `NSPrivacyCollectedDataTypes` matching the App Store Connect label;
- `NSPrivacyAccessedAPITypes`, which almost certainly includes UserDefaults with **CA92.1** for app-only defaults **and 1C8F.1** for App Group defaults shared with widgets and Live Activities.

Missing required-reason declarations have been an upload blocker since May 1, 2024; Apple's doc says such apps "aren't accepted by App Store Connect". Apple's email for SDKs missing manifests (ITMS-91061) has called itself a rejection since February 12, 2025.

### Cited Findings
- `PrivacyInfo.xcprivacy` records "The types of data collected by your app or third-party SDK" on all platforms, and "The required reasons APIs your app or third-party SDK uses" on iOS, iPadOS, tvOS, visionOS and watchOS. "By default, the file is named `PrivacyInfo.xcprivacy`; this is the required file name for bundled privacy manifests." — [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- Top-level keys:
  - `NSPrivacyTracking`: "A Boolean that indicates whether your app or third-party SDK uses data for tracking as defined under the App Tracking Transparency framework. When set to `true` you need to provide a list of internet domains in `NSPrivacyTrackingDomains`."
  - `NSPrivacyTrackingDomains`: "If the user has not granted tracking permission ... network requests to these domains fail".
  - Also `NSPrivacyCollectedDataTypes` and `NSPrivacyAccessedAPITypes`.

  — [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- Each collected-data entry uses `NSPrivacyCollectedDataType`, `NSPrivacyCollectedDataTypeLinked`, `NSPrivacyCollectedDataTypeTracking` and `NSPrivacyCollectedDataTypePurposes`. — [Describing data use in privacy manifests](https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests)
- Enforcement: "If you upload an app to App Store Connect that uses required reason API without describing the reason in its privacy manifest file, Apple sends you an email reminding you to add the reason to the app's privacy manifest. Starting May 1, 2024, apps that don't describe their use of required reason API in their privacy manifest file aren't accepted by App Store Connect." — [Describing use of required reason API](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
- Fingerprinting: "Regardless of whether a user gives your app permission to track, fingerprinting is not allowed." Declared reasons "must be consistent with your app's functionality as presented to users, and you may not use the APIs or derived data for tracking." A third-party SDK "can't rely on the privacy manifest files for apps that link the third-party SDK" to report its own use. — [Describing use of required reason API](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
- The five categories are `NSPrivacyAccessedAPICategoryFileTimestamp`, `...SystemBootTime`, `...DiskSpace`, `...ActiveKeyboards` and `...UserDefaults`. — [NSPrivacyAccessedAPIType](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype)
- Example APIs per category, from the same page:
  - file timestamp: `creationDate`, `modificationDate`, `fileModificationDate`, `contentModificationDateKey`, `stat`/`fstat`/`lstat`, `getattrlist`;
  - boot time: `systemUptime`, `mach_absolute_time()`;
  - disk space: `volumeAvailableCapacityKey` and related keys, `statfs`/`statvfs`;
  - keyboards: `activeInputModes`;
  - user defaults: `UserDefaults`.

  — [NSPrivacyAccessedAPIType](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype)

**Reason codes, verbatim.** Source for all of these: [NSPrivacyAccessedAPITypeReasons](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitypereasons) and [NSPrivacyAccessedAPIType](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype).
- UserDefaults
  - **CA92.1**: "Declare this reason to access user defaults to read and write information that is only accessible to the app itself. This reason does not permit reading information that was written by other apps or the system, or writing information that can be accessed by other apps."
  - **1C8F.1**: "Declare this reason to access user defaults to read and write information that is only accessible to the apps, app extensions, and App Clips that are members of the same App Group as the app itself. This reason does not permit reading information that was written by apps, app extensions, or App Clips outside the same App Group or by the system. ... This reason also does not permit writing information that can be accessed by apps, app extensions, or App Clips outside the same App Group."
  - C56D.1 is the SDK-wrapper reason (SDKs only).
  - AC6B.1 covers the MDM managed-configuration keys.
- File timestamp
  - **DDA9.1**: display file timestamps to the user; the data "may not be sent off-device".
  - **C617.1**: "access the timestamps, size, or other metadata of files inside the app container, app group container, or the app's CloudKit container".
  - **3B52.1**: files the user specifically granted access to.
  - **0A2A.1**: SDK wrapper.
- System boot time
  - **35F9.1**: "measure the amount of time that has elapsed between events that occurred within the app or to perform calculations to enable timers".
  - **8FFB.1**: calculate absolute timestamps for in-app events.
  - **3D61.1**: optional user-submitted bug report.
- Disk space
  - **85F4.1**: display disk space to the user.
  - **E174.1**: "check whether there is sufficient disk space to write files, or to check whether the disk space is low so that the app can delete files".
  - **7D9E.1**: optional bug report.
  - **B728.1**: health research apps.
- Active keyboards
  - **3EC4.1**: custom keyboard apps.
  - **54BD.1**: "present the correct customized user interface ... The app must have text fields ... and must behave differently based on active keyboards in a way that is observable to users."

**Each bundle needs its own manifest:**
- "For each executable or dynamic library in an app that uses a required reason API, the bundle that includes the executable or dynamic library needs to include a privacy manifest file that reports the API." — [Describing use of required reason API](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)

**Third-party SDK list:**
- "You must include the privacy manifest for any SDK listed below when you submit new apps in App Store Connect that include those SDKs, or when you submit an app update that adds one of the listed SDKs as part of the update. Signatures are also required in these cases where the listed SDKs are used as binary dependencies. Any version of a listed SDK, as well as any SDKs that repackage those on the list, are included in the requirement." — [Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/)
- The list has 86 entries. Ones a SwiftUI and Supabase app might plausibly pull in:
  - **Alamofire**, **AppAuth**, **GTMAppAuth**, **GoogleSignIn**;
  - **FirebaseMessaging**, **FirebaseCrashlytics**, **FirebaseCore**, **FirebaseInstallations**;
  - **OneSignal** (+Core, Extension, Outcomes);
  - **Kingfisher**, **SDWebImage**, **Lottie**, **Charts**, **SnapKit**, **SwiftyJSON**, **Starscream**, **RealmSwift**, **Protobuf**, **Reachability**, **OpenSSL/BoringSSL**, **IQKeyboardManagerSwift**;
  - **FBSDK*** (Facebook).

  Supabase's Swift SDK (supabase-swift) is **not** on the list. — [Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/)

**ITMS-91061 email text:**
- "ITMS-91061: Missing privacy manifest- Your app includes "<path/to/SDK>", which includes <SDK>, an SDK that was identified in the documentation as a privacy-impacting third-party SDK. Starting February 12, 2025, if a new app includes a privacy-impacting SDK, or an app update adds a new privacy-impacting SDK, the SDK must include a privacy manifest file. Please contact the provider of the SDK..." — [Apple Developer Forums thread 774960](https://developer.apple.com/forums/thread/774960)
- Apple's DTS post in that thread treats the message as a rejection. It also advises not to copy an SDK's practices into the app's own manifest, which "should describe only your app". — [Apple Developer Forums thread 774960](https://developer.apple.com/forums/thread/774960)
- Timeline: Apple first set a spring 2024 start for the commonly-used-SDK requirement ("new app or update that adds a commonly used third-party SDK"), then enforced it from February 12, 2025 per the ITMS-91061 email. Developers have reported confusing communication. — [Apple Developer Forums thread 772176](https://developer.apple.com/forums/thread/772176)

**ITMS-91053:**
- ITMS-91053 "Missing API declaration" emails name the category, for example `NSPrivacyAccessedAPICategoryFileTimestamp`, used without a declared reason. — [B4X forum thread](https://www.b4x.com/android/forum/threads/itms-91053-missing-api-declaration.159960/post-982841); [Bugnet blog](https://bugnet.io/blog/how-to-fix-itms-91053-missing-api-declaration-privacy-manifest-for-ios-games)

### Inferences
**App Group defaults (direct answer).** An App Group `UserDefaults(suiteName:)` shared with a WidgetKit or ActivityKit extension needs **1C8F.1**. CA92.1 explicitly does "not permit ... writing information that can be accessed by other apps", and 1C8F.1 is the reason written for app extensions in the same App Group.
- If the main app also uses `UserDefaults.standard`, declare both CA92.1 and 1C8F.1 under the UserDefaults category.
- Widget and Live Activity extensions are separate bundles. If extension code itself calls UserDefaults, give each extension target its own `PrivacyInfo.xcprivacy`, or at least verify with Xcode's privacy report. Apple's per-bundle rule above implies this.

**Other likely categories:**
- `mach_absolute_time` / `systemUptime` for timers (Pomodoro, countdowns): 35F9.1.
- File-timestamp reads of cached files in the app or App Group container: C617.1.
- Disk-space checks before caching downloads: E174.1.
- Many SwiftUI apps never touch boot time or disk space directly. Generate an Xcode privacy report (Product > Archive > Generate Privacy Report) and scan the binary to see what is actually used.

**Upload behavior.** Since May 1, 2024, a missing required-reason declaration means an upload rejection at App Store Connect processing. It does not surface as an App Review rejection. A missing SDK manifest (ITMS-91061) for a listed SDK in a *new app* blocks submission. So a first submission gets no "warning grace" for either.

**Privacy label.** `NSPrivacyCollectedDataTypes` should match the App Store Connect label exactly, because Xcode's privacy report combines it with SDK manifests.

### Gaps
- Apple's own developer-news post announcing the February 12, 2025 SDK enforcement was not retrieved; the date comes from the email text quoted in the forum.
- It is not documented whether App Review ever rejects (as opposed to App Store Connect processing) over a *mis-chosen* reason code.
- Apple's docs don't say explicitly whether a widget extension that only reads App Group defaults through the main app's shared framework needs its own manifest. Verify with Xcode's privacy report.

## 3. App Privacy "nutrition label" in App Store Connect

### Takeaway
Apple's definition of "collect" is data sent off the device and kept longer than real-time servicing. Under it, CoursePro collects at least:
- Email Address (and Name, if stored);
- User ID;
- the Canvas-derived academic data, which Apple has no category for and which likely belongs under "Other Data Types";
- any user-created content such as notes or progress (Other User Content);
- diagnostics, if crash or analytics reporting is on.

All of this is linked to identity, used for App Functionality, and not used for tracking. The developer is responsible for keeping the label accurate. Apple's privacy-details page lists no specific penalty, but the guidelines allow removal for undisclosed sharing.

### Cited Findings
- "'Collect' refers to transmitting data off the device in a way that allows you and/or your third-party partners to access it for a period longer than what is necessary to service the transmitted request in real time." — [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- Optional-disclosure exemptions require **all** of the following:
  - no tracking;
  - no advertising, marketing or other purposes;
  - "Collection of the data occurs only in infrequent cases that are not part of your app's primary functionality, and which are optional for the user";
  - the user affirmatively provides the data each time.

  Also: "data collected on an ongoing basis after an initial request for permission must be disclosed." — [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- Data-type definitions:
  - Name: "Such as first or last name".
  - Email Address: "Including but not limited to a hashed email address".
  - User ID: "Such as screen name, handle, account ID, assigned user ID, customer number, or other user- or account-level ID".
  - Device ID: "Such as the device's advertising identifier, or other device-level ID".
  - Other User Content: "Any other user-generated content".
  - Customer Support: "Data generated by the user during a customer support request".
  - Product Interaction: "app launches, taps, clicks...".
  - Crash Data: "Such as crash logs".
  - Performance Data: "Such as launch time, hang rate, or energy use".
  - Other Diagnostic Data.
  - Sensitive Info: "Such as racial or ethnic data, sexual orientation, pregnancy or childbirth information, disability, religious or philosophical beliefs, trade union membership, political opinion, genetic information, or biometric data".
  - Other Data Types: "Any other data types not mentioned".

  — [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- There is **no** education or academic-records category in Apple's taxonomy. Grades are not listed under Sensitive Info or Financial Info. — [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- Purposes are Third-Party Advertising, Developer's Advertising or Marketing, Analytics, Product Personalization, App Functionality ("authenticate the user, enable features, prevent fraud, implement security measures, ensure server up-time, minimize app crashes ... or perform customer support") and Other Purposes. — [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- Linked to identity: "Data collected from an app is often linked to the user's identity, unless specific privacy protections are put in place before collection to de-identify or anonymize it ... Note: 'Personal Information' and 'Personal Data', as defined under relevant privacy laws, are considered linked to the user." — [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- Tracking: "linking data collected from your app about a particular end-user or device ... with Third-Party Data for targeted advertising or advertising measurement purposes, or sharing data collected from your app about a particular end-user or device with a data broker." — [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- Accuracy: "You're responsible for keeping your responses accurate and up to date. If your practices change, update your responses in App Store Connect. You may update your answers at any time, and you do not need to submit an app update in order to change your answers." — [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- Consequences: 5.1.2(i) says "Apps that share user data without user consent or otherwise complying with data privacy laws may be removed from sale and may result in your removal from the Apple Developer Program." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- A practitioner reports that 5.1.1 rejections spike when app behavior doesn't match label declarations and that Apple cross-references observed network traffic. This is unverified. — [trysonar blog](https://trysonar.app/blog/app-store-rejection-common-reasons-and-fixes.md)

### Inferences
Suggested label for CoursePro, assuming no analytics or ads SDKs. Every row is linked to the user, not used for tracking, and declared with App Functionality as the purpose unless noted.

| Data type | What it covers | Purpose / notes |
|---|---|---|
| Email Address | Supabase auth | App Functionality |
| Name | Only if pulled from Canvas or Supabase and stored | App Functionality |
| User ID | Supabase user ID and the Canvas user ID | App Functionality |
| Other Data Types | Canvas courses, assignments, grades and announcements cached or processed on the backend for push alerts | App Functionality. Apple has no closer category. Do not claim the data isn't collected if the backend stores or processes it beyond real-time. |
| Other User Content | Saved progress, notes, study-session data synced to the server | App Functionality |
| Crash Data, Performance Data | Only if crash or diagnostic reporting runs | App Functionality, or Analytics if used that way |
| Product Interaction | Only if an analytics SDK runs | Analytics |
| Device ID | APNs device token or Live Activity push token stored on the server. Apple does not explicitly say whether these count; many developers declare Device ID conservatively. | App Functionality |
| Customer Support | Only if collected in a way that does not meet the optional-disclosure criteria | — |

Further notes:
- The Canvas PAT itself is a credential. Apple has no "credentials" type. Treat it as covered by the account/User ID row or by "Other Data Types", and describe it in the privacy policy.
- "Data Used to Track You": none, and `NSPrivacyTracking` = false. No App Tracking Transparency prompt is needed.
- If any data flows to an AI provider via the app or backend, add "shared with third parties" disclosures (5.1.2(i)).

### Gaps
- Apple does not say whether APNs or Live Activity push tokens count as "Device ID". No authoritative source was found.
- Apple publishes no guidance on how to classify school grades or LMS data; "Other Data Types" is an inference.
- No Apple statement was found on specific penalties for inaccurate labels beyond the general removal language.

## 4. Push notifications (Guideline 4.5.4), consent timing, provisional authorization, HIG

### Takeaway
Push and local notifications need user consent. The app must work without them, and marketing pushes need separate explicit opt-in plus an in-app opt-out. Notifications "should not be used to send sensitive personal or confidential information". That matters for grades: a lock-screen alert reading "You got 62% on Midterm" is risky.

The permission prompt can and should be delayed until a meaningful moment. Provisional authorization lets an app deliver quiet notifications without a prompt.

### Cited Findings
- 4.5.4 verbatim: "Push Notifications must not be required for the app to function, and should not be used to send sensitive personal or confidential information. Push Notifications should not be used for promotions or direct marketing purposes unless customers have explicitly opted in to receive them via consent language displayed in your app's UI, and you provide a method in your app for a user to opt out from receiving such messages. Abuse of these services may result in revocation of your privileges." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 5.1.2(i): "Your app may not require users to enable system functionalities (such as push notifications, location services, tracking) in order to access functionality, content, use the app, or receive monetary or other compensation". — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 4.5.3 covers no spam or unsolicited messages via Push Notifications or Live Activities. 2.5.16: notifications "should be related to the content and functionality of your app." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- HIG: "Before you can send any notifications to people, you have to get their consent". "Avoid including sensitive, personal, or confidential information in a notification. You can't predict what people will be doing when they receive a notification, so it's essential to avoid including private information that could be visible to others." — [HIG: Notifications](https://developer.apple.com/design/human-interface-guidelines/notifications)
- HIG: "Avoid sending multiple notifications for the same thing, even if someone hasn't responded." When previews are hidden, "Provide generically descriptive text ... like 'Friend request,' 'New comment,' 'Reminder'" (`hiddenPreviewsBodyPlaceholder`). — [HIG: Notifications](https://developer.apple.com/design/human-interface-guidelines/notifications)
- Developer docs: "Make the request in a context that helps people understand why your app needs authorization. In a task-tracking app that sends reminder notifications, you might make the request after the person schedules a first task. Sending the request in context provides a better experience than automatically requesting authorization on first launch". The first request prompts the user; "Subsequent authorization requests don't prompt the person." — [Asking permission to use notifications](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications)
- Provisional authorization: "The system delivers provisional notifications quietly — they don't interrupt the person with a sound or banner, or appear on the lock screen. Instead, they only appear in the notification center's history. These notifications also include buttons that prompt the person to keep or turn off the notification." Add the `.provisional` option; "this code doesn't prompt the person ... the first time you call this method, it automatically grants authorization." "If you request provisional authorization, you can request authorization when your app first launches." — [Asking permission to use notifications](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications)
- "Always check your app's authorization status before scheduling local notifications. People can change your app's authorization settings at any time." — [Asking permission to use notifications](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications)
- A pre-permission explainer screen is allowed but should have one "Continue/Next" button that leads to the system alert, with no cancel or close option. This HIG guidance is written for protected resources (camera, location, tracking and so on); notifications are not explicitly listed. — [HIG: Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy)

### Inferences
**Timing and gating.** Ask for notification permission in context, for example right after the user connects Canvas and sees upcoming due dates ("Get reminded before assignments are due?"), not on first launch. A delay such as after a few launches is permitted; nothing requires asking at launch. Do not make onboarding stop if the user declines: the dashboard must still work, or 5.1.2(i) and 4.5.4 are violated.

**Grade alerts.** Under 4.5.4's "should not be used to send sensitive personal or confidential information", lock-screen grade values are a judgment call. Safer patterns:
- a generic body such as "New grade posted in BIO 101", with the score shown in-app;
- a user setting to "show scores in notifications" (off by default);
- `hiddenPreviewsBodyPlaceholder`.

**Marketing.** Keep all pushes transactional (due dates, grades, announcements, class countdowns). Any "new feature" or promotional push needs a separate in-app opt-in toggle with consent language, plus an opt-out.

**Live Activities.** These use ActivityKit, and users can disable them per app in Settings. They are covered by the 4.5.3 anti-spam rule. Push-started Live Activities should start only for things the user requested, such as a class countdown the user enabled.

### Gaps
- Apple publishes no explicit rule on how many launches it is acceptable to wait before prompting. The guidance only says "in context" and not "automatically ... on first launch".
- No Apple statement says whether grade values count as "sensitive personal or confidential information" under 4.5.4; that is interpretation.
- This research did not cover Live Activities-specific review rules beyond 4.5.3 and 2.5.16.

## 5. Age rating (2025 system), 18+ account policy, App Store Accountability Act laws and the Declared Age Range API

### Takeaway
Since July 2025, Apple's global ratings are 4+, 9+, 13+, 16+ and 18+, with new required questions on in-app controls, capabilities, medical/wellness topics and violence. Those questions were due January 31, 2026; updates were blocked until answered. On its content, a grades-reading app with no UGC, chat, ads or open web browser would calculate to **4+**.

However, Apple's help text is direct: "If your app has a EULA with minimum age requirements that exceed the rating that Apple calculated, you must override to a rating that adheres to the requirements." So CoursePro's 18+ account policy means overriding to **18+**, unless the policy is lowered.

Laws in Texas (effective June 4, 2026), Utah (May 6, 2026; one secondary source says May 7) and Louisiana (July 1, 2026) require age assurance and parental consent for minors. Apple shares age categories through the Declared Age Range API, and Apple says even 18+ apps must check age with it in regions where the law requires.

### Cited Findings
**Rating tiers and the 2025 change:**
- Apple's July 24, 2025 email to developers announced 13+, 16+ and 18+ tiers alongside 4+ and 9+. It said apps were auto-re-rated, listed new required questions (in-app controls, capabilities, medical or wellness, violent themes), and set a January 31, 2026 deadline after which app updates would be blocked until answered. — [9to5Mac, Jul 24 2025](https://9to5mac.com/2025/07/24/apple-notifies-developers-of-new-app-store-age-rating-system/); [Michael Tsai](https://mjtsai.com/blog/2025/07/28/updated-age-ratings-in-app-store-connect/)
- A developer forum thread reports the email didn't clarify whether updates are blocked outright after the deadline or only until the questionnaire is completed. — [Apple Developer Forums 810473](https://developer.apple.com/forums/thread/810473)
- Secondary coverage says Apple told developers to consider AI assistant and chatbot functionality when answering sensitive-content questions. — [AppDeveloperMagazine](https://appdevelopermagazine.com/apple-age-rating-update/). This is not confirmed in Apple's help pages fetched here.

**Rating values (iOS 26+), verbatim structure:**
- 4+ may include "In-App Controls: Parental controls; Age assurance" and "Capabilities: User-generated content; Messaging and chat; Advertising".
- 13+ adds "Capabilities: Social media; Social media disabled for users under 13".
- 16+ adds "Capabilities: Unrestricted web access" and "Frequent medical or treatment information".
- 18+ is driven by frequent alcohol/drug references, frequent sexual content, frequent realistic violence, and gambling.

— [Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions)

**Definitions that matter for CoursePro:**
- "Unrestricted Web Access: Users can navigate to any webpage within the app or freely browse the web. May include: embedded browser functionality or browser app."
- "User-Generated Content: Includes the broad distribution of content created by users ..."
- "Messaging and Chat: Users can directly communicate with one another ..."
- "Age Assurance: Mechanism to confirm an individual's age meets the age requirement ... May include: declared age range API; age estimation ...; age verification via government-issued [ID]".
- "Parental Controls: Settings or tools that allow parents/guardians to monitor, manage, or restrict a child's access ..."

The visible definitions contain no AI or chatbot descriptor. — [Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions)

**Override rules (verbatim):**
- "If your app is for a specific age category, has a EULA with age requirements, or if you believe your app should be rated higher, you can adjust the rating ... by choosing Made for Kids or Override to Higher Age Rating."
- "If your app has a EULA with minimum age requirements that exceed the rating that Apple calculated, you must override to a rating that adheres to the requirements."
- "The override will apply in all regions where your app is available".
- "App Store will display this specified age rating, and the content descriptions will still reflect your questionnaire answers."
- An optional "Age Suitability URL" field exists.

— [Set an app age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)

**Mis-rating:**
- 2.3.6: "Answer the age rating questions in App Store Connect honestly so that your app aligns properly with parental controls. If your app is mis-rated, customers might be surprised by what they get, or it could trigger an inquiry from government regulators." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 2.3.8: metadata must be 4+-appropriate even if the app is rated higher. — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

**Texas SB 2420 timeline:**
- Apple paused implementation on December 23, 2025 after a district-court injunction, keeping the tools available in sandbox. The tools are the Declared Age Range API, the Significant Change API under PermissionKit, the StoreKit `ageRatingCode`, and App Store Server Notifications. Apple said "These tools can also be used to help developers with their obligations under laws coming into effect in Utah and Louisiana in 2026. The Declared Age Range API remains available worldwide for users on iOS 26, iPadOS 26, and macOS 26, or later." — [Apple news, Dec 23 2025](https://developer.apple.com/news/?id=8jzbigf4)
- June 3, 2026: "Due to a recent court ruling lifting an injunction on Texas law SB 2420, new Apple Accounts in Texas are now subject to the law ... this includes age assurance and parent or guardian consent on behalf of minors under the age of 18 for downloads, Apple In-App Purchases, and significant changes associated with an app. ... These changes will go into effect starting June 4, 2026."
  - Next steps: implement the Declared Age Range API, the Significant Change API under PermissionKit, the new StoreKit age rating property, and the App Store server notification for consent revocation.
  - "it's the developer's responsibility to determine when there's a significant change to their app."

  — [Apple news, Jun 3 2026](https://developer.apple.com/news/?id=sg176nne)
- Secondary sources differ on the court action (Fifth Circuit stay versus reversal). — [MacRumors Jun 3 2026](https://www.macrumors.com/2026/06/03/apple-app-store-texas-sb-2420/); [TechTimes](https://www.techtimes.com/articles/318041/20260609/texas-app-store-age-verification-active-sb-2420-ends-anonymous-access-developers-face-10k-penalty.htm). TechTimes reports a $10K penalty for developers; this is unverified.

**Utah, Louisiana and other regions (Apple announcement of February 24, 2026, via press):**
- Age categories are shared through the Declared Age Range API for new Apple Accounts in Utah from **May 6, 2026** and in Louisiana from **July 1, 2026**.
- In **Australia, Brazil and Singapore**, the App Store blocks 18+ app downloads from February 24, 2026 unless adult status is confirmed.
- The API gained signals for "whether age-related regulatory requirements apply" and for parental permission for significant updates (Significant Update Action, beta at the time).

— [Gigazine](https://gigazine.net/gsc_news/en/20260225-apple-rolls-out-age-verification-tools); [TechRepublic](https://www.techrepublic.com/article/news-apple-expands-age-verification-api-global-compliance/); [Help Net Security](https://www.helpnetsecurity.com/2026/02/25/apple-expands-age-verification-controls/). Ars Technica (via Slashdot) gives Utah as **May 7, 2026**, which conflicts with the May 6 date. — [Slashdot](https://tech.slashdot.org/story/25/10/09/2044214/apple-and-google-reluctantly-comply-with-texas-age-verification-law)

**Apple's Age assurance Q&A (primary source):**
- Build requirement: "To enable all the technologies ... you must build your app against the iOS 26.2 and iPadOS 26.2 SDKs, or later, with Xcode 26.2 (17C52) or later."
- iOS 26.4 added `AgeRangeService.requiredRegulatoryFeatures`, `showSignificantUpdate…`, and `SignificantUpdateAction`.
- iOS 26.2 added `isEligibleForAgeFeatures`, plus the check-method flags `governmentIDChecked`, `paymentChecked` and `checkedByOtherMethod`, and the PermissionKit `SignificantAppUpdateTopic`.

— [Age assurance frameworks Q&A](https://developer.apple.com/support/age-assurance/)

Further Q&A answers:
- "Am I responsible for age restrictions or is Apple? Yes, developers are responsible for their own age restrictions. In certain regions, where legally required, Apple uses age assurance methods to confirm an Apple Account holder's age and shares age categories with you through the Declared Age Range API. In those regions, you must check the age of the people using your app."
- "If my app is rated 18+, do I still need to implement the Declared Age Range API? Yes. In regions where legally required, you need to check the age of the people using your app with the Declared Age Range API."
- "Are there any changes to the App Review process related to my app's age assurance obligations? No, there are no changes to the App Review process."
- On consent revocation, "Apple will prevent the app from launching"; handle the `RESCIND_CONSENT` server notification.
- "Existing Apple Accounts running iOS 18 and iPadOS 18, or earlier ... won't be affected."
- "If an app is rated 13+, can parents still allow their child under 13 to download ...? Yes", via a Screen Time exception request.

— [Age assurance frameworks Q&A](https://developer.apple.com/support/age-assurance/)

**Declared Age Range API:**
- It requires the `com.apple.developer.declared-age-range` entitlement. Its data "is based on information declared by a person, or their parent or guardian, and may be confirmed using a method like a credit card or government ID. You are solely responsible for ensuring compliance with associated laws or regulations that may apply to your app." — [Declared Age Range documentation](https://developer.apple.com/documentation/declaredagerange)
- Guideline 1.2.1(a), for creator apps, and 4.7.5, for mini-app platforms, mention "an age restriction mechanism based on verified or declared age". Neither applies directly to CoursePro. — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

### Inferences
**Questionnaire answers for CoursePro:**
- Answer "None" to the content descriptors: no violence, mature themes, medical content or gambling.
- Capabilities:
  - UGC: no. Private notes are not "broad distribution".
  - Messaging/Chat: no.
  - Advertising: no.
  - Social media: no.
  - **Unrestricted Web Access: no**, provided Canvas pages open in `SFSafariViewController` or Safari pointed at specific URLs, with no free-browsing address bar. An embedded browser that lets users navigate anywhere would push the rating to 16+.
- In-App Controls: "Age Assurance" is yes if the app uses the Declared Age Range API or an 18+ gate.
- The optional MCP/AI connection lives on the website and isn't an in-app chatbot, so it shouldn't affect the questionnaire. Apple's descriptors don't include an AI category. If an in-app AI chat were added later, that guidance would need revisiting.
- Calculated rating: 4+.

**18+ policy and the rating:**
- An 18+ minimum in the terms or EULA plus a lower displayed rating directly conflicts with Apple's "must override" rule. The likely fix is Override to Higher Age Rating = 18+.
- Downsides of 18+:
  - Screen Time blocks the app for minors.
  - In Australia, Brazil and Singapore, downloads are blocked unless the account is confirmed adult.
  - For a student app, many college students are 18+, but high-schoolers are excluded.
- Alternative: lower the account minimum, for example to 13+ or 16+ with COPPA compliance, and use a matching rating. That is a product and legal decision.
- Either way, the stated policy, the rating and the privacy policy must agree. A mismatch is an easy rejection or metadata flag.

**Declared Age Range API:**
- It is **not** an App Review requirement ("no changes to the App Review process").
- It **is** a legal-compliance expectation in Texas, Utah and Louisiana, plus Brazil, Australia and Singapore, for new accounts.
- Apple explicitly says 18+ apps still need to call it where legally required.
- For a first submission, implementing it gives a cheap, privacy-preserving age gate. It also supports answering "Age assurance" in the questionnaire. Build with Xcode 26.2 or later.
- "Significant change" consent handling via PermissionKit matters only for minors. If accounts are 18+, the main job is to verify adult status and block under-18 users that the API reports. Handle `RESCIND_CONSENT` anyway.

### Gaps
- Apple's own July 2025 and February 24, 2026 news posts were not fetched directly; details come from press coverage.
- The Utah date conflicts (May 6 versus May 7, 2026).
- The exact questionnaire question text (as opposed to the descriptor definitions) was not retrievable.
- Whether the January 31, 2026 deadline still affects new apps is moot: a new app answers the new questionnaire anyway.
- No legal source was checked for each state law's developer-side obligations, penalties or bill numbers for Utah and Louisiana. Consult counsel.
- The claim that a Social Media descriptor has appeared on product pages since July 2026 comes from one unverified blog ([trysonar](https://trysonar.app/blog/app-store-age-rating)).

## 6. Safety items (1.x), regulated fields, education data / FERPA, and export compliance

### Takeaway
- 1.2 (UGC) doesn't apply to CoursePro. 1.6 (data security) requires "appropriate security measures" for the stored Canvas tokens.
- Apple's guidelines say nothing about FERPA, and education isn't a listed "highly regulated field" in 5.1.1(ix). The 5.1.4 Kids rules (COPPA and GDPR) apply only if minors use the app.
- For export compliance, an app using only OS-provided HTTPS (URLSession) can set `ITSAppUsesNonExemptEncryption` = NO.

### Cited Findings
- 1.6: "Apps should implement appropriate security measures to ensure proper handling of user information ... and prevent its unauthorized use, disclosure, or access by third parties." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 1.2 covers "social media, user-generated content platforms, and AI content creation apps", requiring filtering, reporting, blocking and published contact information. — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 5.1.1(ix) lists "banking and financial services, healthcare, gambling, legal cannabis use, air travel and crypto exchanges" "or that require sensitive user information". Education and FERPA are not mentioned anywhere in the fetched guideline text. — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- 5.1.4 Kids: "apps in the Kids Category or those that collect, transmit, or have the capability to share personal information ... from a minor must include a privacy policy and must comply with all applicable children's privacy statutes." It references COPPA and GDPR. Apps not in the Kids Category "cannot include any terms in app name, subtitle, icon, screenshots or description that imply the main audience for the app is children." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- FERPA context (non-Apple): under FERPA, platforms used by institutions in ways that expose identifiable student data are generally treated as maintaining education records on the institution's behalf, and grades are among protected records. Vendor obligations typically arise via the school contract ("school official" designation or a data processing agreement). — [UW College of Engineering FERPA guide](https://www.engr.washington.edu/mycoe/research/resources/ferpa-for-researchers); [ManagedMethods](https://managedmethods.com/blog/student-data-privacy-and-3rd-party-apps/)
- Export compliance:
  - "Set the value for this key to `NO` in your app's Information Property List file to indicate that your app—including any third-party libraries you link against—either uses no encryption, or only uses encryption that's exempt from export compliance requirements". — [ITSAppUsesNonExemptEncryption](https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption)
  - "If you don't have the key ... App Store Connect walks you through an export compliance questionnaire every time you upload a new version". — [ITSAppUsesNonExemptEncryption](https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption)
  - "Typically, the use of encryption that's built into the operating system—for example, when your app makes HTTPS connections using URLSession—is exempt from export documentation upload requirements, whereas the use of proprietary encryption is not." — [Complying with encryption export regulations](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations)
  - "If your app uses exempt forms of encryption, you might alternatively be required to submit a year-end self-classification report to the U.S. government." — [Complying with encryption export regulations](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations)

### Inferences
**FERPA.** CoursePro is direct-to-student: the student supplies their own token, and no school contract exists. FERPA's obligations attach to institutions, so it is unlikely to bind CoursePro directly. Apple review does not test for FERPA. Two risks remain:
- some schools' Canvas acceptable-use policies forbid sharing tokens with third parties;
- the privacy policy should be careful in how it describes academic data.

This is an inference; no legal source was consulted on student-initiated sharing.

**Security measures that address 1.6:**
- encrypt PATs at rest on Supabase, for example with Vault or pgsodium or app-level encryption;
- never log tokens;
- keep any device copy in the Keychain, not UserDefaults or App Group defaults;
- support immediate token deletion.

**Export compliance.** Add `ITSAppUsesNonExemptEncryption = NO` if only URLSession/TLS and Apple CryptoKit hashing is used. Bundling OpenSSL, BoringSSL or custom crypto changes the analysis. Answering this also avoids a per-upload prompt.

### Gaps
- No Apple statement was found on education data specifically.
- No authoritative source was checked on whether the year-end self-classification report applies to apps whose only encryption is HTTPS. Apple's text says "might"; current U.S. EAR practice should be confirmed.
- France and some other countries have separate encryption import declarations, which Apple's doc mentions generically as "import compliance requirements"; this was not researched.
