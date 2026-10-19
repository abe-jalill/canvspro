# Login Services (4.8), Sign in with Apple, and Account Deletion (5.1.1(v)): what CoursePro must do to pass App Review (as of Oct 2026)

Context: CoursePro is a native SwiftUI student app that uses Supabase Auth with email/password and possibly Google sign-in. Its main data comes from the user's school Canvas LMS, and users can delete their account in the app. All guideline text below was fetched from Apple's live pages on 2026-10-19 unless noted.

## 1. Guideline 4.8 (Login Services): current text, when another login is required, and exemptions

### Takeaway
Under 4.8 as it reads today, an email/password-only CoursePro (its own Supabase account system) needs no other login. If Google Sign-In is added to create or sign in to the CoursePro account, the app must also offer a privacy-preserving "equivalent" login, and in practice that means Sign in with Apple. The education exemption probably does not cover CoursePro, because CoursePro creates its own account rather than requiring sign-in with an existing school account.

### Cited Findings
- **Current 4.8 text, verbatim:** "Apps that use a third-party or social login service (such as Facebook Login, Google Sign-In, Log in with X, Sign In with LinkedIn, Login with Amazon, or WeChat Login) to set up or authenticate the user's primary account with the app must also offer as an equivalent option another login service with the following features: the login service limits data collection to the user's name and email address; the login service allows users to keep their email address private as part of setting up their account; and the login service does not collect interactions with your app for advertising purposes without consent." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **Definition, verbatim:** "A user's primary account is the account they establish with your app for the purposes of identifying themselves, signing in, and accessing your features and associated services." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **Exemptions, verbatim.** "Another login service is not required if:"
  - "Your app exclusively uses your company's own account setup and sign-in systems."
  - "Your app is an alternative app marketplace, or an app distributed from an alternative app marketplace, that uses a marketplace-specific login for account, download, and commerce features."
  - "Your app is an education, enterprise, or business app that requires the user to sign in with an existing education or enterprise account."
  - "Your app uses a government or industry-backed citizen identification system or electronic ID to authenticate users."
  - "Your app is a client for a specific third-party service and users are required to sign in to their mail, social media, or other third-party account directly to access their content."
  - Source: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **Change history:**
  - Apple's January 25, 2024 news post: "4.8: Edited to require an additional login service with certain privacy features if you use a third-party or social login service to set up or authenticate a user's primary account." — [Apple Developer News, Jan 25 2024](https://developer.apple.com/news/?id=7j1f99yf)
  - Before that edit, 4.8 required "Sign in with Apple" by name. A forum excerpt quotes the old text as requiring apps that use a third-party login to "also offer Sign in with Apple as an equivalent option." — [developer.apple.com search result summary of forum thread 707538](https://developer.apple.com/forums/thread/707538). 9to5Mac reported the change on Jan 27, 2024 as Apple "(sort of)" removing the requirement. — [9to5Mac](https://9to5mac.com/2024/01/27/sign-in-with-apple-rules-app-store/) (the page did not load directly; this is from the search result).
  - March 5, 2024 update, verbatim: "4.8 Login Services: Updated to make clear that the login service cannot collect interactions with your app for advertising purposes without consent. It also adds that another login service is not required if your app is an alternative app marketplace, or an app distributed from an alternative app marketplace, that uses a marketplace-specific login for account, download, and commerce features." — [Apple Developer News, Mar 5 2024](https://developer.apple.com/news/?id=flmb6ri3)
- **App Review still points to Sign in with Apple.** A 4.8 rejection posted in October 2024 reads: "The app uses a third-party login service like Google or Facebook, but does not appear to offer an equivalent login option with Sign in with Apple. … Revise the app to offer an equivalent login option that meets all of the above requirements. If the app already includes a login option that meets the above requirements, reply to App Review in App Store Connect, identify which login option meets the requirements, and explain why it meets the requirements. Additionally, it would be appropriate to update the screenshots in the app's metadata … Note that Sign in with Apple meets the requirements specified in guideline 4.8." — [Apple Developer Forums thread 765145](https://developer.apple.com/forums/thread/765145)
- **Login must stay inside the app.** Apple's account-deletion FAQ says "linking out to the default web browser to sign in or register an account provides a poor user experience and isn't appropriate, per App Review Guideline 4." — [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- **Related 5.1.1(v) text, verbatim:** "If your app doesn't include significant account-based features, let people use it without a login." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **Whether email/password-only meets the "keep email private" criterion is unsettled.** A third-party blog notes that whether plain email/password sign-up passes as the equivalent option depends on that criterion, and that Apple has not stated a position. — [newly.app, add-social-login](https://newly.app/how-to/add-social-login) (secondary source)

### Inferences
- **Email/password only (Supabase):** this falls under the "company's own account setup and sign-in systems" exemption, so 4.8 does not require any other login.
- **Adding Google Sign-In for the CoursePro account:** 4.8 applies, because "Google Sign-In" is named in the guideline. The "equivalent option" has to meet all three privacy criteria. Sign in with Apple is the only option App Review names as meeting them, so adding it is the lowest-risk path. Email/password does not reliably count as the equivalent option, because it does not let users hide their email.
- **Canvas does not obviously qualify for an exemption:**
  - The education exemption requires the app to make "the user to sign in with an existing education or enterprise account." CoursePro has its own Supabase account, and Canvas is connected afterwards with a token, so that exemption does not fit.
  - The "client for a specific third-party service" exemption would fit only if Canvas sign-in were the primary login. It is not.
  - If CoursePro instead made Canvas institutional OAuth the only primary login, the education exemption would plausibly apply. That would be a product change.
- **Google Workspace for Education:** limiting Google sign-in to school Google accounts might arguably fit the education exemption. No Apple source confirms this, so treat it as risky.
- **Submission tips:**
  - If Sign in with Apple is added, update the App Store screenshots so they show it. The rejection template asks for this.
  - Login must happen natively or in an in-app authentication session, not by sending the user out to Safari.

### Gaps
- I found no official Apple statement on whether email/password, or a custom provider, satisfies the "keep email private" criterion when it is used as the equivalent option to Google.
- I could not confirm whether App Review treats "Google sign-in restricted to school Google accounts" as the education exemption.
- I found no evidence of 4.8 text changes after March 2024. The live text fetched in Oct 2026 matches the March 2024 description.

## 2. Sign in with Apple button rules (Human Interface Guidelines) and button-related rejections

### Takeaway
Use the system `SignInWithAppleButton` / `ASAuthorizationAppleIDButton`. Make it at least as large and as visible as the Google button, with no scrolling needed to see it. Use only the titles "Sign in / Sign up / Continue with Apple" and the black, white, or white-outline styles. A custom button is allowed, but it must use Apple's downloaded logo artwork and keep the button black or white.

### Cited Findings
All quotes in this section are from the [HIG: Sign in with Apple](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple) (fetched via the page's JSON; its change log is last dated Sept 14, 2022).
- **Prominence:** "Prominently display a Sign in with Apple button. Make a Sign in with Apple button no smaller than other sign-in buttons, and avoid making people scroll to see the button."
- **System button benefits:** Apple-approved appearance, automatic localization of the title, configurable corner radius on iOS, macOS, and the web ("you can change the corner radius to produce a button with square corners or a capsule-shape button"), and built-in VoiceOver text.
- **Styles:**
  - White: for dark backgrounds.
  - White with outline: for white or light backgrounds. "Avoid using this style on a dark or saturated background."
  - Black: for white or light backgrounds. "don't use it on black or dark backgrounds."
- **Size:** minimum width "140pt (140px @1x, 280px @2x)", minimum height "30pt (30px @1x, 60px @2x)", minimum margin "1/10 of the button's height." "Be mindful that the button title may vary in length depending on the locale."
- **Corner radius:** "Adjust the corner radius to match the appearance of other buttons in your app."
- **Custom buttons:**
  - "Always make sure that people can instantly identify your custom button as a Sign in with Apple button … App Review evaluates all custom Sign in with Apple buttons."
  - "Use only the logo artwork downloaded from Apple Design Resources; never create a custom Apple logo." and "never use the Apple logo as a button."
  - Logo file rules: "Match the height of the logo file to the height of the button. Don't crop the logo file. Don't add vertical padding."
  - "Titles. Use only Sign in with Apple, Sign up with Apple, or Continue with Apple."
  - Shape: logo-plus-text buttons "are always rectangular; logo-only buttons can be circular or rectangular."
  - Colors: "Logo and title colors … must be either black or white; don't use custom colors."
  - Allowed changes: title font, weight and size; all-caps; black or white background with a subtle texture or gradient; corner radius; bezel and shadow.
  - Proportions: the title font size is 43% of the button height. "Ensure the margin measures at least 8% of the button's width" between the title and the right edge. Use PNG artwork only for 44pt-tall buttons (the iOS default and recommended height).
  - Logo-only buttons are 1:1, have no extra horizontal padding, and may be masked into a circle or rounded rectangle.
- **Flow guidance:**
  - "As soon as Sign in with Apple completes, welcome people to their new account … don't delay the experience by asking for information that isn't required."
  - "Indicate when people are currently signed in … displaying a phrase like 'Using Sign in with Apple' in places like a settings or account interface."
- **Account linking:** "Consider letting people link an existing account to Sign in with Apple." For example, suggest linking when the shared email matches an existing account, or offer linking in account settings.
- **Third-party summaries of rejection causes** (configuration and button problems) exist, but they are secondary or promotional. — [vp0.com checklist](https://vp0.com/blogs/sign-in-with-apple-rejection-config-checklist), [ptkd.com](https://ptkd.com/journal/app-store-rejection-4-8-sign-in-with-apple-requirement-fix)

### Inferences
- **SwiftUI:**
  - Use `SignInWithAppleButton(.signIn / .signUp / .continue)` with `.signInWithAppleButtonStyle(.black / .white / .whiteOutline)`, chosen to match the color scheme.
  - Give it a `.frame(height:)` equal to the Google button's height (at least 44pt) and the same width.
  - Place it above or beside Google, above the fold.
  - Avoid `.fixedSize()` if that would make it smaller than the Google button. The Supabase sample uses `.fixedSize()`.
- **Dark mode:** switch to `.white` in dark mode. A black button on a dark background breaks the HIG.
- **Branded Google buttons:** if the Google button is custom-branded, keep the Apple button the same size. Use a custom Apple button made from Apple's artwork if you need the logos to line up.

### Gaps
- Apple publishes no list of button-specific rejection messages. Developer-reported examples (button smaller than Google's, wrong title, custom logo) come mostly from secondary blogs, not Apple.
- The HIG names minimum, default, and maximum corner radius, but the numeric values are images on the page and could not be extracted.

## 3. Name and email handling: don't re-ask after Sign in with Apple; private relay email

### Takeaway
Apple sends the user's name only on the first authorization, so save it right away with Supabase `updateUser`. Never require name, email, or a password after Sign in with Apple. Reviewers reject that under Guideline 4.0 Design, not 4.8. To email relay addresses, register outbound email sources in the developer portal and authenticate them with SPF and DKIM.

### Cited Findings
- **Rejection wording (May 2023 forum post):** "Guideline 4.0 - Design, Your app requires users to provide their name and/or email address after using Sign in with Apple. This information is already provided by the Authentication Services framework." — [Apple Developer Forums thread 730223](https://developer.apple.com/forums/thread/730223)
- **Same 4.0 wording for a phone number:** a search-result summary reported a separate forum thread where this 4.0 wording was applied to requiring a mobile number after Sign in with Apple. I did not open that thread; [thread 776815, "Guideline 4.0 - Design"](https://developer.apple.com/forums/thread/776815) appeared in the same results, but which thread it was is unverified.
- **HIG on collecting data:**
  - "Don't ask people to supply a password … Unless people have stopped using Sign in with Apple with your app or website, don't ask for a password."
  - "Avoid asking for a personal email address when people supply a private relay address … It's essential to respect this choice."
  - Clarify whether extra data is required (legal or contractual) or optional. "If people choose not to provide optional information, don't prevent them from accessing their account or using all the features of your app."
  - Source: [HIG](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple)
- **Guideline 5.1.1(x):** "Apps may request basic contact information (such as name and email address) so long as the request is optional for the user, features and services are not conditional on providing the information…" — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **Apple on first-login data:**
  - "The API collects this information and shares it with your app the first time the user logs in using Sign in with Apple. If the user then uses Sign in with Apple on another device, the API doesn't ask for the user's name or email again."
  - "Although Apple provides the user's email address in the identity token on all subsequent API responses, it doesn't include other information about the user, such as their name … immediately store it locally."
  - Source: [Authenticating users with Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple)
- **Supabase on names:** "Apple's identity token does not include the user's full name in its claims," so Supabase cannot fill in the name automatically. "The full name must be captured from Apple's native authentication response and manually saved using the `updateUser` method." Also: "If a user revokes your app's access and then re-authorizes it, Apple will provide the full name again." — [Supabase docs: Login with Apple (source mdx)](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/social-login/auth-apple.mdx)
- **Private relay addresses:** they "end in `@private.icloud.com`, `@privaterelay.appleid.com`, or `@icloud.com`." They are the same across one developer team's apps. "Each private relay email address has a daily limit of 100 emails." Users manage them under Settings > Sign in with Apple. — [Communicating using the private email relay service](https://developer.apple.com/documentation/signinwithapple/communicating-using-the-private-email-relay-service)
- **Registering senders:**
  - "To send emails to users with private email addresses, you must register your outbound emails or email domains and use Sender Policy Framework (SPF) to authenticate your outbound emails." — [same page](https://developer.apple.com/documentation/signinwithapple/communicating-using-the-private-email-relay-service)
  - The configuration page adds: "You must authenticate all registered domains with the Sender Policy Framework (SPF), the DomainKeys Identified Mail (DKIM) protocol, or both … Authenticate outbound emails using both SPF and DKIM whenever possible." Limits: up to 100 sources for organizations, 32 for individuals. — [Configuring your environment for Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple)
  - Supabase's web setup also says to "Register email sources for Sign in with Apple for Email Communication" in Certificates, Identifiers & Profiles > Services. — [Supabase docs mdx](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/social-login/auth-apple.mdx)

### Inferences
- **After Sign in with Apple:**
  - Do not show a mandatory "enter your name/email" screen. If the name is nil (a returning user), fall back to "Student" or an optional, skippable profile field.
  - Do not ask a Sign in with Apple user to set a password.
  - Show the relay email in the account screen. The HIG suggests this, and it helps users find it.
- **Email senders to register:** every sender CoursePro uses must be registered and SPF/DKIM-aligned, or mail to relay users silently fails. That includes the Supabase Auth SMTP sender (for example, an email-change confirmation) and any custom domain for transactional or notification email.
- **Canvas onboarding:** asking for the Canvas domain and API token is core functionality, not "name/email." Label it clearly as required to connect the school, so it is not read as re-collecting personal data.

### Gaps
- I found no 2025–2026 Apple statement changing the 4.0 practice. The newest rejection quotes I found are from 2023 (thread 730223) and an unverified search snippet (see above).

## 4. Account deletion: Guideline 5.1.1(v) and Apple's "Offering account deletion" rules

### Takeaway
If the app creates accounts, it must let users start full account deletion from inside the app, usually in account settings. Deactivation alone does not count. Phone, email, or support-chat flows are not allowed unless the app is in a highly regulated industry. Tell users what data is kept and how long deletion takes. Warn subscribers that Apple billing continues. Sign in with Apple users "should" also have their tokens revoked through Apple's REST API.

### Cited Findings
- **5.1.1(v) verbatim:** "(v) Account Sign-In: If your app doesn't include significant account-based features, let people use it without a login. If your app supports account creation, you must also offer account deletion within the app. Apps may not require users to enter personal information to function, except when directly relevant to the core functionality of the app or required by law…" The rest covers social-network logins: the app must include a mechanism to revoke social network credentials, and "An app may not store credentials or tokens to social networks off of the device…" — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **Since June 30, 2022:** "Apps submitted to the App Store that support account creation must also let users initiate deletion of their account within the app, as of June 30, 2022." — [TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)

The rest of this section is from Apple's [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/) unless another source is named.
- **Definition:** "Deleting an account removes the account from the developer's records, along with any data associated with the account that the developer isn't legally required to maintain."
- **Placement:** "Make the account deletion option easy to find in your app. Typically, it's included in the app's account settings."
- **Scope:** "Offer to delete the entire account record, along with associated personal data … only offering to temporarily deactivate or disable an account is insufficient."
- **Web completion:** "If people need to visit a website to finish deleting their account, include a link directly to the page on your website where they can complete the process."
- **Confirmation:** "It's appropriate to confirm the user genuinely intends to delete their account. You may add steps to verify the identity … such as by entering a code from an email or phone number already associated with the account. However, apps that make it unnecessarily difficult for someone to delete their account will not pass review."
- **Support flows:** "Apps not operating in highly regulated industries should not require people to make a phone call, send an email, use a chat support flow, or go through other support flows."
- **Timing:** "If your process for account deletion is manual or otherwise takes a reasonable amount of time to complete, this is acceptable. Inform the person how long it will take to delete the account and provide a confirmation when the deletion is complete."
- **Retention:** "If you're legally required to retain some user information, let people know what information will and won't be retained."
- **User content:** "People expect that all data associated with their account will be deleted … This includes user-generated content that's shared with others."
- **Everyone, everywhere:** "Everyone should be able to delete their accounts, regardless of where they're located." Deletion must not be limited to regions covered by CCPA or GDPR.
- **Guest accounts:** automatically generated "guest" accounts must also be deletable.
- **Subscriptions:**
  - "If a person has an auto-renewable subscription, notify them that billing will continue through Apple and ask them to cancel their subscription before continuing."
  - "you can offer to schedule account deletion for a later date, aligned with the subscription's expiration, as long as there's also an option to delete the account immediately."
  - Use `showManageSubscriptions` (iOS 15+) or https://apps.apple.com/account/subscriptions/. Optionally offer `beginRefundRequest` or https://support.apple.com/118223.
- **Sign in with Apple:** "Apps that support Sign in with Apple should use the Sign in with Apple REST API to revoke user tokens. Use server-to-server notification endpoints to process changes for Sign in with Apple accounts."
- **Rejection template (Oct 2024 forum post):**
  - "The app supports account creation but does not include an option to initiate account deletion."
  - The listed requirements: deactivation alone is insufficient; a direct link if deletion finishes on the web; confirmation steps are allowed; only highly regulated industries may require customer service.
  - Next Steps: "If the app already supports account deletion, reply to App Review in App Store Connect and identify where to locate this feature."
  - Source: [Apple Developer Forums thread 765160](https://developer.apple.com/forums/thread/765160)
- **Passing once is no guarantee:** a forum commenter warns that passing an earlier review does not mean the issue won't come up next time. — [Apple Developer Forums search results](https://developer.apple.com/forums/thread/692065) (summary)

### Inferences
- **Recommended CoursePro flow:**
  - Path: Settings > Account > "Delete Account" (red, destructive), reachable in two taps from the main settings screen.
  - Show a confirmation sheet listing what is deleted: the profile, saved progress, push subscriptions, the stored Canvas token, and study data.
  - Tap "Delete", optionally after re-authentication.
  - The server deletes the data. For Sign in with Apple users, it also revokes Apple tokens.
  - The app signs out and shows "Your account has been deleted."
- **Canvas data:** the Canvas account itself belongs to the school and is not CoursePro's to delete. Deleting the CoursePro copy of Canvas data and the stored Canvas API token is what counts. Say in the UI that the school Canvas account is unaffected.
- **Review notes:** in App Review notes, say where the delete button is and give a demo account the reviewer can delete. The rejection template asks for the location.
- **Supabase implementation:** deleting the auth user requires the service-role key, so it must run server-side (an edge function or Worker route), not in the client. This comes from general Supabase knowledge and was not re-verified in this session.

### Gaps
- No Apple source sets a maximum number of taps or an exact required location beyond "easy to find … typically … account settings."
- Whether an in-app `SFSafariViewController` link to a web deletion page counts as "within the app" was left unresolved in forum threads. The safest choice is a fully native deletion flow.

## 5. Sign in with Apple token revocation on deletion, and how Supabase handles it

### Takeaway
Supabase Auth does not revoke Apple tokens and does not store them. Native `signInWithIdToken` never exchanges Apple's authorization code. So CoursePro's backend must revoke the tokens itself:
1. Get `authorizationCode` from the native credential.
2. Exchange it at `https://appleid.apple.com/auth/token`, using a `client_secret` JWT signed with the Sign in with Apple `.p8` key and `sub` set to the bundle ID.
3. Call `https://appleid.apple.com/auth/revoke` with the refresh or access token. Do this at deletion time, or exchange at sign-up and store the refresh token for later.

### Cited Findings
- **Only programmatic path:** "The Token revocation endpoint (`/auth/revoke`) is the only way to programmatically invalidate user tokens associated to your developer account without user interaction … either a valid refresh token or access token for invalidation is required." — [TN3194 (first published 2025-10-03)](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- **No token? Deletion is still required.** "If you don't have the user's refresh token, access token, or authorization code, you must still fulfill the user's account deletion request." The manual fallback:
  1. Delete the data.
  2. "Direct the user to manually revoke access" (https://support.apple.com/en-us/102571).
  3. Respond to the credential-revoked notification.
  - Source: [TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- **Why revocation matters:** "If the manual token revocation isn't completed, the next time the user authenticates … they won't be presented with the initial authorization flow to enter their full name, email address, or both," and the system may show "Continue with Apple." — [TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- **TN3194's recommended account-creation flow:**
  1. Send the identity token and authorization code to your server.
  2. Validate the code with `/auth/token`.
  3. "securely store the token response — including the identity token, refresh token, and access token."
  4. Validate the refresh token "up to once per day."
  - Source: [TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- **Revoke endpoint:** `POST https://appleid.apple.com/auth/revoke`, form-encoded, with `client_id`, `client_secret`, `token`, and `token_type_hint=refresh_token|access_token`. It "returns a `200` response code without a response body after the server invalidates the `token` value, or if the `token` value was previously invalidated." — [Token revocation](https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens)
- **Token endpoint:** `POST https://appleid.apple.com/auth/token`.
  - Exchange a code with `client_id`, `client_secret`, `code`, and `grant_type=authorization_code`. Include `redirect_uri` "only if the application provided a `redirect_uri` in the initial authorization request", so omit it for native.
  - The response includes `access_token` (`expires_in` 3600), `refresh_token`, and `id_token`.
  - Source: [Token validation](https://developer.apple.com/documentation/signinwithapplerestapi/generate-and-validate-tokens)
- **`client_secret` JWT format:**
  - Header: `alg` ES256 and `kid` (the 10-character key ID).
  - Claims: `iss` (Team ID), `iat`, `exp`, `aud` `https://appleid.apple.com`, and `sub` ("use the same App ID or Services ID that you use as the `client_id`… case-sensitive").
  - "It's an error to request an expiration time more than `15777000` seconds (six months) in the future."
  - Source: Apple's client-secret page, which Sign in with Apple's configuration docs link to. — [Creating a client secret](https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret); [Configuring your environment](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple)
- **Key facts:**
  - "Each primary app can have a maximum of two private keys."
  - The key signs the tokens used "when generating and validating tokens for user authentication, app transfer, and user migration."
  - Source: [Configuring your environment](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple)
- **Matching `client_id` and a pitfall:**
  - Forum posts say the `client_id` used for revocation must match the one used during authorization. For a native app that is the bundle ID.
  - One developer got a 200 response while the app stayed listed under "Apps Using Apple ID." The cause was an invalid token.
  - Sources: [Apple Developer Forums 708415](https://developer.apple.com/forums/thread/708415), [707181](https://developer.apple.com/forums/thread/707181), [844628](https://developer.apple.com/forums/thread/844628) (via search summaries)
- **Supabase's position (issue #1308, "Revoke Sign in with Apple tokens"):**
  - The issue was closed as "not planned" on Dec 19, 2023. The maintainer wrote: "deleting a user from Supabase Auth is not equivalent to deleting a user from your app", "Supabase Auth does not keep track of provider refresh and access tokens", and "you should implement the behavior in your app."
  - The community workaround is an edge function that revokes both tokens with Apple and then deletes the user. Its author warned: "This is not an atomic operation."
  - Source: [supabase/auth #1308](https://github.com/supabase/auth/issues/1308)
- **Swift SDK returns no Apple tokens (issue #2155, opened Sep 7, 2025, still open, labeled bug):**
  - After `signInWithIdToken` with Apple, "`providerAccessToken` and `providerRefreshToken` are nil." The reporter notes that authorization codes are one-time use.
  - No maintainer response was visible.
  - Source: [supabase/auth #2155](https://github.com/supabase/auth/issues/2155)
- **Other projects using Supabase** track the same work: "revoke Sign in with Apple tokens on account deletion." — [JakubAnderwald/drafto #705](https://github.com/JakubAnderwald/drafto/issues/705), [peter-trost/emotely #193](https://github.com/peter-trost/emotely/issues/193)
- **Supabase source confirms the native flow only validates the token:** the id_token grant checks the token's signature, audience, and nonce, and never contacts Apple's token endpoint. The audience must match one of the configured Apple Client IDs. — [supabase/auth internal/api/token_oidc.go](https://github.com/supabase/auth/blob/master/internal/api/token_oidc.go)
- **Native revocation events:**
  - Observe `ASAuthorizationAppleIDProvider.credentialRevokedNotification` and check `getCredentialState(forUserID:)`.
  - "When a user permanently deletes their Apple Account … For native apps, the system doesn't send a credentialRevokedNotification. Use getCredentialState(forUserID:completion:)."
  - Sources: [TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple); [Processing changes for Sign in with Apple accounts](https://developer.apple.com/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts)

### Inferences
Two workable designs for CoursePro.

**(A) Re-authenticate at deletion. Simplest, and nothing to store.**
- When the user confirms deletion, run `ASAuthorizationAppleIDProvider().createRequest()` again to get a fresh `authorizationCode`. It is valid for about 5 minutes and single-use.
- Send it, with the user's Supabase JWT, to a server route. The route then:
  1. Mints a `client_secret` JWT (ES256, `sub` = bundle ID).
  2. Exchanges the code at `/auth/token`.
  3. Revokes the returned `refresh_token`.
  4. Deletes the Supabase user and data with the service role.
- This matches the second workaround discussed in the GitHub threads.

**(B) Exchange at sign-up and store the refresh token.**
- At first sign-in, send `credential.authorizationCode` to the backend, exchange it, and store the refresh token encrypted. At deletion, revoke it.
- This follows TN3194's recommended pattern.
- The #2155 reporter worried that exchanging the code would stop Supabase accepting the identity token. That is likely unfounded: the identity token is a separately signed JWT that Supabase validates on its own, and the code is a different credential. This was not verified by testing.

**Notes for either design:**
- Mint the `client_secret` fresh for each request on the server, with a short `exp`. That avoids the 6-month rotation chore entirely.
- The `.p8` key must live only server-side, as a Worker or edge-function secret.
- The AGENTS.md rules for this repo say `src/` server code runs on Cloudflare Workers. ES256 signing must therefore use WebCrypto (`crypto.subtle.importKey` with `pkcs8`, `ECDSA` P-256), not Node `crypto`.
- If revocation fails (the user cancels re-auth, or there is a network error), still delete the account. Then tell the user to remove CoursePro under Settings > Apple Account > Sign in with Apple. That is TN3194's fallback.

### Gaps
- No App Review rejection I found cites missing `/auth/revoke` specifically. Apple's wording is "should use," and reviewers cannot easily see server-side revocation. It is still documented Apple guidance and affects the re-sign-up experience.
- I could not access GitHub's API (proxy 403) to check for maintainer replies on #2155 after the captured page. The issue appeared open with no linked PR.
- I did not test whether exchanging the authorization code before or after `signInWithIdToken` causes any Supabase error.

## 6. Supabase native Sign in with Apple setup: signInWithIdToken, nonce, IDs, .p8, 6-month expiry

### Takeaway
For a native-only iOS app:
- Enable the Apple provider in Supabase.
- Put the app's bundle ID (App ID) in "Client IDs".
- Leave the OAuth secret blank. Native-only sign-in needs no Services ID, `.p8`, or 6-month secret rotation.
- Pass the raw nonce to Supabase and the SHA-256 hex of that nonce to Apple.

Token revocation (section 5) still needs a `.p8` on your own backend.

### Cited Findings
These are from the [Supabase docs: Login with Apple (mdx source, master)](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/social-login/auth-apple.mdx) unless another source is named.
- **Swift native configuration:**
  1. "Have an App ID … Make sure you configure Sign in with Apple for the App ID … in the Capabilities list. At this time Supabase Auth does not support Server-to-Server notification endpoints, so you should leave that setting blank."
  2. "Register all of the App IDs that will be using your Supabase project in the Apple provider configuration in the Supabase dashboard under Client IDs."
  - Note: "If you're building a native app only, you do not need to configure the OAuth settings."
- **Secret rotation applies only to OAuth:** "If you're using the OAuth flow (web, Flutter web, Kotlin non-iOS platforms), Apple requires you to generate a new secret key every 6 months using the signing key (`.p8` file) … This requirement only applies if you're configuring OAuth settings (Services ID, signing key, etc.). Native-only implementations don't require secret key rotation."
- **If you also have a web login:**
  - Use a Services ID (for example `com.example.app.web`) whose website URL is `<project-id>.supabase.co` and redirect `https://<project-id>.supabase.co/auth/v1/callback`.
  - "list this Services ID as the **first** entry in the Client IDs field. Supabase uses the first client ID in the list for the web `signInWithOAuth` flow, while the native `signInWithIdToken` flow accepts any client ID in the list as a valid token audience … If a native App ID comes before the Services ID, native sign-in keeps working but web sign-in is rejected by Apple."
- **Swift sample:**
  - `SignInWithAppleButton { request in request.requestedScopes = [.email, .fullName] }`
  - then `client.auth.signInWithIdToken(credentials: .init(provider: .apple, idToken: idToken))`
  - then, if `credential.fullName` is present, `client.auth.update(user: UserAttributes(data: ["full_name": …, "given_name": …, "family_name": …]))`
  - The Swift sample omits the nonce. The Flutter sample shows the nonce pattern: `rawNonce = generateRawNonce()`, `hashedNonce = sha256(rawNonce)` sent to Apple, and `rawNonce` passed to `signInWithIdToken`.
- **How Supabase checks the nonce (server source):**
  - If the token has a nonce but the request doesn't (or the reverse), it fails with "Passed nonce and nonce in id_token should either both exist or not."
  - When both exist, it computes `hash := fmt.Sprintf("%x", sha256.Sum256([]byte(params.Nonce)))` and requires `hash == idToken.Nonce`, otherwise "Nonces mismatch."
  - So the app sets `request.nonce = sha256Hex(raw)` and passes `nonce: raw` to Supabase.
  - The audience must match one of the configured Apple Client IDs ("Unacceptable audience in id_token").
  - Source: [supabase/auth token_oidc.go](https://github.com/supabase/auth/blob/master/internal/api/token_oidc.go)
- **Apple on the nonce:** "associate a client session with an ID token using the `nonce` value." — [Authenticating users with Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple)
- **Signed-in Apple Account only:** "Native apps only allow the signed-in iCloud user to use Sign in with Apple." — [Authenticating users with Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple)

### Inferences
- **Nonce:** generate 32 random bytes with `SecRandomCopyBytes`. Set `request.nonce = SHA256(raw).hexLowercase` using CryptoKit, then call `signInWithIdToken(credentials: .init(provider: .apple, idToken: idToken, nonce: raw))`. The hex must be lowercase to match Go's `%x`.
- **Debug and staging builds:** if they use a different bundle ID, add each one to Client IDs. Otherwise sign-in fails with an audience error.
- **The `.p8` is still needed for revocation (section 5):** even with native-only sign-in, the `.p8` key, Key ID, and Team ID must be stored as backend secrets.

### Gaps
- I did not fetch the live supabase.com page (DNS failure in the sandbox). Findings come from the docs source on GitHub master, which should match the live site.

## 7. Entitlement, capability, and server-to-server notifications: required or recommended?

### Takeaway
- **Required:** the Sign in with Apple capability on the App ID and the `com.apple.developer.applesignin` entitlement (Xcode adds both).
- **Recommended, not required by any guideline:** the server-to-server notification endpoint. Supabase can't receive these notifications, so it says to leave the field blank. A custom endpoint is optional.
- **On device:** checking `getCredentialState` at launch is the practical equivalent and is cheap to add.

### Cited Findings
- **Entitlement:** "An entitlement that lets your app use Sign in with Apple. To add this entitlement to your app with the correct associated value, enable the Sign in with Apple capability in Xcode." — [Sign in with Apple Entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.applesignin)
- **App ID setup:** enable the capability in Xcode or in Certificates, Identifiers & Profiles, as a primary App ID or grouped with an existing primary App ID. "App grouping ensures that users need to provide consent to share their information only once for each group." — [Configuring your environment](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple)
- **Notification endpoint, Apple's wording:**
  - "To receive important updates about your users and their accounts, enable the Sign in with Apple server-to-server notification endpoint. Your server must support TLS 1.2 or later … Each app group registers one absolute URL." — [Configuring your environment](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple)
  - "Apple can alert you when these changes occur" — [Processing changes](https://developer.apple.com/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts)
  - The deletion page says: "Use server-to-server notification endpoints to process changes for Sign in with Apple accounts." — [Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- **Event types:** `email-disabled`, `email-enabled`, `consent-revoked`, and `account-deleted`. These are the exact strings in Apple's sample payloads (note: `account-deleted`, with a d). Payloads are JWS-signed and must be checked against Apple's public keys. The payload includes `sub`, plus `email` and `is_private_email` for email events. — [Processing changes for Sign in with Apple accounts](https://developer.apple.com/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts)
- **Supabase:** "At this time Supabase Auth does not support Server-to-Server notification endpoints, so you should leave that setting blank." — [Supabase docs mdx](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/social-login/auth-apple.mdx)

### Inferences
- **No review requirement found:** nothing in the guidelines makes the notification endpoint mandatory, and I found no rejection for lacking one.
- **What to implement:**
  - In the app, call `getCredentialState(forUserID:)` on launch and observe `credentialRevokedNotification`. On `.revoked` or `.notFound`, sign out of Supabase and clear local data.
  - Optionally, add a Worker route that verifies the JWS and deletes or flags the user on `consent-revoked` or `account-deleted`. To do that, store Apple's `sub` (in Supabase `auth.identities.provider_id` / `identity_data.sub`).
- **The bundle ID cannot be changed later** without migration (TN3159 covers app transfers), so choose the final bundle ID before launch.

### Gaps
- I found no source saying App Review checks for the server-to-server endpoint.

## 8. Recent (2024–2026) rejection reports for 4.8 and 5.1.1(v)

### Takeaway
The recent rejections follow standard templates. 4.8 rejections say "uses a third-party login service like Google … does not appear to offer an equivalent login option with Sign in with Apple." 5.1.1(v) rejections say "supports account creation but does not include an option to initiate account deletion." The usual fixes are to add Sign in with Apple, or to reply in App Store Connect explaining the exemption or where deletion is.

### Cited Findings
- **4.8 (Oct 2024):** full template quoted in section 1, ending "Note that Sign in with Apple meets the requirements specified in guideline 4.8." Follow-up replies through Mar 2025 had no resolution. — [Forums 765145](https://developer.apple.com/forums/thread/765145)
- **Other 4.8 threads, 2024:** [750911](https://developer.apple.com/forums/thread/750911), [760302](https://developer.apple.com/forums/thread/760302), [760974 (paired with 3.1.1)](https://developer.apple.com/forums/thread/760974). Thread 760974 quotes the three privacy criteria in the rejection.
- **A 2025 thread combining 3.2, 4.8, and 5.1.1** for an "enterprise-privilege login app" shows reviewers checking the enterprise exemption. — [Forums 801768](https://developer.apple.com/forums/thread/801768) (title seen via search; not opened)
- **5.1.1(v) (Oct 2024):** full template quoted in section 4. — [Forums 765160](https://developer.apple.com/forums/thread/765160)
- **4.0 for asking name/email after Sign in with Apple (May 2023):** — [Forums 730223](https://developer.apple.com/forums/thread/730223)

### Inferences
- **First-submission checklist:**
  1. If Google sign-in exists, Sign in with Apple is present and at least as prominent.
  2. No forced name, email, or password step after Sign in with Apple.
  3. Account deletion is in Settings > Account, fully in-app, with confirmation and a clear retention notice.
  4. Review notes give the deletion path and a demo account.
  5. Screenshots show the current login options.
  6. If you rely on an exemption, state it in the review notes.

### Gaps
- The forum threads rarely record how the rejection was resolved, and App Review does not publish rejection statistics. I found no 2026-dated rejection reports in search.
