import SwiftUI
import Combine
import UserNotifications

struct NativeRootView: View {
    @StateObject private var sessionStore = NativeSessionStore()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showingLaunch = true
    @AppStorage("CanvasProColorScheme") private var colorScheme = "dark"
    @AppStorage("CanvasProPalette") private var palette = "forest"

    private var userID: String? { sessionStore.session?.user.id }

    var body: some View {
        ZStack {
            Group {
                if sessionStore.session != nil {
                    NativeMainTabView(sessionStore: sessionStore)
                        .id(userID)
                        .transition(.opacity)
                } else {
                    NativeAuthView(sessionStore: sessionStore)
                        .transition(.opacity)
                }
            }
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.24), value: userID)
            .allowsHitTesting(!showingLaunch)
            .accessibilityHidden(showingLaunch)
            .environment(\.nativeLaunchIsVisible, showingLaunch)
            if showingLaunch {
                NativeLaunchView(isSignedIn: sessionStore.session != nil) { finishLaunch() }
                    .transition(.opacity.combined(with: .scale(scale: 1.04)))
                    .zIndex(1)
            }
        }
        .task {
            do {
                // The brand animation plays while the signed-in screens are already
                // built underneath and loading Canvas. Nothing here waits on the network.
                try await Task.sleep(for: .milliseconds(reduceMotion ? 1200 : 3800))
                guard !Task.isCancelled else { return }
                finishLaunch()
            } catch { /* View removal cancels launch. */ }
        }
        .cpFont(12)
        .modifier(CPThemeModifier(palette: CPPalette(rawValue: palette) ?? .forest))
        .environment(\.cpPalette, palette)
        .preferredColorScheme(colorScheme == "dark" ? .dark : colorScheme == "light" ? .light : nil)
        // Every screen scales with Text Size; the largest accessibility sizes are
        // capped where fixed-width rows would stop fitting on an iPhone.
        .dynamicTypeSize(...DynamicTypeSize.accessibility3)
    }

    private func finishLaunch() {
        guard showingLaunch else { return }
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.45)) {
            showingLaunch = false
        }
    }
}

private struct NativeLaunchVisibilityKey: EnvironmentKey {
    static let defaultValue = false
}

private extension EnvironmentValues {
    var nativeLaunchIsVisible: Bool {
        get { self[NativeLaunchVisibilityKey.self] }
        set { self[NativeLaunchVisibilityKey.self] = newValue }
    }
}

/// The deep forest colors behind the launch and sign-in screens. The static
/// LaunchScreen storyboard uses the same base, so there is no flash on open.
private enum NativeBrandColors {
    static let base = Color(red: 0, green: 0.184, blue: 0.125)
    static let deep = Color(red: 0, green: 0.105, blue: 0.072)
    static let mint = Color(red: 0.49, green: 0.84, blue: 0.65)
    static let teal = Color(red: 0.30, green: 0.72, blue: 0.70)
}

/// The CanvasPro mark: three rising bars inside a ring. With `animate`, the bars
/// grow in one by one and the ring draws itself around them.
private struct NativeBrandMark: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var size: CGFloat = 120
    var animate = false
    var delay: Double = 0
    @State private var appeared = false
    private let heights: [CGFloat] = [0.32, 0.70, 0.51]

    var body: some View {
        let shown = !animate || reduceMotion || appeared
        ZStack {
            Circle()
                .fill(RadialGradient(colors: [NativeBrandColors.mint.opacity(0.22), .clear], center: .center, startRadius: 0, endRadius: size * 0.55))
                .frame(width: size * 1.1, height: size * 1.1)
                .scaleEffect(shown ? 1 : 0.6)
                .opacity(shown ? 1 : 0)
                .animation(reduceMotion ? nil : .easeOut(duration: 1.2).delay(delay), value: appeared)
            Circle()
                .stroke(Color.white.opacity(0.10), lineWidth: size * 0.025)
            Circle()
                .trim(from: 0, to: shown ? 1 : 0)
                .stroke(AngularGradient(colors: [NativeBrandColors.mint, NativeBrandColors.teal, NativeBrandColors.mint], center: .center), style: StrokeStyle(lineWidth: size * 0.025, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(reduceMotion ? nil : .easeInOut(duration: 1.1).delay(delay + 0.35), value: appeared)
            HStack(alignment: .bottom, spacing: size * 0.075) {
                ForEach(0..<3, id: \.self) { index in
                    RoundedRectangle(cornerRadius: size * 0.05, style: .continuous)
                        .fill(index == 1 ? NativeBrandColors.mint : Color.white)
                        .frame(width: size * 0.15, height: size * heights[index])
                        .scaleEffect(x: 1, y: shown ? 1 : 0.15, anchor: .bottom)
                        .opacity(shown ? 1 : 0)
                        .animation(reduceMotion ? nil : .spring(duration: 0.6, bounce: 0.2).delay(delay + 0.1 + Double(index) * 0.12), value: appeared)
                }
            }
            .rotationEffect(.degrees(-16))
            .offset(y: size * 0.02)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
        .onAppear { if animate { appeared = true } }
    }
}

/// Plays for about four seconds when the app opens. The signed-in app is already
/// built underneath and loading Canvas, so the wait is never wasted. Tap to skip.
private struct NativeLaunchView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let isSignedIn: Bool
    let onSkip: () -> Void
    @State private var appeared = false
    private let word = Array("CanvasPro")

    var body: some View {
        let shown = reduceMotion || appeared
        ZStack {
            LinearGradient(colors: [NativeBrandColors.base, NativeBrandColors.deep], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
            // Two slow glows drift for the whole animation.
            Circle()
                .fill(RadialGradient(colors: [NativeBrandColors.mint.opacity(0.16), .clear], center: .center, startRadius: 0, endRadius: 220))
                .frame(width: 440, height: 440)
                .offset(x: appeared ? 90 : -110, y: appeared ? -230 : -300)
                .animation(reduceMotion ? nil : .easeInOut(duration: 4), value: appeared)
            Circle()
                .fill(RadialGradient(colors: [NativeBrandColors.teal.opacity(0.12), .clear], center: .center, startRadius: 0, endRadius: 240))
                .frame(width: 480, height: 480)
                .offset(x: appeared ? -100 : 120, y: appeared ? 280 : 340)
                .animation(reduceMotion ? nil : .easeInOut(duration: 4), value: appeared)

            VStack(spacing: 56) {
                NativeBrandMark(size: 112, animate: true, delay: 0.15)
                VStack(spacing: 14) {
                    HStack(spacing: 0) {
                        ForEach(word.indices, id: \.self) { index in
                            Text(String(word[index]))
                                .cpFont(32, .semibold)
                                .tracking(-0.5)
                                .foregroundStyle(.white)
                                .opacity(shown ? 1 : 0)
                                .offset(y: shown ? 0 : 10)
                                .blur(radius: shown ? 0 : 6)
                                .animation(reduceMotion ? nil : .easeOut(duration: 0.45).delay(1.2 + Double(index) * 0.05), value: appeared)
                        }
                    }
                    Text("A little less chaos. A little more clarity.")
                        .cpFont(13)
                        .foregroundStyle(.white.opacity(0.68))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                        .opacity(shown ? 1 : 0)
                        .offset(y: shown ? 0 : 6)
                        .animation(reduceMotion ? nil : .easeOut(duration: 0.6).delay(1.95), value: appeared)
                }
            }
            .offset(y: -30)
        }
        .overlay(alignment: .bottom) {
            VStack(spacing: 10) {
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.12))
                    Capsule().fill(NativeBrandColors.mint)
                        .frame(width: shown ? 132 : 0)
                        .animation(reduceMotion ? nil : .easeInOut(duration: 3.4).delay(0.2), value: appeared)
                }
                .frame(width: 132, height: 3)
                Text(isSignedIn ? "Syncing your classes" : "Getting things ready")
                    .cpFont(11, .medium)
                    .foregroundStyle(.white.opacity(0.55))
            }
            .opacity(shown ? 1 : 0)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.4).delay(0.6), value: appeared)
            .padding(.bottom, 56)
        }
        .contentShape(Rectangle())
        .onTapGesture { onSkip() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(isSignedIn ? "CanvasPro. Syncing your classes." : "CanvasPro. Loading.")
        .accessibilityAction(named: "Skip") { onSkip() }
        // The wordmark is one line of fixed artwork; huge text sizes would push it into the logo.
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
        .task { appeared = true }
    }
}

private struct NativeAuthView: View {
    enum Mode: Equatable { case signIn, signUp }
    private enum Field: Hashable { case firstName, lastName, email, password }
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.dynamicTypeSize) private var typeSize
    @ObservedObject var sessionStore: NativeSessionStore
    @FocusState private var focusedField: Field?
    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var ageConfirmed = false
    @State private var legalAccepted = false
    @State private var notice: String?
    @State private var showReset = false

    private var identifierIsValid: Bool {
        let value = email.trimmingCharacters(in: .whitespacesAndNewlines)
        if mode == .signUp { return value.range(of: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", options: .regularExpression) != nil }
        return value.contains("@") || value.lowercased().range(of: "^[a-z0-9_]{3,24}$", options: .regularExpression) != nil
    }

    private var canSubmit: Bool {
        identifierIsValid &&
        !password.isEmpty && !sessionStore.isWorking && sessionStore.api != nil &&
        (mode == .signIn || (password.count >= 6 &&
            !firstName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            !lastName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && ageConfirmed && legalAccepted))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    hero
                    formCard
                        .padding(.horizontal, 16)
                        .offset(y: -28)
                        .padding(.bottom, -28)
                    NativeLegalLinks(compact: false)
                        .foregroundStyle(CPTheme.muted(scheme))
                        .padding(.top, 18)
                        .padding(.bottom, 28)
                }
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(CPTheme.background(scheme).ignoresSafeArea())
            .foregroundStyle(CPTheme.foreground(scheme))
            .toolbar(.hidden, for: .navigationBar)
            .onChange(of: mode) { _, _ in sessionStore.errorMessage = nil }
            .sheet(isPresented: $showReset) { PasswordResetSheet(sessionStore: sessionStore, email: email) }
        }
    }

    /// The branded top of the page, in the launch screen's colors, with a small
    /// preview of the app.
    private var hero: some View {
        VStack(alignment: .leading, spacing: 28) {
            HStack(spacing: 10) {
                NativeBrandMark(size: 34)
                Text("CanvasPro").cpFont(16, .semibold).tracking(-0.3).foregroundStyle(.white)
                Spacer()
            }
            VStack(alignment: .leading, spacing: 8) {
                Text(mode == .signIn ? "Welcome back." : "Make room for\nwhat matters.")
                    .cpFont(typeSize.isAccessibilitySize ? 26 : 30, .semibold).tracking(-0.9)
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text(mode == .signIn ? "A little less chaos. A little more clarity." : "Your classes, deadlines, and study time. Together.")
                    .cpFont(13)
                    .foregroundStyle(.white.opacity(0.72))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 28)
        .padding(.bottom, 60)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            ZStack {
                LinearGradient(colors: [NativeBrandColors.base, NativeBrandColors.deep], startPoint: .top, endPoint: .bottom)
                Circle()
                    .fill(RadialGradient(colors: [NativeBrandColors.mint.opacity(0.20), .clear], center: .center, startRadius: 0, endRadius: 200))
                    .frame(width: 400, height: 400)
                    .offset(x: 150, y: -120)
            }
            .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 32, bottomTrailingRadius: 32, style: .continuous))
            .ignoresSafeArea(edges: .top)
        }
        .animation(.easeInOut(duration: 0.25), value: mode)
    }

    private var formCard: some View {
        VStack(alignment: .leading, spacing: 22) {
            CPSegmented(selection: Binding(get: { mode == .signIn ? "Sign in" : "Create account" }, set: { value in
                focusedField = nil
                notice = nil
                password = ""
                mode = value == "Sign in" ? .signIn : .signUp
            }), options: ["Sign in", "Create account"], label: "Sign in or create an account")
            .disabled(sessionStore.isWorking)
            fields
            if mode == .signIn {
                Button("Forgot password?") {
                    focusedField = nil
                    sessionStore.errorMessage = nil
                    showReset = true
                }
                .cpFont(12, .semibold)
                .foregroundStyle(CPTheme.primary(scheme: scheme))
                .frame(maxWidth: .infinity, minHeight: 32, alignment: .trailing)
                .disabled(sessionStore.isWorking)
            } else {
                signupDetails
            }
            if let notice { NativeAuthMessage(text: notice, isError: false) }
            if let error = sessionStore.errorMessage ?? sessionStore.configurationError {
                NativeAuthMessage(text: error, isError: true)
            }
            Button(action: submit) {
                NativeAuthActionLabel(title: mode == .signIn ? "Sign in" : "Create account", isWorking: sessionStore.isWorking)
            }
            .buttonStyle(CPPressStyle())
            .disabled(!canSubmit)
        }
        .padding(22)
        .cpSurface(strong: true, radius: 24)
        .shadow(color: Color.black.opacity(scheme == .dark ? 0.35 : 0.10), radius: 24, y: 10)
        .animation(.easeInOut(duration: 0.22), value: mode)
    }

    private var fields: some View {
        VStack(spacing: 16) {
            if mode == .signUp {
                firstNameField
                lastNameField
            }
            NativeAuthField(title: mode == .signIn ? "Email or username" : "Email", symbol: mode == .signIn ? "person" : "envelope", focused: focusedField == .email) {
                TextField(mode == .signIn ? "you@example.com or username" : "you@example.com", text: $email)
                    .textContentType(mode == .signIn ? .username : .emailAddress).keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .focused($focusedField, equals: .email).submitLabel(.next)
                    .onSubmit { focusedField = .password }
                    .accessibilityLabel(mode == .signIn ? "Email or username" : "Email")
            }
            NativeAuthField(title: "Password", symbol: "lock", focused: focusedField == .password) {
                HStack(spacing: 8) {
                    Group {
                        if showPassword {
                            TextField(mode == .signIn ? "Enter your password" : "At least 6 characters", text: $password)
                                .textInputAutocapitalization(.never).autocorrectionDisabled()
                        } else {
                            SecureField(mode == .signIn ? "Enter your password" : "At least 6 characters", text: $password)
                        }
                    }
                    .textContentType(mode == .signIn ? .password : .newPassword)
                    .focused($focusedField, equals: .password).submitLabel(.go)
                    .onSubmit { submit() }.accessibilityLabel("Password")
                    Button { showPassword.toggle() } label: {
                        Image(systemName: showPassword ? "eye.slash" : "eye").cpIconFont(13).foregroundStyle(CPTheme.muted(scheme))
                            .frame(width: 36, height: 36).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(showPassword ? "Hide password" : "Show password")
                }
            }
            if mode == .signUp && !password.isEmpty && password.count < 6 {
                Text("Use at least 6 characters.").cpFont(11).foregroundStyle(CPTheme.muted(scheme))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .disabled(sessionStore.isWorking)
    }

    private var firstNameField: some View {
        NativeAuthField(title: "First name", symbol: nil, focused: focusedField == .firstName) {
            TextField("First name", text: $firstName).textContentType(.givenName)
                .focused($focusedField, equals: .firstName).submitLabel(.next)
                .onSubmit { focusedField = .lastName }.accessibilityLabel("First name")
        }
    }

    private var lastNameField: some View {
        NativeAuthField(title: "Last name", symbol: nil, focused: focusedField == .lastName) {
            TextField("Last name", text: $lastName).textContentType(.familyName)
                .focused($focusedField, equals: .lastName).submitLabel(.next)
                .onSubmit { focusedField = .email }.accessibilityLabel("Last name")
        }
    }

    private var signupDetails: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(spacing: 0) {
                NativeAuthConsent(title: "I am at least 13 years old", isOn: $ageConfirmed)
                CPRowDivider(leading: 34)
                NativeAuthConsent(title: "I agree to the Terms of Service and Privacy Policy", isOn: $legalAccepted)
            }
            .padding(.horizontal, 12)
            .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: CPLayout.innerRadius, style: .continuous))
        }
        .disabled(sessionStore.isWorking)
    }

    private func submit() {
        guard canSubmit else { return }
        focusedField = nil
        notice = nil
        Task {
            if mode == .signIn { await sessionStore.signIn(identifier: email, password: password) }
            else {
                let now = ISO8601DateFormatter().string(from: Date())
                let cleanFirst = firstName.trimmingCharacters(in: .whitespacesAndNewlines)
                let cleanLast = lastName.trimmingCharacters(in: .whitespacesAndNewlines)
                let metadata: [String: Any] = [
                    "first_name": cleanFirst, "last_name": cleanLast, "full_name": "\(cleanFirst) \(cleanLast)",
                    "profile_setup_prompted": true, "profile_setup_completed": true,
                    "age_13_or_older_confirmed": true, "age_confirmation_version": 1, "age_confirmed_at": now,
                    "terms_accepted_version": "2026-09-28", "privacy_accepted_version": "2026-09-28", "legal_accepted_at": now,
                ]
                if await sessionStore.signUp(email: email, password: password, metadata: metadata) {
                    notice = "Check your email to verify your account, then sign in."
                    password = ""
                    mode = .signIn
                }
            }
        }
    }
}

private struct NativeAuthBrand: View {
    var body: some View {
        HStack(spacing: 10) {
            NativeBrandMark(size: 34)
                .padding(4)
                .background(NativeBrandColors.base, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            Text("CanvasPro").cpFont(16, .semibold).tracking(-0.3)
        }
        .padding(.bottom, 4)
    }
}

private struct NativeAuthField<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let title: String
    let symbol: String?
    var focused = false
    let content: Content
    init(title: String, symbol: String?, focused: Bool = false, @ViewBuilder content: () -> Content) {
        self.title = title; self.symbol = symbol; self.focused = focused; self.content = content()
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).cpFont(11, .semibold).foregroundStyle(focused ? CPTheme.primary(scheme: scheme) : CPTheme.muted(scheme)).accessibilityHidden(true)
            HStack(spacing: 10) {
                if let symbol {
                    Image(systemName: symbol).cpIconFont(13).foregroundStyle(focused ? CPTheme.primary(scheme: scheme) : CPTheme.muted(scheme)).accessibilityHidden(true)
                }
                content.cpFont(14).frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 48)
            .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).strokeBorder(focused ? CPTheme.primary(scheme: scheme) : CPTheme.insetBorder(scheme), lineWidth: focused ? 1.5 : 1))
            .animation(.easeInOut(duration: 0.15), value: focused)
        }
    }
}

private struct NativeAuthActionLabel: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let title: String
    let isWorking: Bool
    var body: some View {
        HStack(spacing: 10) {
            if isWorking { ProgressView().tint(CPTheme.onPrimary(scheme)) }
            Text(isWorking ? "Please wait…" : title).cpFont(14, .semibold)
            if !isWorking { Image(systemName: "arrow.right").cpIconFont(12, .bold) }
        }
        .frame(maxWidth: .infinity, minHeight: 50)
        .foregroundStyle(CPTheme.onPrimary(scheme))
        .background(CPTheme.primary(scheme: scheme), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct NativeAuthConsent: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let title: String
    @Binding var isOn: Bool
    var body: some View {
        Button { isOn.toggle() } label: {
            HStack(alignment: .center, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .strokeBorder(isOn ? Color.clear : CPTheme.muted(scheme).opacity(0.6), lineWidth: 1.5)
                    if isOn {
                        RoundedRectangle(cornerRadius: 6, style: .continuous).fill(CPTheme.primary(scheme: scheme))
                        Image(systemName: "checkmark").cpIconFont(10, .bold).foregroundStyle(CPTheme.onPrimary(scheme))
                    }
                }
                .frame(width: 22, height: 22)
                Text(title).cpFont(12).foregroundStyle(CPTheme.foreground(scheme))
                    .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }.frame(maxWidth: .infinity, minHeight: 46, alignment: .leading)
        }
        .buttonStyle(CPPressStyle())
        .accessibilityLabel(title).accessibilityValue(isOn ? "Selected" : "Not selected")
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }
}

private struct NativeAuthMessage: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let text: String
    let isError: Bool
    var body: some View {
        Label(text, systemImage: isError ? "exclamationmark.circle" : "checkmark.circle")
            .cpFont(12).fixedSize(horizontal: false, vertical: true)
            .foregroundStyle(isError ? CPTheme.danger : CPTheme.primary(scheme: scheme))
            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
            .background((isError ? CPTheme.danger : CPTheme.primary(scheme: scheme)).opacity(0.10), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct PasswordResetSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var sessionStore: NativeSessionStore
    @FocusState private var emailFocused: Bool
    @State var email: String
    @State private var sent = false
    private var canSend: Bool {
        !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !sessionStore.isWorking && sessionStore.api != nil && !sent
    }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    NativeAuthBrand()
                    VStack(alignment: .leading, spacing: 10) {
                        Text("A fresh start.").cpFont(26, .semibold).tracking(-0.8)
                        Text("Enter your account email and we’ll send you a password reset link.")
                            .cpFont(13).foregroundStyle(CPTheme.muted(scheme))
                    }
                    NativeAuthField(title: "Email", symbol: "envelope") {
                        TextField("you@example.com", text: $email).textContentType(.emailAddress)
                            .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.emailAddress)
                            .focused($emailFocused).submitLabel(.send).onSubmit { send() }
                    }.disabled(sessionStore.isWorking || sent)
                    if sent { NativeAuthMessage(text: "Check your inbox for your reset link.", isError: false) }
                    if let error = sessionStore.errorMessage ?? sessionStore.configurationError {
                        NativeAuthMessage(text: error, isError: true)
                    }
                    Button(action: send) { NativeAuthActionLabel(title: "Send reset link", isWorking: sessionStore.isWorking) }
                        .buttonStyle(CPPressStyle()).disabled(!canSend)
                }
                .frame(maxWidth: 460).frame(maxWidth: .infinity).padding(24)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(CPBackdrop())
            .foregroundStyle(CPTheme.foreground(scheme))
            .cpNavigationTitle("Reset password").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { sessionStore.errorMessage = nil; dismiss() }.disabled(sessionStore.isWorking)
                }
            }
        }
        .interactiveDismissDisabled(sessionStore.isWorking)
    }
    private func send() {
        guard canSend else { return }
        emailFocused = false
        Task { sent = await sessionStore.sendPasswordReset(email: email) }
    }
}

private enum NativeTab: Hashable { case today, study, grades, assignments, more }

extension Notification.Name {
    static let nativeStudyAssignment = Notification.Name("CanvasProNativeStudyAssignment")
}

struct NativeMainTabView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.nativeLaunchIsVisible) private var launchIsVisible
    @ObservedObject var sessionStore: NativeSessionStore
    @StateObject private var contentStore: NativeContentStore
    @StateObject private var featureStore: NativeFeatureStore
    @State private var selection: NativeTab = .today
    @State private var todaySection = "Dashboard"
    @State private var focusWindow = "7"
    @State private var studyRequest: AssignmentItem?
    @ObservedObject private var router = NativeRouter.shared

    init(sessionStore: NativeSessionStore) {
        self.sessionStore = sessionStore
        _contentStore = StateObject(wrappedValue: NativeContentStore(sessionStore: sessionStore))
        _featureStore = StateObject(wrappedValue: NativeFeatureStore(sessionStore: sessionStore))
    }

    var body: some View {
        nativeTabs
            .task { await refreshAccountData() }
            .onReceive(NotificationCenter.default.publisher(for: .nativeStudyAssignment)) { note in
                guard let item = note.object as? AssignmentItem else { return }
                studyRequest = item
                selection = .study
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    Task { await refreshAccountData() }
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .nativeDeviceToken)) { note in
                guard let deviceToken = note.object as? String else {
                    if let error = note.object as? Error { featureStore.errorMessage = error.localizedDescription }
                    return
                }
                Task { await registerDeviceToken(deviceToken) }
            }
            .onReceive(NotificationCenter.default.publisher(for: .nativeNotificationPath)) { note in
                guard let path = note.object as? String else { return }
                route(to: path)
            }
            // Links (canvaspro://… or canvaspro.app/…) wait in the router until the tabs exist.
            .onAppear { if let path = router.takePendingPath() { route(to: path) } }
            .onChange(of: router.pendingPath) { _, path in
                if path != nil, let next = router.takePendingPath() { route(to: next) }
            }
            .alert("CanvasPro", isPresented: Binding(get: { !launchIsVisible && (contentStore.errorMessage != nil || featureStore.errorMessage != nil) }, set: { if !$0 && !launchIsVisible { contentStore.errorMessage = nil; featureStore.errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: { Text(contentStore.errorMessage ?? featureStore.errorMessage ?? "") }
    }

    /// Shows the tab (and Today section) for a website-style path.
    private func route(to path: String) {
        if path.contains("focus") || path.contains("coming-up") { todaySection = "Coming Up"; selection = .today }
        else if path.contains("get-it-done") { todaySection = "Get It Done"; selection = .today }
        else if path.contains("assignment") { selection = .assignments }
        else if path.contains("grade") { selection = .grades }
        else if path.contains("study") { selection = .study }
        else if path.contains("notification") || path.contains("settings") || path.contains("schedule") || path.contains("calendar") || path.contains("announcement") { selection = .more }
        else { todaySection = "Dashboard"; selection = .today }
    }

    @MainActor private func registerDeviceToken(_ deviceToken: String) async {
        guard featureStore.notificationPreferences.enabled && featureStore.notificationPreferences.browserPush else { return }
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        do {
            try await api.upsertPushToken(deviceToken, token: try await sessionStore.accessToken(), userID: user.id)
            UserDefaults.standard.set(deviceToken, forKey: "CanvasProNativePushToken")
        } catch { featureStore.errorMessage = error.localizedDescription }
    }

    @MainActor private func refreshAccountData() async {
        async let content: Void = contentStore.load()
        async let features: Void = featureStore.load()
        _ = await (content, features)
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        if featureStore.notificationPreferences.enabled && featureStore.notificationPreferences.browserPush &&
            (settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional) {
            UIApplication.shared.registerForRemoteNotifications()
        } else if !featureStore.notificationPreferences.enabled || !featureStore.notificationPreferences.browserPush {
            UIApplication.shared.unregisterForRemoteNotifications()
            if let deviceToken = UserDefaults.standard.string(forKey: "CanvasProNativePushToken"), let api = sessionStore.api {
                do {
                    try await api.deletePushToken(deviceToken, token: try await sessionStore.accessToken())
                    UserDefaults.standard.removeObject(forKey: "CanvasProNativePushToken")
                } catch { featureStore.errorMessage = error.localizedDescription }
            }
        }
    }

    @ViewBuilder private var nativeTabs: some View {
        if #available(iOS 26.0, *) { tabs.tabBarMinimizeBehavior(.onScrollDown) } else { tabs }
    }

    // The standard iOS tab bar, in the website's sidebar order. Calendar,
    // Announcements and Settings live under More.
    private var tabs: some View {
        TabView(selection: $selection) {
            NativeTodayView(store: contentStore, features: featureStore, selection: $selection, section: $todaySection, focusWindow: $focusWindow)
                .tabItem { Label("Today", systemImage: "house") }.tag(NativeTab.today)
            NativeStudyView(store: contentStore, features: featureStore, requestedAssignment: $studyRequest)
                .tabItem { Label("Study Session", systemImage: "timer") }.tag(NativeTab.study)
            NativeGradesView(store: contentStore, features: featureStore)
                .tabItem { Label("Grades", systemImage: "graduationcap") }.tag(NativeTab.grades)
            NavigationStack { NativeAssignmentsView(store: contentStore, features: featureStore) }
                .tabItem { Label("Assignments", systemImage: "checklist") }.tag(NativeTab.assignments)
            NativeMoreView(store: contentStore, features: featureStore, sessionStore: sessionStore)
                .tabItem { Label("More", systemImage: "ellipsis.circle") }.tag(NativeTab.more)
        }
        .sensoryFeedback(.selection, trigger: selection)
    }
}

private struct NativeTodayView: View {
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @Binding var selection: NativeTab
    @Binding var section: String
    @Binding var focusWindow: String

    var body: some View {
        NavigationStack {
            Group {
                if section == "Coming Up" {
                    FocusView(store: store, features: features, window: $focusWindow, section: $section)
                } else if section == "Get It Done" {
                    GetItDoneView(store: store, features: features, section: $section)
                } else {
                    NativeDashboardView(store: store, features: features, selection: $selection, todaySection: $section, focusWindow: $focusWindow)
                }
            }
            // Like the website, the three Today pages share centered tabs at the top
            // of the page; pages opened from them don't show the tabs.
            .cpNavigationTitle("Today")
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}

/// The Today pages' tabs, as on the website: Dashboard, Coming Up, Get It Done.
struct NativeTodayTabs: View {
    @Binding var selection: String
    var body: some View {
        NativePageTabs(selection: $selection, options: ["Dashboard", "Coming Up", "Get It Done"], label: "Today sections")
            .padding(.bottom, 4)
    }
}

private struct NativeDigestSnapshot: Codable {
    var lastVisit: Date
    var grades: [Int: Double]
    var urgency: [Int: String]
}

/// The website's dashboard, one widget per card in the student's saved order.
private struct NativeDashboardView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @Binding var selection: NativeTab
    @Binding var todaySection: String
    @Binding var focusWindow: String
    @AppStorage("CanvasProDismissedAnnouncements") private var dismissedAnnouncementsRaw = ""
    @State private var digest: NativeDigestSnapshot?
    @State private var showCustomize = false
    @State private var expandedUpcoming = Set<Int>()
    @State private var expandedAnnouncements = Set<Int>()
    @State private var showGpaScale = false
    private var digestKey: String { "CanvasProNativeDigest.\(store.persistenceScope)" }
    private var dismissedAnnouncements: Set<Int> { Set(dismissedAnnouncementsRaw.split(separator: ",").compactMap { Int($0) }) }
    private var visibleCourses: [CourseSummary] { store.bundle.courses.filter { !features.hiddenCourseIDs.contains($0.id) } }
    private var allAssignments: [AssignmentItem] { features.shownAssignments(in: store) }
    private var activeAssignments: [AssignmentItem] { allAssignments.filter { $0.isVisible(in: store) } }
    private var weekItems: [AssignmentItem] { activeAssignments.filter { NativeParity.isInFocusWindow($0, window: "7") } }
    private var todayCount: Int { activeAssignments.filter { NativeParity.isInFocusWindow($0, window: "1") }.count }
    private var overdueCount: Int { activeAssignments.filter { NativeParity.isInFocusWindow($0, window: "overdue") }.count }
    private var greeting: String { let hour = Calendar.current.component(.hour, from: Date()); return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening" }
    private var studentName: String? {
        for value in [features.accountDetails.nickname, features.accountDetails.firstName, features.profile.username ?? ""] {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { return trimmed }
        }
        return nil
    }
    private var heroMessage: String {
        if store.isLoading && store.bundle.assignments.isEmpty { return "Bringing your Canvas schedule into focus." }
        if store.bundle.assignments.isEmpty && store.syncMessage != nil { return "Couldn't load your assignments. Refresh Canvas to try again." }
        let week = weekItems.count
        if overdueCount > 0 { return "\(overdueCount) past-due item\(overdueCount == 1 ? " needs" : "s need") attention, with \(week) ahead this week." }
        if todayCount > 0 { return "\(todayCount) assignment\(todayCount == 1 ? " is" : "s are") due in the next 24 hours. Everything else can wait." }
        if week > 0 { return "Today is clear. \(week) item\(week == 1 ? " is" : "s are") coming up over the next seven days." }
        return "Your next seven days are clear. Take the win."
    }
    private var gradeMap: [Int: Double] { Dictionary(allAssignments.compactMap { item in item.submission?.score.map { (item.id, $0) } }, uniquingKeysWith: { first, _ in first }) }
    private var urgencyMap: [Int: String] { Dictionary(activeAssignments.compactMap { item in urgency(for: item).map { (item.id, $0) } }, uniquingKeysWith: { first, _ in first }) }
    private var newAnnouncements: [AnnouncementItem] { guard let digest else { return [] }; return Array(store.bundle.announcements.filter { item in !features.hiddenCourseIDs.contains(item.courseID) && item.isWithin(weeks: features.announcementWeeks) && (ISO8601DateFormatter.canvasDate(from: item.postedAt) ?? .distantPast) > digest.lastVisit }.prefix(8)) }
    private var newGrades: [AssignmentItem] { guard let digest else { return [] }; return Array(allAssignments.filter { item in guard let score = item.submission?.score else { return false }; return digest.grades[item.id] != score }.prefix(8)) }
    private var newlyUrgent: [AssignmentItem] { guard let digest else { return [] }; return Array(activeAssignments.filter { item in guard let value = urgency(for: item) else { return false }; return (value == "today" || value == "soon") && digest.urgency[item.id] != value }.sorted { (urgency(for: $0) == "today" ? 0 : 1) < (urgency(for: $1) == "today" ? 0 : 1) }.prefix(8)) }
    private var stillUrgent: Int { activeAssignments.filter { ["today", "soon"].contains(urgency(for: $0) ?? "") }.count }
    private var widgetIDs: [String] { features.dashboardOrder.filter { !features.dashboardHidden.contains($0) } }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                NativeTodayTabs(selection: $todaySection)
                if store.needsCanvasConnection {
                    NativeConnectCanvasCard(store: store)
                } else {
                    hero
                    NativeSyncStatusCard(store: store) { Task { await store.load() } }
                    if store.isLoading && store.bundle.courses.isEmpty {
                        CPSkeletonCard()
                        CPSkeletonCard()
                    } else {
                        dashboardHeader
                        ForEach(widgetIDs, id: \.self) { id in dashboardWidget(id) }
                    }
                }
            }
            .cpPagePadding()
        }
        .background(CPBackdrop())
        .cpStateChange(store.isLoading && store.bundle.courses.isEmpty)
        .refreshable { async let a: Void = store.load(); async let b: Void = features.load(); _ = await (a, b) }
        .onAppear { loadDigest() }
        .onChange(of: store.lastSyncedAt) { _, _ in if digest == nil { loadDigest() } }
        .sheet(isPresented: $showCustomize) {
            NavigationStack {
                DashboardCustomizationView(features: features)
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { showCustomize = false } } }
            }
        }
    }

    // MARK: Hero (the website's DashboardHero)

    private var hero: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 6) {
                Image(systemName: "calendar").cpIconFont(10, .medium)
                Text(Date().formatted(.dateTime.weekday(.wide).month(.wide).day()).uppercased()).tracking(2)
            }
            .cpFont(11, .medium)
            .foregroundStyle(CPTheme.muted(scheme))
            VStack(alignment: .leading, spacing: 10) {
                Text("\(greeting)\(studentName.map { ", \($0)." } ?? ".")")
                    .cpFont(30, .regular).tracking(-1)
                    .foregroundStyle(CPTheme.foreground(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text(heroMessage)
                    .cpFont(14).lineSpacing(3)
                    .foregroundStyle(CPTheme.muted(scheme))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Button { openFocus("7") } label: {
                HStack(spacing: 6) { Text("Open focus view"); Image(systemName: "arrow.up.right").cpIconFont(10, .semibold) }
                    .cpFont(12, .medium)
                    .foregroundStyle(CPTheme.foreground(scheme))
                    .padding(.horizontal, 16)
                    .frame(minHeight: 40)
                    .background(
                        LinearGradient(colors: [CPTheme.primary(scheme: scheme).opacity(0.23), CPTheme.primary(scheme: scheme).opacity(0.08)], startPoint: .topLeading, endPoint: .bottomTrailing),
                        in: Capsule()
                    )
                    .overlay(Capsule().strokeBorder(CPTheme.primary(scheme: scheme).opacity(0.5), lineWidth: 0.5))
            }
            .buttonStyle(CPPressStyle())
            heroStats
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(heroBackground)
        .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 30, style: .continuous).strokeBorder(CPTheme.primary(scheme: scheme).opacity(scheme == .dark ? 0.28 : 0.22), lineWidth: 0.5))
    }

    private var heroBackground: some View {
        let palette = CPTheme.currentPalette
        return ZStack {
            LinearGradient(
                colors: scheme == .dark
                    ? [.hsl(palette.hue, palette.saturation, 0.17), .hsl(palette.hue, palette.saturation, 0.11), .hsl(palette.hue, palette.saturation, 0.07)]
                    : [.hsl(palette.hue, palette.saturation, 0.97), .hsl(palette.hue, palette.saturation, 0.88)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            RadialGradient(colors: [CPTheme.primary(scheme: scheme).opacity(scheme == .dark ? 0.22 : 0.18), .clear], center: UnitPoint(x: 0.22, y: 0.3), startRadius: 0, endRadius: 260)
            RadialGradient(colors: [CPTheme.primary(scheme: scheme).opacity(scheme == .dark ? 0.16 : 0.14), .clear], center: UnitPoint(x: 0.95, y: -0.05), startRadius: 0, endRadius: 220)
            LinearGradient(colors: [Color.white.opacity(scheme == .dark ? 0.06 : 0.3), .clear], startPoint: .topLeading, endPoint: UnitPoint(x: 0.4, y: 0.4))
        }
    }

    /// "Next seven days" above two smaller cards, inside one soft shell.
    private var heroStats: some View {
        VStack(spacing: 8) {
            Button { openFocus("7") } label: {
                VStack(alignment: .leading, spacing: 18) {
                    HStack {
                        Text("NEXT SEVEN DAYS").cpFont(11, .medium).tracking(2).foregroundStyle(CPTheme.muted(scheme))
                        Spacer()
                        Image(systemName: "arrow.up.right").cpIconFont(11, .medium).foregroundStyle(CPTheme.muted(scheme))
                    }
                    HStack(alignment: .lastTextBaseline) {
                        Text("\(weekItems.count)").cpFont(32, .regular).tracking(-1.8).monospacedDigit().foregroundStyle(CPTheme.foreground(scheme))
                        Spacer(minLength: 8)
                        Text(weekItems.count == 1 ? "item on your radar" : "items on your radar")
                            .cpFont(12).foregroundStyle(CPTheme.muted(scheme)).multilineTextAlignment(.trailing)
                    }
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(heroCardBackground, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(CPTheme.primary(scheme: scheme).opacity(0.3), lineWidth: 0.5))
            }
            .buttonStyle(CPPressStyle())
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Next seven days: \(weekItems.count) \(weekItems.count == 1 ? "item" : "items")")
            .accessibilityHint("Opens Coming Up")
            HStack(spacing: 8) {
                heroSmallStat(value: todayCount, label: "Next 24 hours", symbol: "clock", window: "1")
                heroSmallStat(value: overdueCount, label: "Overdue", symbol: "exclamationmark.triangle", window: "overdue", soft: overdueCount > 0)
            }
        }
        .padding(8)
        .background(
            LinearGradient(colors: [CPTheme.primary(scheme: scheme).opacity(0.13), CPTheme.primary(scheme: scheme).opacity(0.035)], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 26, style: .continuous)
        )
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).strokeBorder(CPTheme.primary(scheme: scheme).opacity(0.2), lineWidth: 0.5))
    }

    private var heroCardBackground: LinearGradient {
        let palette = CPTheme.currentPalette
        return LinearGradient(
            colors: scheme == .dark
                ? [.hsl(palette.hue, palette.saturation, 0.21), .hsl(palette.hue, palette.saturation, 0.15), .hsl(palette.hue, palette.saturation, 0.11)]
                : [.hsl(palette.hue, palette.saturation, 0.99), .hsl(palette.hue, palette.saturation, 0.93)],
            startPoint: .topLeading, endPoint: .bottomTrailing
        )
    }

    private func heroSmallStat(value: Int, label: String, symbol: String, window: String, soft: Bool = false) -> some View {
        Button { openFocus(window) } label: {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Image(systemName: symbol).cpIconFont(15).foregroundStyle(soft ? CPTheme.danger : CPTheme.muted(scheme))
                    Spacer()
                    Text("\(value)").cpFont(24, .regular).tracking(-1.2).monospacedDigit()
                        .foregroundStyle(soft ? CPTheme.danger : CPTheme.foreground(scheme))
                }
                Text(label).cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1).minimumScaleFactor(0.85)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(heroCardBackground, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(CPTheme.primary(scheme: scheme).opacity(0.3), lineWidth: 0.5))
        }
        .buttonStyle(CPPressStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value)")
        .accessibilityHint("Opens Coming Up")
    }

    private var dashboardHeader: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Your dashboard").cpFont(17, .medium).tracking(-0.3).foregroundStyle(CPTheme.foreground(scheme))
                Text("Choose which widgets appear and their order.").cpFont(12).foregroundStyle(CPTheme.muted(scheme))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            Button { showCustomize = true } label: {
                Label("Customize", systemImage: "slider.horizontal.3")
            }
            .buttonStyle(CPButtonStyle(kind: .secondary))
        }
        .padding(.horizontal, 4)
        .padding(.top, 8)
    }

    @ViewBuilder private func dashboardWidget(_ id: String) -> some View {
        switch id {
        case "digest": digestWidget
        case "classes": classesWidget
        case "upcoming": upcomingWidget
        case "focus": focusWidget
        case "calendar": calendarWidget
        case "announcements": announcementsWidget
        case "gpa": gpaWidget
        case "heatmap":
            CPGlassCard(title: "Workload", subtitle: "Assignment density by week") {
                WorkloadView(assignments: activeAssignments, store: store, features: features)
            }
        default: EmptyView()
        }
    }

    // MARK: Since your last visit

    @ViewBuilder private var digestWidget: some View {
        let total = newAnnouncements.count + newGrades.count + newlyUrgent.count
        if total == 0 {
            CPGlassCard {
                HStack(spacing: 12) {
                    Image(systemName: "checkmark").cpIconFont(13, .medium)
                        .foregroundStyle(CPTheme.foreground(scheme))
                        .frame(width: 36, height: 36)
                        .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(CPTheme.insetBorder(scheme), lineWidth: 0.5))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(stillUrgent > 0 ? "Nothing new since your last visit." : "All caught up.")
                            .cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme))
                        Text(stillUrgent > 0 ? "No new announcements or grades. \(stillUrgent) assignment\(stillUrgent == 1 ? " is" : "s are") still due soon." : "No new announcements, grades, or urgent deadlines since your last visit.")
                            .cpFont(12).foregroundStyle(CPTheme.muted(scheme)).fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 4)
                    if stillUrgent > 0 {
                        Button { todaySection = "Get It Done" } label: { CPLinkLabel(text: "Plan it") }.buttonStyle(.plain)
                    }
                }
            }
        } else {
            CPGlassCard(strong: true) {
                CPCardHeader(title: "Since your last visit", subtitle: "\(total) update\(total == 1 ? "" : "s")") {
                    Button { markDigestSeen() } label: { CPLinkLabel(text: "Mark all seen") }.buttonStyle(.plain)
                }
                VStack(alignment: .leading, spacing: 18) {
                    digestSection("New announcements", symbol: "bell", count: newAnnouncements.count, empty: "No new posts") {
                        ForEach(newAnnouncements) { item in
                            NavigationLink { AnnouncementDetailView(item: item) } label: {
                                digestItem(item.title, detail: store.displayName(courseID: item.courseID, fallback: item.courseName))
                            }.buttonStyle(CPPressStyle())
                        }
                    }
                    digestSection("New grades", symbol: "chart.line.uptrend.xyaxis", count: newGrades.count, empty: "No new grades") {
                        ForEach(newGrades) { item in
                            NavigationLink { courseDestination(for: item, section: .graded) } label: {
                                digestItem(item.name, detail: store.displayName(courseID: item.courseID, fallback: item.courseName), trailing: gradeChangeText(item))
                            }.buttonStyle(CPPressStyle())
                        }
                    }
                    digestSection("Newly urgent", symbol: "clock", count: newlyUrgent.count, empty: "Nothing new due soon") {
                        ForEach(newlyUrgent) { item in
                            NavigationLink { courseDestination(for: item, highlight: true) } label: {
                                digestItem(item.name, detail: store.displayName(courseID: item.courseID, fallback: item.courseName), trailing: urgency(for: item) == "today" ? "Due today" : "Due soon")
                            }.buttonStyle(CPPressStyle())
                        }
                    }
                }
            }
        }
    }

    private func digestSection<Content: View>(_ title: String, symbol: String, count: Int, empty: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: symbol).cpIconFont(12).foregroundStyle(CPTheme.muted(scheme))
                Text(title.uppercased()).cpFont(11, .medium).tracking(1.5).foregroundStyle(CPTheme.foreground(scheme).opacity(0.8))
                Spacer()
                Text("\(count)").cpFont(11).monospacedDigit().foregroundStyle(CPTheme.muted(scheme))
            }
            .padding(.horizontal, 4)
            .accessibilityElement(children: .combine)
            if count == 0 {
                Text(empty).cpFont(11).foregroundStyle(CPTheme.faint(scheme)).padding(.horizontal, 4)
            } else {
                VStack(spacing: 6) { content() }
            }
        }
    }

    private func digestItem(_ title: String, detail: String, trailing: String? = nil) -> some View {
        CPInsetRow {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).cpFont(12, .medium).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(1)
                    Text(detail).cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1)
                }
                Spacer(minLength: 6)
                if let trailing {
                    Text(trailing).cpFont(11, .medium).monospacedDigit().foregroundStyle(CPTheme.foreground(scheme)).lineLimit(1)
                }
            }
        }
    }

    private func gradeChangeText(_ item: AssignmentItem) -> String {
        let next = item.submission?.score?.formatted() ?? "—"
        let possible = item.pointsPossible.map { " / \($0.formatted())" } ?? ""
        if let previous = digest?.grades[item.id] { return "\(previous.formatted()) → \(next)\(possible)" }
        return "\(next)\(possible)"
    }

    // MARK: Classes & Grades

    private var classesWidget: some View {
        CPGlassCard {
            CPCardHeader(title: "Classes & Grades", subtitle: "Active enrollments") {
                Button { selection = .grades } label: { CPLinkLabel(text: "View all") }.buttonStyle(.plain)
            }
            if visibleCourses.isEmpty {
                NativeEmptyState(title: "No active courses.", symbol: "books.vertical")
            } else {
                VStack(spacing: 8) {
                    ForEach(visibleCourses) { course in
                        NavigationLink {
                            CourseDetailView(course: course, store: store, features: features, initialSection: .graded)
                        } label: {
                            CPInsetRow {
                                HStack(spacing: 10) {
                                    Circle().fill(CPTheme.gradeColor(course.currentScore)).frame(width: 8, height: 8)
                                    Text(store.displayName(courseID: course.id, fallback: course.name))
                                        .cpFont(13).foregroundStyle(CPTheme.foreground(scheme).opacity(0.9)).lineLimit(1)
                                    Spacer(minLength: 8)
                                    Text(scoreText(course))
                                        .cpFont(12).monospacedDigit()
                                        .foregroundStyle(CPTheme.gradeColor(course.currentScore))
                                        .lineLimit(1).fixedSize()
                                }
                            }
                        }
                        .buttonStyle(CPPressStyle())
                    }
                }
            }
        }
    }

    private func scoreText(_ course: CourseSummary) -> String {
        let letter = NativeParity.courseLetter(course.currentGrade, score: course.currentScore)
        guard let score = course.currentScore else { return letter == "—" ? "—" : letter }
        return "\(score.formatted(.number.precision(.fractionLength(1))))% · \(letter)"
    }

    // MARK: Upcoming Assignments

    private var upcomingWidget: some View {
        let groups = visibleCourses.compactMap { course -> NativeCourseGroup? in
            let items = weekItems.filter { $0.courseID == course.id }.sorted(by: AssignmentItem.dueSort)
            return items.isEmpty ? nil : NativeCourseGroup(course: course, items: items)
        }
        let quiet = visibleCourses.count - groups.count
        return CPGlassCard {
            CPCardHeader(title: "Upcoming Assignments", subtitle: "Due within the next 7 days") {
                NavigationLink { NativeAssignmentsView(store: store, features: features) } label: { CPLinkLabel(text: "View all") }.buttonStyle(.plain)
            }
            if visibleCourses.isEmpty {
                NativeEmptyState(title: "No active courses.", symbol: "books.vertical")
            } else if groups.isEmpty {
                NativeEmptyState(title: "You're all clear", symbol: "checkmark.circle", detail: "Nothing is due in the next 7 days. Enjoy the breathing room.")
            } else {
                VStack(spacing: 0) {
                    ForEach(groups) { group in
                        upcomingGroup(group.course, items: group.items)
                        if group.id != groups.last?.id { CPRowDivider() }
                    }
                }
                if quiet > 0 {
                    Text("\(quiet) other \(quiet == 1 ? "class has" : "classes have") nothing due.")
                        .cpFont(12).foregroundStyle(CPTheme.muted(scheme)).padding(.horizontal, 4)
                }
            }
        }
    }

    private func upcomingGroup(_ course: CourseSummary, items: [AssignmentItem]) -> some View {
        let isOpen = expandedUpcoming.contains(course.id)
        return VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
                    if isOpen { expandedUpcoming.remove(course.id) } else { expandedUpcoming.insert(course.id) }
                }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "chevron.down").cpIconFont(11).foregroundStyle(CPTheme.muted(scheme))
                        .rotationEffect(.degrees(isOpen ? 180 : 0))
                    Circle().fill(CPTheme.gradeColor(course.currentScore)).frame(width: 8, height: 8)
                    Text(store.displayName(courseID: course.id, fallback: course.name))
                        .cpFont(12).foregroundStyle(CPTheme.foreground(scheme).opacity(0.9)).lineLimit(1)
                    Spacer(minLength: 6)
                    Text("\(items.count)").cpFont(12).monospacedDigit().foregroundStyle(CPTheme.muted(scheme))
                }
                .padding(.horizontal, 4)
                .frame(minHeight: 46)
                .contentShape(Rectangle())
            }
            .buttonStyle(CPPressStyle())
            .accessibilityValue(isOpen ? "Expanded" : "Collapsed")
            .accessibilityHint("\(items.count) due")
            if isOpen {
                VStack(spacing: 8) {
                    ForEach(items) { item in NativeDueRow(assignment: item, store: store, features: features, showCourse: false) }
                }
                .padding(.bottom, 10)
            }
        }
    }

    // MARK: Focus

    private var focusWidget: some View {
        let soon = activeAssignments.filter { NativeParity.isInFocusWindow($0, window: "2") }.sorted(by: AssignmentItem.dueSort)
        return CPGlassCard {
            CPCardHeader(title: "Focus", subtitle: "Due within 48 hours") {
                Button { openFocus("2") } label: { CPLinkLabel(text: "Open") }.buttonStyle(.plain)
            }
            if soon.isEmpty {
                NativeEmptyState(title: "Nothing due in the next 48 hours.", symbol: "sun.max")
            } else {
                VStack(spacing: 8) {
                    ForEach(soon) { item in NativeDueRow(assignment: item, store: store, features: features, showToggle: false) }
                }
            }
        }
    }

    // MARK: Calendar

    private var calendarWidget: some View {
        let now = Date()
        let end = now.addingTimeInterval(7 * 86400)
        let events = Array(store.bundle.calendar.compactMap { event -> NativeDatedEvent? in
            guard let raw = event.startAt, let date = ISO8601DateFormatter.canvasDate(from: raw), date >= now, date <= end else { return nil }
            return NativeDatedEvent(event: event, date: date)
        }.sorted { $0.date < $1.date }.prefix(8))
        return CPGlassCard {
            CPCardHeader(title: "Calendar", subtitle: "Next 7 days") {
                NavigationLink { NativeCalendarHub(store: store, features: features) } label: { CPLinkLabel(text: "View all") }.buttonStyle(.plain)
            }
            if events.isEmpty {
                NativeEmptyState(title: "No calendar events this week.", symbol: "calendar")
            } else {
                VStack(spacing: 8) {
                    ForEach(events) { entry in
                        CPInsetRow {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(entry.event.title).cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(1)
                                    if let context = entry.event.contextName { Text(context).cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1) }
                                }
                                Spacer(minLength: 8)
                                Text(entry.date.formatted(.dateTime.weekday(.abbreviated).hour().minute()))
                                    .cpFont(11).monospacedDigit().foregroundStyle(CPTheme.muted(scheme)).fixedSize()
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
    }

    // MARK: Announcements

    private var announcementsWidget: some View {
        let visible = store.bundle.announcements.filter { !features.hiddenCourseIDs.contains($0.courseID) && $0.isWithin(weeks: features.announcementWeeks) && !dismissedAnnouncements.contains($0.id) }
        let groups = Dictionary(grouping: visible, by: \.courseID)
            .map { id, items in NativeAnnouncementGroup(id: id, name: store.displayName(courseID: id, fallback: items.first?.courseName ?? "Class"), items: items.sorted { $0.postedAt > $1.postedAt }) }
            .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
        return CPGlassCard {
            CPCardHeader(title: "Announcements", subtitle: "Latest from your courses") {
                NavigationLink { AnnouncementsView(store: store, features: features) } label: { CPLinkLabel(text: "View all") }.buttonStyle(.plain)
            }
            if groups.isEmpty {
                NativeEmptyState(title: "No new announcements.", symbol: "megaphone")
            } else {
                VStack(spacing: 0) {
                    ForEach(groups) { group in
                        announcementGroup(id: group.id, name: group.name, items: group.items)
                        if group.id != groups.last?.id { CPRowDivider() }
                    }
                }
            }
        }
    }

    private func announcementGroup(id: Int, name: String, items: [AnnouncementItem]) -> some View {
        let isOpen = expandedAnnouncements.contains(id)
        return VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
                    if isOpen { expandedAnnouncements.remove(id) } else { expandedAnnouncements.insert(id) }
                }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "chevron.down").cpIconFont(11).foregroundStyle(CPTheme.muted(scheme))
                        .rotationEffect(.degrees(isOpen ? 180 : 0))
                    Text(name.uppercased()).cpFont(11, .medium).tracking(1.5).foregroundStyle(CPTheme.foreground(scheme).opacity(0.8)).lineLimit(1)
                    Spacer(minLength: 6)
                    Text("\(items.count)").cpFont(12).monospacedDigit().foregroundStyle(CPTheme.muted(scheme))
                }
                .padding(.horizontal, 4)
                .frame(minHeight: 46)
                .contentShape(Rectangle())
            }
            .buttonStyle(CPPressStyle())
            .accessibilityValue(isOpen ? "Expanded" : "Collapsed")
            if isOpen {
                VStack(spacing: 8) {
                    ForEach(items.prefix(4)) { item in
                        CPInsetRow {
                            HStack(alignment: .top, spacing: 8) {
                                NavigationLink { AnnouncementDetailView(item: item) } label: {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(item.title).cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(2)
                                        Text(item.message.strippingHTML).cpFont(11).lineSpacing(2).foregroundStyle(CPTheme.muted(scheme)).lineLimit(2)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(CPPressStyle())
                                Button { dismissAnnouncement(item.id) } label: {
                                    Image(systemName: "xmark").cpIconFont(9, .semibold).foregroundStyle(CPTheme.muted(scheme))
                                        .frame(width: 24, height: 24)
                                        .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).strokeBorder(CPTheme.foreground(scheme).opacity(0.2), lineWidth: 0.5))
                                        .frame(width: 44, height: 44).contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .padding(.top, -10).padding(.trailing, -10)
                                .accessibilityLabel("Dismiss \(item.title)")
                            }
                        }
                    }
                }
                .padding(.bottom, 10)
            }
        }
    }

    private func dismissAnnouncement(_ id: Int) {
        dismissedAnnouncementsRaw = dismissedAnnouncements.union([id]).sorted().map { String($0) }.joined(separator: ",")
    }

    // MARK: GPA

    private var gpaWidget: some View {
        let result = NativeGPA.compute(courses: store.bundle.courses, schedule: features.schedule, displayName: { store.displayName(courseID: $0.id, fallback: $0.name) })
        return CPGlassCard {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "graduationcap").cpIconFont(16)
                    .foregroundStyle(CPTheme.foreground(scheme))
                    .frame(width: 38, height: 38)
                    .background(CPTheme.foreground(scheme).opacity(0.07), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("GPA").cpFont(11, .medium).tracking(1.8).foregroundStyle(CPTheme.muted(scheme))
                    Text(result.gpa.map { String(format: "%.2f", $0) } ?? "—").cpFont(26, .medium).tracking(-0.8).monospacedDigit()
                        .foregroundStyle(CPTheme.foreground(scheme))
                }
                Spacer()
                Button { withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { showGpaScale.toggle() } } label: {
                    Image(systemName: "info.circle").cpIconFont(15).foregroundStyle(CPTheme.muted(scheme))
                        .frame(width: 44, height: 44).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.top, -6).padding(.trailing, -10)
                .accessibilityLabel(showGpaScale ? "Hide grading scale" : "Show grading scale")
            }
            HStack(spacing: 10) {
                CPStatTile(value: String(format: "%.1f", result.totalCredits), label: "Total credits")
                CPStatTile(value: String(format: "%.1f", result.countedCredits), label: "Counted")
            }
            if showGpaScale {
                VStack(alignment: .leading, spacing: 0) {
                    CPRowDivider().padding(.bottom, 10)
                    Text("4.0 SCALE").cpFont(11, .medium).tracking(1).foregroundStyle(CPTheme.muted(scheme)).padding(.bottom, 4)
                    ForEach(NativeGPA.scale, id: \.minimum) { entry in
                        HStack { Text("\(entry.minimum)%+"); Spacer(); Text(String(format: "%.1f", entry.points)) }
                            .cpFont(12).monospacedDigit().foregroundStyle(CPTheme.muted(scheme)).padding(.vertical, 3)
                    }
                }
            }
            HStack {
                Text("\(store.bundle.courses.count) class\(store.bundle.courses.count == 1 ? "" : "es") loaded.").cpFont(12).foregroundStyle(CPTheme.muted(scheme))
                Spacer()
                if result.countedCredits == 0 {
                    NavigationLink { ClassScheduleView(features: features, store: store) } label: { CPLinkLabel(text: "Add credits") }.buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Helpers

    private func openFocus(_ window: String) {
        focusWindow = window
        todaySection = "Coming Up"
    }

    @ViewBuilder private func courseDestination(for item: AssignmentItem, section: CourseDetailSection = .upcoming, highlight: Bool = false) -> some View {
        if let course = store.bundle.courses.first(where: { $0.id == item.courseID }) {
            if highlight { CourseDetailView(course: course, store: store, features: features, highlightAssignment: item) }
            else { CourseDetailView(course: course, store: store, features: features, initialSection: section) }
        } else {
            AssignmentDetailView(assignment: item, store: store, features: features)
        }
    }

    private func urgency(for item: AssignmentItem) -> String? { guard let due = item.dueDate else { return nil }; let hours = due.timeIntervalSinceNow / 3600; if hours < 0 { return "overdue" }; if hours <= 24 { return "today" }; if hours <= 72 { return "soon" }; return "later" }
    private func loadDigest() {
        if let data = UserDefaults.standard.data(forKey: digestKey), let saved = try? JSONDecoder().decode(NativeDigestSnapshot.self, from: data) { digest = saved }
        else if !store.bundle.courses.isEmpty { markDigestSeen() }
    }
    private func markDigestSeen() { let snapshot = NativeDigestSnapshot(lastVisit: Date(), grades: gradeMap, urgency: urgencyMap); digest = snapshot; if let data = try? JSONEncoder().encode(snapshot) { UserDefaults.standard.set(data, forKey: digestKey) } }
}

struct NativeCourseGroup: Identifiable {
    let course: CourseSummary
    let items: [AssignmentItem]
    var id: Int { course.id }
}

struct NativeAnnouncementGroup: Identifiable {
    let id: Int
    let name: String
    let items: [AnnouncementItem]
}

struct NativeDatedEvent: Identifiable {
    let event: CalendarEventItem
    let date: Date
    var id: String { event.id }
}

/// A small calendar-page badge: weekday over day number.
struct NativeDateBadge: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let date: Date
    var body: some View {
        VStack(spacing: 0) {
            Text(date.formatted(.dateTime.weekday(.abbreviated)).uppercased()).cpFont(11, .bold).foregroundStyle(CPTheme.foreground(scheme))
            Text(date.formatted(.dateTime.day())).cpFont(14, .semibold).monospacedDigit().foregroundStyle(CPTheme.foreground(scheme))
        }
        .frame(width: 40, height: 40)
        .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
        .accessibilityHidden(true)
    }
}

/// GPA from current scores and the credits saved in My classes, using the
/// website's 4.0 scale and course matching.
enum NativeGPA {
    struct Step { let minimum: Int; let points: Double }
    static let scale: [Step] = [Step(minimum: 93, points: 4.0), Step(minimum: 90, points: 3.7), Step(minimum: 87, points: 3.3), Step(minimum: 83, points: 3.0), Step(minimum: 80, points: 2.7), Step(minimum: 77, points: 2.3), Step(minimum: 73, points: 2.0), Step(minimum: 70, points: 1.7), Step(minimum: 67, points: 1.3), Step(minimum: 63, points: 1.0), Step(minimum: 60, points: 0.7), Step(minimum: 0, points: 0.0)]

    struct Result { let gpa: Double?; let totalCredits: Double; let countedCredits: Double }

    static func points(for score: Double?) -> Double? {
        guard let score, score.isFinite else { return nil }
        return scale.first { score >= Double($0.minimum) }?.points ?? 0
    }

    static func compute(courses: [CourseSummary], schedule: [ClassScheduleEntry], displayName: (CourseSummary) -> String) -> Result {
        var total = 0.0, counted = 0.0, weighted = 0.0
        for course in courses {
            let display = displayName(course).lowercased()
            let match = schedule.first { entry in
                entry.canvasCourseID == course.id || entry.title.lowercased() == display || (!course.courseCode.isEmpty && entry.code.lowercased() == course.courseCode.lowercased())
            }
            let credits = match?.credits ?? 0
            total += credits
            if let value = points(for: course.currentScore), credits > 0 {
                counted += credits
                weighted += value * credits
            }
        }
        return Result(gpa: counted > 0 ? weighted / counted : nil, totalCredits: total, countedCredits: counted)
    }
}

/// One assignment in a compact list: done circle, name, class or date, and its
/// countdown. Tapping the text opens the description.
struct NativeDueRow: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let assignment: AssignmentItem
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    var showCourse = true
    var showToggle = true
    private var isComplete: Bool { assignment.isFinished(in: store) }
    private var countdown: NativeParity.Countdown? { NativeParity.countdown(assignment, completed: isComplete) }

    var body: some View {
        HStack(spacing: 10) {
            if showToggle { NativeCompletionButton(assignment: assignment, store: store) }
            NavigationLink {
                if let course = store.bundle.courses.first(where: { $0.id == assignment.courseID }) {
                    CourseDetailView(course: course, store: store, features: features, highlightAssignment: assignment)
                } else {
                    AssignmentDetailView(assignment: assignment, store: store, features: features)
                }
            } label: {
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(assignment.name)
                            .cpFont(12, .medium)
                            .foregroundStyle(isComplete ? CPTheme.muted(scheme) : CPTheme.foreground(scheme))
                            .strikethrough(isComplete)
                            .lineLimit(2)
                        Text(showCourse ? store.displayName(courseID: assignment.courseID, fallback: assignment.courseName) : (countdown?.fullDate ?? "No due date"))
                            .cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1)
                    }
                    Spacer(minLength: 6)
                    if let countdown {
                        Text(countdown.label)
                            .cpFont(11, countdown.urgency == "today" || countdown.urgency == "overdue" ? .semibold : .medium)
                            .monospacedDigit()
                            .foregroundStyle(CPTheme.urgency(countdown.urgency, scheme: scheme))
                            .lineLimit(1)
                            .fixedSize()
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(CPPressStyle())
        }
        .padding(12)
        .frame(minHeight: 44)
        .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: CPLayout.innerRadius, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: CPLayout.innerRadius, style: .continuous).strokeBorder(CPTheme.insetBorder(scheme), lineWidth: 0.5))
        .opacity(isComplete ? 0.6 : 1)
    }
}

/// The round "done" control used on every assignment row.
struct NativeCompletionButton: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let assignment: AssignmentItem
    @ObservedObject var store: NativeContentStore
    var onCompleted: ((AssignmentItem) -> Void)? = nil
    private var isComplete: Bool { assignment.isFinished(in: store) }

    var body: some View {
        Button {
            let wasComplete = isComplete
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            Task {
                await store.toggle(assignment)
                if !wasComplete && assignment.isFinished(in: store) { onCompleted?(assignment) }
            }
        } label: {
            // The website's checkbox: a rounded square that fills when done.
            ZStack {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .strokeBorder(CPTheme.foreground(scheme).opacity(isComplete ? 0 : 0.3), lineWidth: 1.5)
                if isComplete {
                    RoundedRectangle(cornerRadius: 6, style: .continuous).fill(CPTheme.foreground(scheme).opacity(0.8))
                    Image(systemName: "checkmark").cpIconFont(10, .bold).foregroundStyle(CPTheme.background(scheme))
                }
            }
            .frame(width: 20, height: 20)
        }
        .buttonStyle(.plain)
        // A 44-point tap target without changing the row layout.
        .padding(12).contentShape(Rectangle()).padding(-12)
        .disabled(store.completionSavesInFlight.contains(assignment.id))
        .accessibilityLabel(isComplete ? "Mark \(assignment.name) as not done" : "Mark \(assignment.name) as done")
        .accessibilityValue(isComplete ? "Done" : "Not done")
    }
}

struct NativeSyncStatusCard: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var store: NativeContentStore
    let retry: () -> Void

    /// Only shown when something needs the student's attention (offline or a
    /// sync problem). A routine refresh never shows it, so the page doesn't jump.
    private var shouldShow: Bool {
        !store.isPreview && !store.isLoading && (store.isShowingCachedData || store.syncMessage != nil)
    }

    var body: some View {
        if shouldShow {
            HStack(spacing: 8) {
                ZStack {
                    if store.isLoading { ProgressView().controlSize(.mini) }
                    else { Circle().fill(statusColor).frame(width: 6, height: 6) }
                }
                .frame(width: 14, height: 14)
                Text(statusTitle).cpFont(11, .semibold).foregroundStyle(CPTheme.foreground(scheme))
                Text(statusDetail).cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(2)
                Spacer(minLength: 4)
                if (store.isShowingCachedData || store.syncMessage != nil) && !store.isLoading {
                    Button(action: retry) { CPIconButtonLabel(symbol: "arrow.clockwise") }
                        .buttonStyle(.plain)
                        .padding(-7)
                        .accessibilityLabel("Refresh Canvas")
                }
            }
            .padding(.horizontal, 12)
            .frame(minHeight: 34)
            .cpSurface(radius: 12)
            .accessibilityElement(children: .combine)
        }
    }

    private var statusColor: Color {
        if store.syncMessage != nil { return CPTheme.warning }
        if let updated = store.lastSyncedAt, Date().timeIntervalSince(updated) > 30 * 60 { return CPTheme.warning }
        return CPTheme.primary(scheme: scheme)
    }

    private var statusTitle: String {
        if store.isLoading { return "Refreshing Canvas" }
        if store.isShowingCachedData { return "Saved data" }
        if store.syncMessage != nil { return "Needs refresh" }
        return "Live"
    }

    private var statusDetail: String {
        if let message = store.syncMessage { return message }
        if let date = store.lastSyncedAt { return "Updated \(date.formatted(.dateTime.month(.abbreviated).day().hour().minute()))" }
        return "Coursework will appear after the first sync."
    }
}

private struct DashboardCustomizationView: View {
    @ObservedObject var features: NativeFeatureStore
    @State private var status: String?
    private var order: [String] { features.dashboardOrder }

    var body: some View {
        Form {
            Section {
                ForEach(order.indices, id: \.self) { index in
                    let id = order[index]
                    HStack(spacing: 10) {
                        Toggle(isOn: Binding(get: { !features.dashboardHidden.contains(id) }, set: { setVisible(id, $0) })) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(title(for: id)).cpFont(12, .medium)
                                Text(features.dashboardHidden.contains(id) ? "Hidden" : "Shown on dashboard").cpFont(11).foregroundStyle(.secondary)
                            }
                        }
                        Button { move(index, -1) } label: { Image(systemName: "chevron.up").frame(width: 32, height: 44) }
                            .disabled(index == 0).accessibilityLabel("Move \(title(for: id)) earlier")
                        Button { move(index, 1) } label: { Image(systemName: "chevron.down").frame(width: 32, height: 44) }
                            .disabled(index == order.count - 1).accessibilityLabel("Move \(title(for: id)) later")
                    }
                    .buttonStyle(.borderless)
                }
            } header: {
                Text("Widgets")
            } footer: {
                Text("Changes save automatically to your account and match the website.")
            }
            Section { Button("Reset default") { Task { await save(order: NativeFeatureStore.defaultDashboardOrder, hidden: []) } } }
            if let status { Section { Text(status).foregroundStyle(.secondary) } }
        }
        .cpListScreen()
        .cpNavigationTitle("Edit widgets")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func title(for id: String) -> String { ["digest": "Since your last visit", "classes": "Classes & Grades", "upcoming": "Upcoming Assignments", "focus": "Focus", "calendar": "Calendar", "announcements": "Announcements", "gpa": "GPA", "heatmap": "Workload heatmap"][id] ?? id }
    private func setVisible(_ id: String, _ visible: Bool) { var hidden = features.dashboardHidden; if visible { hidden.remove(id) } else { hidden.insert(id) }; Task { await save(hidden: hidden) } }
    private func move(_ index: Int, _ direction: Int) { var values = order; guard values.indices.contains(index + direction) else { return }; values.swapAt(index, index + direction); Task { await save(order: values) } }
    private func save(order: [String]? = nil, hidden: Set<String>? = nil) async { do { try await features.updateDashboard(order: order, hidden: hidden); status = nil } catch { status = error.localizedDescription } }
}

/// The large summary card at the top of a page: icon, eyebrow, title, a short
/// explanation and a row of numbers.
struct NativePageHero<Tiles: View>: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let symbol: String
    let eyebrow: String
    let title: String
    let detail: String?
    let tiles: Tiles

    init(symbol: String, eyebrow: String, title: String, detail: String? = nil, @ViewBuilder tiles: () -> Tiles) {
        self.symbol = symbol; self.eyebrow = eyebrow; self.title = title; self.detail = detail; self.tiles = tiles()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            CPIconBadge(symbol: symbol)
            VStack(alignment: .leading, spacing: 4) {
                Text(eyebrow.uppercased()).cpFont(11, .semibold).tracking(0.6).foregroundStyle(CPTheme.muted(scheme))
                Text(title).cpFont(28, .regular).tracking(-1).foregroundStyle(CPTheme.foreground(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                if let detail {
                    Text(detail).cpFont(12).lineSpacing(2).foregroundStyle(CPTheme.muted(scheme)).fixedSize(horizontal: false, vertical: true)
                }
            }
            HStack(spacing: 8) { tiles }
        }
        .padding(.horizontal, 4)
        .padding(.top, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct NativeAssignmentsView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var search = ""
    @State private var showCompleted = false
    @State private var undatedOpen = false
    @State private var showAdd = false
    @State private var horizon = 14

    private var visibleCourses: [CourseSummary] { store.bundle.courses.filter { !features.hiddenCourseIDs.contains($0.id) } }
    private var allAssignments: [AssignmentItem] { features.shownAssignments(in: store) }
    /// Unfinished work only. The summary counts use this, so they don't change
    /// while searching or when finished work is shown.
    private var remaining: [AssignmentItem] { allAssignments.filter { $0.isVisible(in: store) } }
    private var overdueCount: Int { remaining.filter { ($0.dueDate ?? .distantFuture) < Date() }.count }
    private var weekCount: Int { remaining.filter { guard let due = $0.dueDate else { return false }; return due >= Date() && due <= NativeParity.endOfUpcomingDay(7) }.count }
    private var priorityAssignments: [AssignmentItem] {
        Array(NativeParity.rankedAssignments(remaining.filter { $0.dueDate != nil }, estimates: features.estimates).prefix(5))
    }

    private var assignments: [AssignmentItem] {
        allAssignments.filter { item in
            let matches = search.isEmpty || item.name.localizedCaseInsensitiveContains(search) || store.displayName(courseID: item.courseID, fallback: item.courseName).localizedCaseInsensitiveContains(search) || item.courseCode.localizedCaseInsensitiveContains(search)
            return matches && item.isVisible(in: store, showCompleted: showCompleted)
        }.sorted(by: AssignmentItem.dueSort)
    }
    private var agendaSections: [NativeAgendaSection] {
        let now = Date()
        let week = NativeParity.endOfUpcomingDay(7, from: now)
        let fortnight = NativeParity.endOfUpcomingDay(14, from: now)
        let month = NativeParity.endOfUpcomingDay(28, from: now)
        let searching = !search.isEmpty
        return [
            NativeAgendaSection(key: "overdue", title: "Overdue", items: assignments.filter { $0.dueDate.map { $0 < now } ?? false }),
            NativeAgendaSection(key: "week1", title: "Next 7 days", items: assignments.filter { $0.dueDate.map { $0 >= now && $0 <= week } ?? false }),
            NativeAgendaSection(key: "week2", title: "Following week", items: assignments.filter { $0.dueDate.map { $0 > week && $0 <= fortnight } ?? false }),
            NativeAgendaSection(key: "weeks34", title: "Weeks 3 and 4", items: horizon == 28 || !search.isEmpty ? assignments.filter { $0.dueDate.map { $0 > fortnight && $0 <= month } ?? false } : []),
            NativeAgendaSection(key: "later", title: "Later", items: searching ? assignments.filter { $0.dueDate.map { $0 > month } ?? false } : []),
            NativeAgendaSection(key: "undated", title: "No due date", items: assignments.filter { $0.dueDate == nil }),
        ].filter { !$0.items.isEmpty }
    }
    private var shownCount: Int { agendaSections.reduce(0) { $0 + $1.items.count } }
    private var hiddenWeeks34: Int {
        guard horizon == 14 else { return 0 }
        let fortnight = NativeParity.endOfUpcomingDay(14), month = NativeParity.endOfUpcomingDay(28)
        return assignments.filter { $0.dueDate.map { $0 > fortnight && $0 <= month } ?? false }.count
    }
    private var hiddenBeyond: Int { assignments.filter { ($0.dueDate ?? .distantPast) > NativeParity.endOfUpcomingDay(28) }.count }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: CPLayout.stack) {
                if store.needsCanvasConnection {
                    NativeConnectCanvasCard(store: store)
                } else if store.isLoading && store.bundle.assignments.isEmpty {
                    CPSkeletonCard()
                    CPSkeletonCard()
                } else {
                    NativePageHero(symbol: "checklist", eyebrow: "Complete workload", title: "One agenda. Every assignment.", detail: "Work is ordered by urgency across every class, so the next deadline is always obvious.") {
                        CPStatTile(value: "\(weekCount)", label: "Due this week", tone: .accent)
                        CPStatTile(value: "\(overdueCount)", label: "Overdue", tone: overdueCount > 0 ? .danger : .neutral)
                    }
                    priorityCard
                    if !visibleCourses.isEmpty {
                        Button { showAdd = true } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "plus").cpIconFont(10, .bold)
                                Text("Add something Canvas doesn't have")
                                Spacer()
                                Image(systemName: "chevron.right").cpIconFont(8, .bold).foregroundStyle(CPTheme.faint(scheme))
                            }
                        }
                        .buttonStyle(CPButtonStyle(kind: .quiet, fullWidth: true))
                    }
                    filterBar
                    if agendaSections.isEmpty && !store.isLoading {
                        CPGlassCard { NativeEmptyState(title: search.isEmpty ? "Nothing to do here" : "No matches", symbol: search.isEmpty ? "checkmark.circle" : "magnifyingglass", detail: search.isEmpty ? "Every assignment in this view is done." : "Try a different assignment or class name.") }
                    }
                    ForEach(agendaSections) { section in agendaSection(section) }
                    moreControls
                }
            }
            .cpPagePadding()
        }
        .background(CPBackdrop())
        .cpStateChange(store.isLoading && store.bundle.assignments.isEmpty)
        .cpStateChange(showCompleted)
        .cpStateChange(horizon)
        .cpNavigationTitle("Assignments").navigationBarTitleDisplayMode(.inline)
        .searchable(text: $search, prompt: "Find any assignment or course")
        .toolbar { Button { showAdd = true } label: { Image(systemName: "plus") }.accessibilityLabel("Add assignment").disabled(visibleCourses.isEmpty) }
        .sheet(isPresented: $showAdd) { AddAssignmentView(courses: visibleCourses, store: store, features: features) }
        .refreshable { async let a: Void = store.load(); async let b: Void = features.load(); _ = await (a, b) }
    }

    private var filterBar: some View {
        HStack(spacing: 8) {
            Button { showCompleted.toggle() } label: { CPChip(text: showCompleted ? "Showing completed" : "Show completed", selected: showCompleted) }
                .buttonStyle(.plain)
                .accessibilityAddTraits(showCompleted ? .isSelected : [])
            Spacer()
            Text("\(shownCount) shown").cpFont(11).monospacedDigit().foregroundStyle(CPTheme.faint(scheme))
        }
        .padding(.top, 4)
    }

    private var priorityCard: some View {
        CPGlassCard {
            CPCardHeader(title: "Priority Assignments", subtitle: "Smart ordering by deadline and weight")
            HStack(alignment: .top, spacing: 10) {
                CPIconBadge(symbol: "sparkles")
                Text(prioritySummary).cpFont(12).lineSpacing(2).foregroundStyle(CPTheme.foreground(scheme).opacity(0.9))
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !priorityAssignments.isEmpty {
                VStack(spacing: 0) {
                    ForEach(priorityAssignments) { item in
                        HStack(spacing: 10) {
                            NativeCompletionButton(assignment: item, store: store)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.name).cpFont(12, .medium).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(2)
                                Text(store.displayName(courseID: item.courseID, fallback: item.courseName)).cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1)
                            }
                            Spacer(minLength: 6)
                            let label = NativeParity.priorityLabel(item)
                            CPPill(text: label, tone: label == "Do first" ? .accent : label == "Soon" ? .warning : .neutral)
                        }
                        .padding(.vertical, 9)
                        if item.id != priorityAssignments.last?.id { CPRowDivider(leading: 30) }
                    }
                }
            }
        }
    }

    private func agendaSection(_ section: NativeAgendaSection) -> some View {
        let collapsed = section.key == "undated" && search.isEmpty && !undatedOpen
        return VStack(alignment: .leading, spacing: 8) {
            CPSectionLabel(section.title, count: section.items.count) {
                if section.key == "undated" && search.isEmpty {
                    Button(undatedOpen ? "Hide" : "Show") { undatedOpen.toggle() }
                        .cpFont(11, .semibold)
                        .frame(minHeight: 32)
                }
            }
            .padding(.top, 8)
            if !collapsed {
                VStack(spacing: 0) {
                    ForEach(section.items) { item in
                        agendaRow(item)
                        if item.id != section.items.last?.id { CPRowDivider(leading: 44) }
                    }
                }
                .padding(.horizontal, 14)
                .cpSurface()
            }
        }
    }

    private func agendaRow(_ item: AssignmentItem) -> some View {
        let planned = features.calendarPicks.contains { $0.assignmentID == item.id }
        let done = item.isFinished(in: store)
        let mine = item.id < 0 && features.customAssignments.contains { $0.id == item.id }
        let notes = mine ? (features.customAssignments.first { $0.id == item.id }?.notes ?? "") : ""
        return HStack(alignment: .top, spacing: 10) {
            NativeCompletionButton(assignment: item, store: store).padding(.top, 1)
            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .cpFont(13, .medium)
                    .foregroundStyle(done ? CPTheme.muted(scheme) : CPTheme.foreground(scheme))
                    .strikethrough(done)
                    .fixedSize(horizontal: false, vertical: true)
                Text(metaLine(item, done: done, mine: mine))
                    .cpFont(11).foregroundStyle(CPTheme.muted(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                if !notes.isEmpty {
                    Text(notes).cpFont(11).foregroundStyle(CPTheme.foreground(scheme).opacity(0.7)).lineLimit(2)
                }
                HStack(spacing: 14) {
                    if !mine { NativeAssignmentDescriptionLink(assignment: item, store: store, features: features) }
                    if item.dueDate != nil {
                        Button { addToCalendar(item) } label: {
                            Label(planned ? "Planned" : "Plan", systemImage: planned ? "calendar.badge.checkmark" : "calendar.badge.plus")
                        }
                        .disabled(planned)
                        .accessibilityLabel(planned ? "\(item.name) is on your calendar" : "Add \(item.name) to your calendar")
                    }
                    if let url = URL(string: item.htmlURL), url.scheme == "https" { Link("Canvas", destination: url) }
                    if mine {
                        Button(role: .destructive) { deleteCustom(item.id) } label: { Label("Delete", systemImage: "trash") }
                            .foregroundStyle(CPTheme.danger)
                            .accessibilityLabel("Delete \(item.name)")
                    }
                }
                .cpFont(11, .medium)
                .foregroundStyle(CPTheme.foreground(scheme))
                .buttonStyle(.plain)
                .frame(minHeight: 28)
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 2) {
                if let due = item.dueDate {
                    Text(due.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())).cpFont(11, .medium).foregroundStyle(CPTheme.foreground(scheme).opacity(0.85))
                    Text(due.formatted(.dateTime.hour().minute())).cpFont(11).foregroundStyle(CPTheme.faint(scheme))
                } else {
                    Text("No due date").cpFont(11).foregroundStyle(CPTheme.faint(scheme))
                }
            }
            .monospacedDigit()
            .fixedSize()
        }
        .padding(.vertical, 11)
        .opacity(done ? 0.6 : 1)
    }

    @ViewBuilder private var moreControls: some View {
        if search.isEmpty && (hiddenWeeks34 > 0 || horizon == 28 || hiddenBeyond > 0) {
            VStack(spacing: 8) {
                if horizon == 14 && hiddenWeeks34 > 0 {
                    Button { horizon = 28 } label: {
                        HStack(spacing: 6) { Text("Show weeks 3 and 4"); Text("\(hiddenWeeks34) more").foregroundStyle(CPTheme.muted(scheme)) }
                    }
                        .buttonStyle(CPButtonStyle(kind: .quiet))
                }
                if horizon == 28 {
                    Button("Show less") { horizon = 14 }.buttonStyle(CPButtonStyle(kind: .quiet))
                }
                if hiddenBeyond > 0 {
                    Text("\(hiddenBeyond) more \(hiddenBeyond == 1 ? "is" : "are") due after four weeks. Search to find any assignment.")
                        .cpFont(11).foregroundStyle(CPTheme.faint(scheme)).multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 8)
        }
    }

    private func metaLine(_ item: AssignmentItem, done: Bool, mine: Bool) -> String {
        var parts = [store.displayName(courseID: item.courseID, fallback: item.courseName)]
        parts.append(done ? "Completed" : mine ? "Added by you" : statusLabel(item))
        if let points = item.pointsPossible { parts.append("\(points.formatted()) pts") }
        return parts.joined(separator: " · ")
    }

    private func statusLabel(_ item: AssignmentItem) -> String {
        let submission = item.submission
        if submission?.missing == true { return "Missing" }
        if submission?.workflowState == "graded" { return "Graded" }
        if submission?.submittedAt != nil { return submission?.late == true ? "Submitted (late)" : "Submitted" }
        if let due = item.dueDate, due < Date() { return "Overdue" }
        return "Not submitted"
    }

    private var prioritySummary: String {
        let names = priorityAssignments.prefix(3).map { "\($0.name) (\(store.displayName(courseID: $0.courseID, fallback: $0.courseName)))" }
        guard let first = names.first else { return "No unfinished assignments right now." }
        return "Right now, finish \(first)\(names.count > 1 ? ", then \(names.dropFirst().joined(separator: ", then "))" : "")."
    }
    private func addToCalendar(_ item: AssignmentItem) {
        guard !features.calendarPicks.contains(where: { $0.assignmentID == item.id }) else { return }
        let pick = CalendarPick(assignmentID: item.id, title: item.name, context: store.displayName(courseID: item.courseID, fallback: item.courseName), at: NativeParity.plannedTime(for: item.dueAt), dueAt: item.dueAt)
        Task {
            do {
                try await features.savePreference("calendar-picks", features.calendarPicks + [pick])
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } catch {
                features.errorMessage = error.localizedDescription
            }
        }
    }
    private func deleteCustom(_ id: Int) {
        Task {
            do { try await features.savePreference("custom-assignments", features.customAssignments.filter { $0.id != id }) }
            catch { features.errorMessage = error.localizedDescription }
        }
    }
}

struct NativeAgendaSection: Identifiable {
    let key: String
    let title: String
    let items: [AssignmentItem]
    var id: String { key }
}

/// A full assignment summary: done control, name, class, countdown and status.
struct NativeAssignmentRow: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let assignment: AssignmentItem
    @ObservedObject var store: NativeContentStore
    var onCompleted: ((AssignmentItem) -> Void)? = nil
    private var isComplete: Bool { assignment.isFinished(in: store) }
    private var countdown: NativeParity.Countdown? { NativeParity.countdown(assignment, completed: isComplete) }
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            NativeCompletionButton(assignment: assignment, store: store, onCompleted: onCompleted).padding(.top, 1)
            VStack(alignment: .leading, spacing: 4) {
                Text(assignment.name)
                    .cpFont(13, .semibold)
                    .foregroundStyle(isComplete ? CPTheme.muted(scheme) : CPTheme.foreground(scheme))
                    .strikethrough(isComplete)
                    .fixedSize(horizontal: false, vertical: true)
                Text(store.displayName(courseID: assignment.courseID, fallback: assignment.courseName))
                    .cpFont(11)
                    .foregroundStyle(CPTheme.muted(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 6) {
                    if let countdown {
                        CPPill(text: countdown.label, tone: countdown.urgency == "overdue" ? .danger : countdown.urgency == "today" ? .accent : .neutral, symbol: "clock")
                    }
                    if assignment.submission?.missing == true { CPPill(text: "Missing", tone: .danger) }
                    if assignment.submission?.late == true { CPPill(text: "Late", tone: .warning) }
                    if let points = assignment.pointsPossible { CPPill(text: "\(points.formatted()) pts") }
                }
                if let countdown, !countdown.fullDate.isEmpty {
                    Text(countdown.fullDate).cpFont(11).monospacedDigit().foregroundStyle(CPTheme.faint(scheme))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 3)
    }
}

struct AssignmentDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let assignment: AssignmentItem
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var estimate = 25
    @State private var status: String?
    var body: some View {
        Form {
            Section { NativeAssignmentRow(assignment: assignment, store: store) }
            if let description = assignment.description, !description.isEmpty { Section("Description") { Text(description.strippingHTML).cpFont(12).lineSpacing(3).textSelection(.enabled) } }
            Section("Planning") {
                Stepper("Estimated time: \(estimate) min", value: $estimate, in: 5...480, step: 5)
                Button("Save estimate") { Task { do { try await features.saveEstimate(estimate, for: assignment); status = "Estimate saved." } catch { status = error.localizedDescription } } }
                Button("Add to CanvasPro Calendar") { addToCalendar() }
            }
            if let score = assignment.submission?.score { Section("Grade") { LabeledContent("Score", value: "\(score.formatted())\(assignment.pointsPossible.map { " / \($0.formatted())" } ?? "")") } }
            if let url = URL(string: assignment.htmlURL), !assignment.htmlURL.isEmpty { Section { Link("Open in Canvas", destination: url) } }
            if assignment.id < 0, features.customAssignments.contains(where: { $0.id == assignment.id }) { Section { Button("Delete custom assignment", role: .destructive) { Task { do { try await features.savePreference("custom-assignments", features.customAssignments.filter { $0.id != assignment.id }); dismiss() } catch { status = error.localizedDescription } } } } }
            if let status { Section { Text(status).foregroundStyle(.secondary) } }
        }
        .cpListScreen()
        .cpNavigationTitle("Assignment")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { estimate = features.estimates[assignment.id].flatMap { $0 > 0 ? $0 : nil } ?? 25 }
    }
    private func addToCalendar() {
        guard !features.calendarPicks.contains(where: { $0.assignmentID == assignment.id }) else { status = "Already on your calendar."; return }
        let pick = CalendarPick(assignmentID: assignment.id, title: assignment.name, context: store.displayName(courseID: assignment.courseID, fallback: assignment.courseName), at: NativeParity.plannedTime(for: assignment.dueAt), dueAt: assignment.dueAt)
        Task { do { try await features.savePreference("calendar-picks", features.calendarPicks + [pick]); status = "Added to calendar." } catch { status = error.localizedDescription } }
    }
}

private struct AddAssignmentView: View {
    @Environment(\.dismiss) private var dismiss
    let courses: [CourseSummary]
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var name = ""; @State private var courseID: Int?; @State private var dueDate = Date(); @State private var hasDueDate = true; @State private var points = 0.0; @State private var notes = ""; @State private var error: String?
    @State private var saving = false
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $name)
                    Picker("Class", selection: $courseID) { Text("Choose a class").tag(Int?.none); ForEach(courses) { course in Text(store.displayName(courseID: course.id, fallback: course.name)).tag(Optional(course.id)) } }
                    Toggle("Due date", isOn: $hasDueDate); if hasDueDate { DatePicker("Due", selection: $dueDate) }
                    TextField("Points", value: $points, format: .number).keyboardType(.decimalPad)
                    TextField("Notes", text: $notes, axis: .vertical)
                } header: {
                    Text("Assignment")
                } footer: {
                    Text("Only you see this. It appears in every list next to your Canvas work.")
                }
                if let error { Section { Text(error).foregroundStyle(CPTheme.danger) } }
            }
            .cpListScreen()
            .cpNavigationTitle("New Assignment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save() }.disabled(saving || name.trimmingCharacters(in: .whitespaces).isEmpty || courseID == nil) }
            }
        }
        .interactiveDismissDisabled(saving)
    }
    private func save() {
        guard let courseID, !saving else { return }
        saving = true
        let item = CustomAssignment(id: -Int(Date().timeIntervalSince1970 * 1000), courseID: courseID, name: name.trimmingCharacters(in: .whitespaces), dueAt: hasDueDate ? ISO8601DateFormatter().string(from: dueDate) : nil, pointsPossible: points > 0 ? points : nil, notes: notes, createdAt: ISO8601DateFormatter().string(from: Date()))
        Task {
            defer { saving = false }
            do { try await features.savePreference("custom-assignments", features.customAssignments + [item]); dismiss() } catch { self.error = error.localizedDescription }
        }
    }
}

private struct NativeGradesView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var search = ""
    @State private var expanded = Set<Int>()
    @State private var gradeHistory: [Int: [Double]] = [:]
    private var visibleCourses: [CourseSummary] { store.bundle.courses.filter { !features.hiddenCourseIDs.contains($0.id) } }
    private var courses: [CourseSummary] { visibleCourses.filter { course in search.isEmpty || store.displayName(courseID: course.id, fallback: course.name).localizedCaseInsensitiveContains(search) || course.courseCode.localizedCaseInsensitiveContains(search) || store.bundle.assignments.contains { $0.courseID == course.id && $0.name.localizedCaseInsensitiveContains(search) } } }
    private var scored: [CourseSummary] { visibleCourses.filter { $0.currentScore != nil } }
    private var average: Double? { scored.isEmpty ? nil : scored.compactMap(\.currentScore).reduce(0, +) / Double(scored.count) }
    private var gradedAssignments: Int { store.bundle.assignments.filter { !features.hiddenCourseIDs.contains($0.courseID) && ($0.submission?.score != nil || $0.submission?.grade != nil) }.count }
    private var gradeSignature: String { store.bundle.courses.map { "\($0.id):\($0.currentScore ?? -1)" }.joined(separator: ",") }
    private var risingCount: Int { scored.filter { course in trend(for: course).map { $0 > 0 } ?? false }.count }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: CPLayout.stack) {
                    if store.needsCanvasConnection {
                        NativeConnectCanvasCard(store: store)
                    } else if store.isLoading && store.bundle.courses.isEmpty {
                        CPSkeletonCard()
                        CPSkeletonCard()
                        CPSkeletonCard()
                    } else {
                        gradesHero
                        CPSectionLabel("Your classes", count: courses.count).padding(.top, 8)
                        ForEach(courses) { course in gradeCard(course) }
                        if courses.isEmpty && !store.isLoading {
                            CPGlassCard { NativeEmptyState(title: search.isEmpty ? "No active courses." : "No matching assignments found.", symbol: "chart.bar") }
                        }
                        NavigationLink { GradeCalculatorView() } label: {
                            HStack(spacing: 12) {
                                CPIconBadge(symbol: "function")
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("What-if grade calculator").cpFont(13, .semibold).foregroundStyle(CPTheme.foreground(scheme))
                                    Text("Plan the score you need on what's left").cpFont(11).foregroundStyle(CPTheme.muted(scheme))
                                }
                                Spacer()
                                Image(systemName: "chevron.right").cpIconFont(9, .bold).foregroundStyle(CPTheme.faint(scheme))
                            }
                            .padding(CPLayout.cardPadding)
                            .cpSurface()
                        }
                        .buttonStyle(CPPressStyle())
                        .padding(.top, 4)
                    }
                }
                .cpPagePadding()
            }
            .background(CPBackdrop())
            .cpStateChange(store.isLoading && store.bundle.courses.isEmpty)
            .cpNavigationTitle("Grades").navigationBarTitleDisplayMode(.inline)
            .searchable(text: $search, prompt: "Find a course or graded assignment")
            .refreshable { await store.load() }
            .onAppear { loadAndRecordGrades() }.onChange(of: gradeSignature) { _, _ in loadAndRecordGrades() }
        }
    }

    private var gradesHero: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .center, spacing: 16) {
                CPRing(progress: (average ?? 0) / 100, color: CPTheme.gradeColor(average), lineWidth: 6) {
                    VStack(spacing: 0) {
                        Text(NativeParity.courseLetter(nil, score: average)).cpFont(17, .semibold).foregroundStyle(CPTheme.gradeColor(average))
                    }
                }
                .frame(width: 64, height: 64)
                VStack(alignment: .leading, spacing: 3) {
                    Text("CURRENT AVERAGE").cpFont(11, .semibold).tracking(0.6).foregroundStyle(CPTheme.muted(scheme))
                    CountUpGrade(value: average, size: 30, color: CPTheme.foreground(scheme))
                    Text("Across \(scored.count) graded \(scored.count == 1 ? "class" : "classes")").cpFont(11).foregroundStyle(CPTheme.muted(scheme))
                }
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
            HStack(spacing: 8) {
                CPStatTile(value: "\(scored.count)", label: "Courses graded")
                CPStatTile(value: "\(risingCount)", label: "Trending up", symbol: "arrow.up.right", tone: .accent)
                CPStatTile(value: "\(gradedAssignments)", label: "Grades posted")
            }
        }
        .padding(.horizontal, 4).padding(.top, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func trend(for course: CourseSummary) -> Double? { guard let current = course.currentScore, let previous = gradeHistory[course.id]?.first(where: { abs($0 - current) > 0.05 }) else { return nil }; return current - previous }

    private func gradeCard(_ course: CourseSummary) -> some View {
        let color = CPTheme.gradeColor(course.currentScore)
        let graded = store.bundle.assignments.filter { item in
            item.courseID == course.id &&
            (item.submission?.score != nil || !((item.submission?.grade ?? "").isEmpty)) &&
            (search.isEmpty || item.name.localizedCaseInsensitiveContains(search) || store.displayName(courseID: course.id, fallback: course.name).localizedCaseInsensitiveContains(search))
        }
        let isOpen = expanded.contains(course.id) || !search.isEmpty
        return VStack(alignment: .leading, spacing: 12) {
            NavigationLink { CourseDetailView(course: course, store: store, features: features, initialSection: .graded) } label: {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 10) {
                        Circle().fill(color).frame(width: 8, height: 8)
                        Text(store.displayName(courseID: course.id, fallback: course.name))
                            .cpFont(13, .semibold).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(2)
                        Spacer(minLength: 6)
                        Image(systemName: "chevron.right").cpIconFont(9, .bold).foregroundStyle(CPTheme.faint(scheme))
                    }
                    HStack(alignment: .lastTextBaseline, spacing: 8) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("CURRENT GRADE").cpFont(11, .semibold).tracking(1).foregroundStyle(CPTheme.muted(scheme))
                            CountUpGrade(value: course.currentScore, size: 24, color: color)
                        }
                        let letter = NativeParity.courseLetter(course.currentGrade, score: course.currentScore)
                        if letter != "—" {
                            Text(letter).cpFont(11, .bold).foregroundStyle(color)
                                .padding(.horizontal, 7).frame(height: 20)
                                .background(color.opacity(scheme == .dark ? 0.14 : 0.10), in: Capsule())
                        }
                        Spacer(minLength: 6)
                        trendLabel(course)
                    }
                    VStack(alignment: .leading, spacing: 5) {
                        HStack {
                            Text("Progress")
                            Spacer()
                            Text("\(graded.count) graded")
                        }
                        .cpFont(11).foregroundStyle(CPTheme.muted(scheme))
                        CPProgressBar(value: (course.currentScore ?? 0) / 100, color: color)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(CPPressStyle())
            Button {
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
                    if expanded.contains(course.id) { expanded.remove(course.id) } else { expanded.insert(course.id) }
                }
            } label: {
                HStack {
                    Text(isOpen ? "Hide graded work" : "Show graded work")
                    Spacer()
                    Image(systemName: "chevron.down").cpIconFont(9, .bold).rotationEffect(.degrees(isOpen ? 180 : 0))
                }
                .cpFont(11, .semibold)
                .foregroundStyle(CPTheme.foreground(scheme))
                .frame(minHeight: 32)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!search.isEmpty)
            if isOpen {
                VStack(spacing: 0) {
                    if graded.isEmpty {
                        Text("No graded assignments yet.").cpFont(11).foregroundStyle(CPTheme.muted(scheme)).frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8)
                    }
                    ForEach(graded) { item in
                        NavigationLink { CourseDetailView(course: course, store: store, features: features, highlightAssignment: item) } label: {
                            HStack(spacing: 10) {
                                Text(item.name).cpFont(12).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(2)
                                Spacer(minLength: 6)
                                NativeScoreBadge(assignment: item)
                            }
                            .padding(.vertical, 9)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(CPPressStyle())
                        if item.id != graded.last?.id { CPRowDivider() }
                    }
                }
                .padding(.horizontal, 12)
                .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: CPLayout.innerRadius, style: .continuous))
            }
        }
        .padding(CPLayout.cardPadding)
        .cpSurface()
    }

    @ViewBuilder private func trendLabel(_ course: CourseSummary) -> some View {
        if let trend = trend(for: course) {
            CPPill(text: "\(trend > 0 ? "+" : "−")\(abs(trend).formatted(.number.precision(.fractionLength(1)))) pts", tone: trend > 0 ? .accent : .neutral, symbol: trend > 0 ? "arrow.up" : "arrow.down")
                .accessibilityLabel(trend > 0 ? "Grade up" : "Grade down")
        } else {
            CPPill(text: "Steady", symbol: "minus").accessibilityLabel("No grade change")
        }
    }

    private func loadAndRecordGrades() {
        let historyKey = "CanvasProNativeGradeHistory.\(store.persistenceScope)"
        if let saved = UserDefaults.standard.data(forKey: historyKey), let decoded = try? JSONDecoder().decode([Int: [Double]].self, from: saved) { gradeHistory = decoded }
        for course in store.bundle.courses { guard let score = course.currentScore else { continue }; if gradeHistory[course.id]?.first != score { gradeHistory[course.id, default: []].insert(score, at: 0); gradeHistory[course.id] = Array(gradeHistory[course.id, default: []].prefix(20)) } }
        if let data = try? JSONEncoder().encode(gradeHistory) { UserDefaults.standard.set(data, forKey: historyKey) }
    }
}

/// "18 / 20" with the percent in a soft grade-colored tag.
struct NativeScoreBadge: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let assignment: AssignmentItem
    var body: some View {
        let earned = assignment.submission?.score
        let possible = assignment.pointsPossible
        let percent = earned.flatMap { score in possible.flatMap { $0 > 0 ? score / $0 * 100 : nil } }
        let color = CPTheme.gradeColor(percent)
        HStack(spacing: 6) {
            Text("\(earned.map { $0.formatted() } ?? (assignment.submission?.grade ?? "—"))\(possible.map { " / \($0.formatted())" } ?? "")")
                .cpFont(11, .medium).monospacedDigit().foregroundStyle(CPTheme.foreground(scheme).opacity(0.85))
            if let percent {
                Text("\(Int(percent.rounded()))%").cpFont(11, .bold).monospacedDigit().foregroundStyle(color)
                    .padding(.horizontal, 6).frame(height: 18)
                    .background(color.opacity(scheme == .dark ? 0.14 : 0.10), in: Capsule())
            }
        }
        .fixedSize()
    }
}

struct CourseRow: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let course: CourseSummary; @ObservedObject var store: NativeContentStore
    var body: some View {
        HStack(spacing: 10) {
            Circle().fill(gradeColor).frame(width: 7, height: 7)
            VStack(alignment: .leading, spacing: 2) {
                Text(store.displayName(courseID: course.id, fallback: course.name)).cpFont(12, .medium).lineLimit(2)
                if !course.courseCode.isEmpty { Text(course.courseCode).cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .trailing, spacing: 1) {
                Text(NativeParity.courseLetter(course.currentGrade, score: course.currentScore)).cpFont(13, .semibold).foregroundStyle(gradeColor)
                if let score = course.currentScore { Text("\(score.formatted(.number.precision(.fractionLength(1))))%").cpFont(11).monospacedDigit().foregroundStyle(CPTheme.muted(scheme)) }
            }
            .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.vertical, 2)
    }
    private var gradeColor: Color { CPTheme.gradeColor(course.currentScore) }
}

struct NativeAssignmentDescriptionLink: View {
    let assignment: AssignmentItem
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    var body: some View {
        NavigationLink {
            if let course = store.bundle.courses.first(where: { $0.id == assignment.courseID }) {
                CourseDetailView(course: course, store: store, features: features, highlightAssignment: assignment)
            } else {
                AssignmentDetailView(assignment: assignment, store: store, features: features)
            }
        } label: { Label("See description", systemImage: "doc.text") }
        .buttonStyle(CPPressStyle())
    }
}

enum CourseDetailSection: String, CaseIterable {
    case upcoming = "Upcoming", graded = "Graded", announcements = "Announcements"
}

struct CourseDetailView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let course: CourseSummary
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var section: CourseDetailSection
    @State private var showAllUpcoming = false
    @State private var showAllAnnouncements = false
    @State private var expandedDescriptions: Set<Int> = []
    @State private var highlightedID: Int?
    @State private var showSyllabus = false
    private let targetAssignment: AssignmentItem?

    init(course: CourseSummary, store: NativeContentStore, features: NativeFeatureStore, initialSection: CourseDetailSection = .upcoming, highlightAssignment: AssignmentItem? = nil) {
        self.course = course
        self.store = store
        self.features = features
        _section = State(initialValue: initialSection)
        targetAssignment = highlightAssignment
        if let item = highlightAssignment {
            _section = State(initialValue: !item.isVisible(in: store) && (item.submission?.score != nil || !(item.submission?.grade ?? "").isEmpty) ? .graded : .upcoming)
            _showAllUpcoming = State(initialValue: true)
            _expandedDescriptions = State(initialValue: [item.id])
            _highlightedID = State(initialValue: item.id)
        }
    }

    private var courseName: String { store.displayName(courseID: course.id, fallback: course.name) }
    private var courseAssignments: [AssignmentItem] {
        store.bundle.assignments.filter { $0.courseID == course.id } +
        features.customAssignments.filter { $0.courseID == course.id }.map { AssignmentItem.custom($0, course: course) }
    }
    private var upcoming: [AssignmentItem] { courseAssignments.filter { $0.isVisible(in: store) || $0.id == targetAssignment?.id }.sorted(by: AssignmentItem.dueSort) }
    private var upcomingThreeWeeks: [AssignmentItem] {
        let cutoff = Date().addingTimeInterval(21 * 86400)
        return upcoming.filter { item in
            guard let dueDate = item.dueDate else { return true }
            return dueDate <= cutoff
        }
    }
    private var graded: [AssignmentItem] {
        courseAssignments.filter { $0.submission?.score != nil || !($0.submission?.grade ?? "").isEmpty }
            .sorted { ($0.submission?.submittedAt ?? $0.dueAt ?? "") > ($1.submission?.submittedAt ?? $1.dueAt ?? "") }
    }
    private var announcements: [AnnouncementItem] {
        store.bundle.announcements.filter { $0.courseID == course.id && $0.isWithin(weeks: features.announcementWeeks) }
            .sorted { $0.postedAt > $1.postedAt }
    }
    private var recentAnnouncements: [AnnouncementItem] { announcements.filter { item in ISO8601DateFormatter.canvasDate(from: item.postedAt).map { $0 >= Date().addingTimeInterval(-21 * 86400) } ?? true } }
    private var matchingSchedule: [ClassScheduleEntry] {
        let values = [course.name, course.courseCode, courseName].map { normalize($0) }
        return features.schedule.filter { entry in
            if entry.canvasCourseID == course.id { return true }
            let candidates = [entry.title, entry.code].map { normalize($0) }
            return candidates.contains { candidate in values.contains { value in candidate == value || (candidate.count > 3 && value.contains(candidate)) || (value.count > 3 && candidate.contains(value)) } }
        }
    }
    private var scheduleText: String? {
        if !matchingSchedule.isEmpty {
            return matchingSchedule.map { entry in
                let days = entry.days.map { fullDay($0) }.joined(separator: ", ")
                return "\(days) · \(time(entry.startMinutes))–\(time(entry.endMinutes))\(entry.location.isEmpty ? "" : " · \(entry.location)")"
            }.joined(separator: "\n")
        }
        let names = [course.name, course.courseCode].map { normalize($0) }
        guard let event = store.bundle.calendar.first(where: { event in
            if event.contextCode == "course_\(course.id)" { return true }
            let title = normalize(event.title)
            return names.contains { value in !value.isEmpty && (title.contains(value) || value.contains(title)) }
        }), let startAt = event.startAt, let date = ISO8601DateFormatter.canvasDate(from: startAt) else { return nil }
        return date.formatted(.dateTime.weekday(.abbreviated).hour().minute()) + (event.locationName.map { " · \($0)" } ?? "")
    }
    private var gradeColor: Color { CPTheme.gradeColor(course.currentScore) }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: CPLayout.stack) {
                    hero
                    CPSegmented(selection: Binding(get: { section.rawValue }, set: { value in section = CourseDetailSection(rawValue: value) ?? .upcoming }), options: CourseDetailSection.allCases.map { "\($0.rawValue)" }, label: "Class sections")
                        .padding(.top, 4)
                    sectionContent
                        .id(section)
                        .transition(.opacity)
                }
                .cpPagePadding()
            }
            .background(CPBackdrop())
            .task(id: targetAssignment?.id) {
                guard let id = targetAssignment?.id else { return }
                do {
                    try await Task.sleep(for: .milliseconds(150))
                    withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.25)) { proxy.scrollTo(id, anchor: .center) }
                    try await Task.sleep(for: .seconds(3))
                    withAnimation(.easeOut(duration: 0.3)) { highlightedID = nil }
                } catch { }
            }
        }
        .cpNavigationTitle(courseName)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showSyllabus) {
            NavigationStack {
                ScrollView {
                    Text(course.syllabusBody?.strippingHTML ?? "No syllabus available.")
                        .cpFont(14).lineSpacing(4).textSelection(.enabled)
                        .foregroundStyle(CPTheme.foreground(scheme).opacity(0.9))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(20)
                }
                .background(CPBackdrop())
                .cpNavigationTitle("Syllabus")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { showSyllabus = false } } }
            }
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(course.courseCode.isEmpty ? "CLASS OVERVIEW" : course.courseCode.uppercased())
                        .cpFont(11, .semibold).tracking(0.6).foregroundStyle(CPTheme.muted(scheme)).lineLimit(2)
                    Text(courseName).cpFont(22, .regular).tracking(-0.6).foregroundStyle(CPTheme.foreground(scheme))
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    Text("\(courseAssignments.count) assignments").cpFont(11).foregroundStyle(CPTheme.muted(scheme))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                CPRing(progress: (course.currentScore ?? 0) / 100, color: gradeColor, lineWidth: 5) {
                    VStack(spacing: 0) {
                        Text(course.currentScore.map { "\($0.formatted(.number.precision(.fractionLength(1))))" } ?? "—")
                            .cpFont(14, .semibold).monospacedDigit().foregroundStyle(CPTheme.foreground(scheme))
                            .lineLimit(1).minimumScaleFactor(0.7)
                        Text(NativeParity.courseLetter(course.currentGrade, score: course.currentScore)).cpFont(11, .bold).foregroundStyle(gradeColor)
                    }
                    .padding(8)
                }
                .frame(width: 66, height: 66)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Current grade \(course.currentScore.map { "\($0.formatted(.number.precision(.fractionLength(1)))) percent" } ?? "not available")")
            }
            CPRowDivider()
            HStack(alignment: .center, spacing: 10) {
                if let scheduleText {
                    Label { Text(scheduleText).fixedSize(horizontal: false, vertical: true) } icon: { Image(systemName: "clock") }
                        .cpFont(12).foregroundStyle(CPTheme.muted(scheme))
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    NavigationLink { ClassScheduleView(features: features, store: store) } label: { CPLinkLabel(text: "Enter class time/days", symbol: "plus") }
                        .buttonStyle(.plain)
                    Spacer(minLength: 0)
                }
                // The syllabus lives on the class page only.
                if course.syllabusBody?.isEmpty == false {
                    Button { showSyllabus = true } label: { Label("Syllabus", systemImage: "doc.text") }
                        .buttonStyle(CPButtonStyle(kind: .secondary))
                        .accessibilityLabel("Open \(courseName) syllabus")
                }
            }
            HStack(spacing: 8) {
                CPStatTile(value: "\(upcoming.count)", label: "Upcoming")
                CPStatTile(value: "\(graded.count)", label: "Graded")
                CPStatTile(value: "\(announcements.count)", label: "Announcements")
            }
        }
        .padding(16)
        .background(
            LinearGradient(colors: [gradeColor.opacity(scheme == .dark ? 0.10 : 0.07), .clear], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 22, style: .continuous)
        )
        .cpSurface(strong: true, radius: 22)
    }

    @ViewBuilder private var sectionContent: some View {
        switch section {
        case .upcoming: upcomingSection
        case .graded: gradedSection
        case .announcements: announcementsSection
        }
    }

    private var upcomingSection: some View {
        let items = showAllUpcoming ? upcoming : upcomingThreeWeeks
        return VStack(alignment: .leading, spacing: 8) {
            CPSectionLabel("Upcoming", count: upcoming.count) {
                if upcoming.count > upcomingThreeWeeks.count {
                    Button(showAllUpcoming ? "Show less" : "View all") { showAllUpcoming.toggle() }.cpFont(11, .semibold).frame(minHeight: 32)
                }
            }
            if upcoming.isEmpty { CPGlassCard { NativeEmptyState(title: "All caught up!", symbol: "checkmark.circle", detail: "No upcoming assignments due for this class.") } }
            else {
                if !showAllUpcoming && upcoming.count > upcomingThreeWeeks.count {
                    Text("Only showing the next 3 weeks.").cpFont(11).foregroundStyle(CPTheme.faint(scheme)).padding(.horizontal, 4)
                }
                assignmentList(items, graded: false)
            }
        }
    }

    private var gradedSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            CPSectionLabel("Graded", count: graded.count)
            if graded.isEmpty { CPGlassCard { NativeEmptyState(title: "No graded assignments", symbol: "checkmark.circle", detail: "No graded assignments recorded yet.") } }
            else { assignmentList(graded, graded: true) }
        }
    }

    private func assignmentList(_ items: [AssignmentItem], graded isGraded: Bool) -> some View {
        LazyVStack(spacing: 0) {
            ForEach(items) { assignment in
                courseAssignmentRow(assignment, graded: isGraded)
                if assignment.id != items.last?.id { CPRowDivider() }
            }
        }
        .padding(.horizontal, 14)
        .cpSurface()
    }

    private var announcementsSection: some View {
        let items = showAllAnnouncements ? announcements : recentAnnouncements
        return VStack(alignment: .leading, spacing: 8) {
            CPSectionLabel("Announcements", count: announcements.count) {
                if announcements.count > recentAnnouncements.count {
                    Button(showAllAnnouncements ? "Show less" : "View all") { showAllAnnouncements.toggle() }.cpFont(11, .semibold).frame(minHeight: 32)
                }
            }
            if announcements.isEmpty { CPGlassCard { NativeEmptyState(title: "No announcements", symbol: "megaphone", detail: "No announcements posted for this course.") } }
            else {
                if !showAllAnnouncements && announcements.count > recentAnnouncements.count {
                    Text("Only showing the past 3 weeks.").cpFont(11).foregroundStyle(CPTheme.faint(scheme)).padding(.horizontal, 4)
                }
                VStack(spacing: 0) {
                    ForEach(items) { item in
                        NavigationLink { AnnouncementDetailView(item: item) } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(alignment: .firstTextBaseline) {
                                    Text(item.title).cpFont(13, .semibold).foregroundStyle(CPTheme.foreground(scheme)).fixedSize(horizontal: false, vertical: true)
                                    Spacer(minLength: 8)
                                    Text(announcementDate(item)).cpFont(11).foregroundStyle(CPTheme.faint(scheme))
                                }
                                Text(item.message.strippingHTML).cpFont(11).lineSpacing(2).foregroundStyle(CPTheme.muted(scheme)).lineLimit(3)
                                Text("Read full announcement").cpFont(11, .semibold).foregroundStyle(CPTheme.foreground(scheme))
                            }
                            .padding(.vertical, 11)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(CPPressStyle())
                        if item.id != items.last?.id { CPRowDivider() }
                    }
                }
                .padding(.horizontal, 14)
                .cpSurface()
            }
        }
    }

    private func courseAssignmentRow(_ assignment: AssignmentItem, graded isGraded: Bool) -> some View {
        let isOpen = expandedDescriptions.contains(assignment.id)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                if !isGraded { NativeCompletionButton(assignment: assignment, store: store).padding(.top, 1) }
                VStack(alignment: .leading, spacing: 4) {
                    Text(assignment.name).cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme))
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 6) {
                        if let date = assignment.dueDate {
                            Text(date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().hour().minute()))
                        } else {
                            Text("No due date")
                        }
                        if let points = assignment.pointsPossible { Text("· \(points.formatted()) pts") }
                    }
                    .cpFont(11).monospacedDigit().foregroundStyle(CPTheme.muted(scheme))
                    Button {
                        if isOpen { expandedDescriptions.remove(assignment.id) } else { expandedDescriptions.insert(assignment.id) }
                    } label: {
                        Text(isOpen ? "Hide description" : "See description").cpFont(11, .semibold).foregroundStyle(CPTheme.foreground(scheme))
                            .frame(minHeight: 26).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if isGraded { NativeScoreBadge(assignment: assignment) }
                else if !isGraded, let countdown = NativeParity.countdown(assignment, completed: assignment.isFinished(in: store)) {
                    Text(countdown.label).cpFont(11, .medium).foregroundStyle(CPTheme.urgency(countdown.urgency, scheme: scheme)).fixedSize()
                }
            }
            if isOpen {
                let description = assignment.description?.strippingHTML ?? ""
                VStack(alignment: .leading, spacing: 8) {
                    Text(description.isEmpty ? "Canvas does not provide a description for this assignment." : description)
                        .cpFont(12).lineSpacing(3).foregroundStyle(CPTheme.foreground(scheme).opacity(0.85))
                        .textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 14) {
                        NavigationLink("Assignment details") { AssignmentDetailView(assignment: assignment, store: store, features: features) }
                        if let url = URL(string: assignment.htmlURL), url.scheme == "https" { Link("Open in Canvas", destination: url) }
                    }
                    .cpFont(11, .semibold)
                    .foregroundStyle(CPTheme.foreground(scheme))
                    .frame(minHeight: 28)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: CPLayout.innerRadius, style: .continuous))
            }
        }
        .padding(.vertical, 11)
        .background(highlightedID == assignment.id ? CPTheme.foreground(scheme).opacity(0.07) : .clear, in: RoundedRectangle(cornerRadius: 10))
        .id(assignment.id)
        .cpStateChange(isOpen)
    }

    private func normalize(_ value: String) -> String { value.lowercased().filter { $0.isLetter || $0.isNumber } }
    private func fullDay(_ value: String) -> String { ["M": "Monday", "T": "Tuesday", "W": "Wednesday", "R": "Thursday", "F": "Friday", "S": "Saturday", "U": "Sunday"][value] ?? value }
    private func time(_ minutes: Int) -> String { let hour = minutes / 60; let minute = minutes % 60; return String(format: "%d:%02d %@", hour % 12 == 0 ? 12 : hour % 12, minute, hour < 12 ? "AM" : "PM") }
    private func announcementDate(_ item: AnnouncementItem) -> String { ISO8601DateFormatter.canvasDate(from: item.postedAt)?.formatted(.dateTime.month(.abbreviated).day().year()) ?? "Recent" }
}

private struct CountUpGrade: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let value: Double?; let size: CGFloat; let color: Color
    @State private var displayed = 0.0
    var body: some View {
        Group {
            if let value { AnimatedNumberText(value: displayed, size: size, color: color) }
            else { Text("—").cpFont(size, .semibold).foregroundStyle(color) }
        }
        .onAppear { animate(to: value) }
        .onChange(of: value) { _, next in animate(to: next) }
    }
    private func animate(to target: Double?) {
        guard let target else { displayed = 0; return }
        if reduceMotion { displayed = target }
        else { withAnimation(.easeOut(duration: 0.7)) { displayed = target } }
    }
}

private struct AnimatedNumberText: View, Animatable {
    var value: Double; let size: CGFloat; let color: Color
    var animatableData: Double { get { value } set { value = newValue } }
    var body: some View { Text("\(value, specifier: "%.1f")%").cpFont(size, .semibold).tracking(-0.8).monospacedDigit().lineLimit(1).minimumScaleFactor(0.5).foregroundStyle(color) }
}

private struct GradeGroup: Identifiable {
    let id: UUID
    var name: String
    var weight: String
    var score: String
    init(name: String, weight: String, score: String) { id = UUID(); self.name = name; self.weight = weight; self.score = score }
}

private struct GradeCalculatorView: View {
    @State private var rows = [GradeGroup(name: "Homework", weight: "20", score: "92"), GradeGroup(name: "Quizzes", weight: "20", score: "85"), GradeGroup(name: "Midterm", weight: "25", score: "78"), GradeGroup(name: "Final exam", weight: "35", score: "")]
    @State private var target = "90"
    private var gradedWeight: Double { rows.reduce(0) { $0 + ((Double($1.weight) ?? 0) > 0 && Double($1.score) != nil ? (Double($1.weight) ?? 0) : 0) } }
    private var ungradedWeight: Double { rows.reduce(0) { $0 + ((Double($1.weight) ?? 0) > 0 && Double($1.score) == nil ? (Double($1.weight) ?? 0) : 0) } }
    private var totalWeight: Double { gradedWeight + ungradedWeight }
    private var earned: Double { rows.reduce(0) { $0 + ((Double($1.weight) ?? 0) > 0 ? (Double($1.weight) ?? 0) * (Double($1.score) ?? 0) / 100 : 0) } }
    private var current: Double? { gradedWeight > 0 ? earned / gradedWeight * 100 : nil }
    private var projected: Double? { totalWeight > 0 ? earned / totalWeight * 100 : nil }
    private var needed: Double? { guard let goal = Double(target), ungradedWeight > 0, totalWeight > 0 else { return nil }; return (goal / 100 * totalWeight - earned) / (ungradedWeight / 100) }
    var body: some View {
        Form {
            Section("Weighted grade") {
                Text("Enter each group's weight and score. Leave the score blank for work that is not graded yet.").cpFont(13).foregroundStyle(.secondary)
                ForEach($rows) { $row in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack { TextField("Group name", text: $row.name); Button(role: .destructive) { rows.removeAll { $0.id == row.id } } label: { Image(systemName: "trash").frame(width: 44, height: 44) }.buttonStyle(.borderless).accessibilityLabel(row.name.isEmpty ? "Remove group" : "Remove \(row.name)") }
                        HStack { TextField("Weight %", text: $row.weight).keyboardType(.decimalPad); TextField("Score % (optional)", text: $row.score).keyboardType(.decimalPad) }
                    }
                }
                Button { rows.append(GradeGroup(name: "", weight: "", score: "")) } label: { Label("Add group", systemImage: "plus") }
            }
            Section("Results") {
                LabeledContent("Grade now", value: current.map { "\($0.formatted(.number.precision(.fractionLength(1))))%" } ?? "—")
                Text("Based on \(gradedWeight.formatted())% of the course graded").cpFont(12).foregroundStyle(.secondary)
                LabeledContent("Projected if remaining scores zero", value: (ungradedWeight > 0 ? projected : current).map { "\($0.formatted(.number.precision(.fractionLength(1))))%" } ?? "—")
                LabeledContent("Weights total", value: "\(totalWeight.formatted())%")
                if totalWeight != 100 { Text("Weights should total 100%.").cpFont(12).foregroundStyle(.orange) }
            }
            Section("What do I need on the final?") {
                TextField("Grade I want", text: $target).keyboardType(.decimalPad)
                if let needed { Text(needed > 100 ? "You would need \(needed.formatted(.number.precision(.fractionLength(1))))% on remaining work, above 100%." : "Average \(needed.formatted(.number.precision(.fractionLength(1))))% on remaining work to finish at your target.") }
                else { Text("Leave at least one score blank and enter a target grade.").foregroundStyle(.secondary) }
            }
        }.cpListScreen().cpNavigationTitle("Grade Calculator")
    }
}

private struct StoredNativeStudySession: Codable {
    let selected: [Int]
    let duration: Int
    let remaining: Int
    let running: Bool
    let currentIndex: Int
    let savedAt: Date
    let manualTasks: [AssignmentItem]?
    let completedIDs: [Int]?
    let finished: Bool?
    let started: Bool?
    let pomodoroPlan: NativePomodoroPlan?
    let phase: String?
    let round: Int?
    let blockEndsAt: Date?
}

private struct NativePomodoroPlan: Codable {
    let focus: Int
    let shortBreak: Int
    let longBreak: Int
    let rounds: Int

    func minutes(for phase: String) -> Int {
        phase == "short-break" ? shortBreak : phase == "long-break" ? longBreak : focus
    }
}

struct NativeStudyView: View {
    @Binding private var requestedAssignment: AssignmentItem?
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var selected: Set<Int>; @State private var selectedOrder: [Int]; @State private var manualTasks: [AssignmentItem]; @State private var completedIDs: Set<Int>; @State private var sessionFinished: Bool; @State private var sessionStarted: Bool
    @State private var duration: Int; @State private var remaining: Int; @State private var running: Bool; @State private var currentIndex: Int; @State private var showCompleted = false
    @State private var manualName = ""; @State private var search = ""
    @AppStorage("CanvasProNativePomodoroEnabled") private var pomodoroEnabled = true
    @AppStorage("CanvasProNativePomodoroPreset") private var pomodoroPreset = "classic"
    @AppStorage("CanvasProNativeCustomFocus") private var customFocus = 25
    @AppStorage("CanvasProNativeCustomShortBreak") private var customShortBreak = 5
    @AppStorage("CanvasProNativeCustomLongBreak") private var customLongBreak = 15
    @AppStorage("CanvasProNativeCustomRounds") private var customRounds = 4
    @State private var activePlan: NativePomodoroPlan?
    @State private var phase: String
    @State private var round: Int
    @State private var blockEndsAt: Date?
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private var sessionKey: String { "CanvasProNativeStudySession.\(store.persistenceScope)" }
    private var availableItems: [AssignmentItem] { features.shownAssignments(in: store) + manualTasks }
    private var items: [AssignmentItem] { selectedOrder.compactMap { id in availableItems.first { $0.id == id && selected.contains(id) } } }

    init(store: NativeContentStore, features: NativeFeatureStore, requestedAssignment: Binding<AssignmentItem?> = .constant(nil)) {
        self.store = store; self.features = features
        _requestedAssignment = requestedAssignment
        let key = "CanvasProNativeStudySession.\(store.persistenceScope)"
        let saved = UserDefaults.standard.data(forKey: key).flatMap { try? JSONDecoder().decode(StoredNativeStudySession.self, from: $0) }
        let elapsed = saved?.running == true ? max(0, Int(Date().timeIntervalSince(saved?.savedAt ?? Date()))) : 0
        let restoredRemaining = max(0, (saved?.remaining ?? 25 * 60) - elapsed)
        _selected = State(initialValue: Set(saved?.selected ?? []))
        _selectedOrder = State(initialValue: saved?.selected ?? [])
        _manualTasks = State(initialValue: saved?.manualTasks ?? [])
        _completedIDs = State(initialValue: Set(saved?.completedIDs ?? []))
        _sessionFinished = State(initialValue: saved?.finished ?? false)
        _sessionStarted = State(initialValue: saved?.started ?? (saved?.running == true || restoredRemaining != (saved?.duration ?? 25) * 60))
        _duration = State(initialValue: saved?.duration ?? 25)
        _remaining = State(initialValue: restoredRemaining)
        _running = State(initialValue: saved?.running == true)
        _currentIndex = State(initialValue: saved?.currentIndex ?? 0)
        _activePlan = State(initialValue: saved?.pomodoroPlan)
        _phase = State(initialValue: saved?.phase ?? "focus")
        _round = State(initialValue: saved?.round ?? 0)
        _blockEndsAt = State(initialValue: saved?.running == true ? (saved?.blockEndsAt ?? saved?.savedAt.addingTimeInterval(TimeInterval(saved?.remaining ?? 0))) : nil)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                if sessionFinished { summary.transition(.opacity) }
                else if sessionStarted { activeSession.transition(.opacity) }
                else { setup.transition(.opacity) }
            }
                .cpStateChange(sessionFinished)
                .cpStateChange(sessionStarted)
                .cpNavigationTitle("Study Session")
                .navigationBarTitleDisplayMode(.inline)
                .task(id: requestedAssignment?.id) {
                    guard let item = requestedAssignment else { return }
                    // Keep a running or paused session intact; otherwise seed setup.
                    if !sessionStarted || sessionFinished {
                        selected = [item.id]; selectedOrder = [item.id]
                        duration = NativeParity.estimate(item, estimates: features.estimates)
                        remaining = duration * 60; running = false
                        sessionStarted = false; sessionFinished = false
                        completedIDs = []; currentIndex = 0
                        persistSession()
                    }
                    requestedAssignment = nil
                }
                .onReceive(timer) { _ in tick() }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in tick() }
                .onAppear { tick() }
                .onChange(of: selected) { _, _ in persistSession() }
                .onChange(of: selectedOrder) { _, _ in persistSession() }
                .onChange(of: manualTasks) { _, _ in persistSession() }
                .onChange(of: completedIDs) { _, _ in persistSession() }
                .onChange(of: sessionFinished) { _, _ in persistSession() }
                .onChange(of: sessionStarted) { _, _ in persistSession() }
                .onChange(of: duration) { _, _ in persistSession() }
                .onChange(of: remaining) { _, _ in persistSession() }
                .onChange(of: running) { _, _ in persistSession() }
                .onChange(of: currentIndex) { _, _ in persistSession() }
                .onChange(of: phase) { _, _ in persistSession() }
                .onChange(of: round) { _, _ in persistSession() }
                .onChange(of: blockEndsAt) { _, _ in persistSession() }
        }
    }

    private func persistSession() {
        let value = StoredNativeStudySession(selected: selectedOrder, duration: duration, remaining: remaining, running: running, currentIndex: currentIndex, savedAt: Date(), manualTasks: manualTasks, completedIDs: Array(completedIDs), finished: sessionFinished, started: sessionStarted, pomodoroPlan: activePlan, phase: phase, round: round, blockEndsAt: blockEndsAt)
        if let data = try? JSONEncoder().encode(value) { UserDefaults.standard.set(data, forKey: sessionKey) }
    }
    private var setupCandidates: [AssignmentItem] {
        availableItems.filter { item in
            let matches = search.isEmpty || item.name.localizedCaseInsensitiveContains(search) || item.courseName.localizedCaseInsensitiveContains(search) || store.displayName(courseID: item.courseID, fallback: item.courseName).localizedCaseInsensitiveContains(search)
            let inRange = item.courseID == 0 || !search.isEmpty || (item.dueDate.map { $0 <= NativeParity.endOfUpcomingDay(28) } ?? false)
            return matches && inRange && (item.courseID == 0 || item.isVisible(in: store, showCompleted: showCompleted))
        }.sorted(by: AssignmentItem.dueSort)
    }

    private var setup: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: CPLayout.stack) {
                if store.needsCanvasConnection { NativeConnectCanvasCard(store: store) }
                CPPageHeader(eyebrow: "Study session", title: "One thing at a time.", detail: "Pick what you'll work on, choose how long, and let the timer keep track.")
                    .padding(.bottom, 4)
                if !items.isEmpty { selectedOrderCard }
                CPGlassCard {
                    CPCardHeader(title: "Your session", subtitle: selected.isEmpty ? "Choose one or more tasks" : "\(selected.count) selected") {
                        Button { showCompleted.toggle() } label: { CPChip(text: "Finished", selected: showCompleted) }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Show finished assignments")
                    }
                    HStack(spacing: 8) {
                        Image(systemName: "plus").cpIconFont(10, .bold).foregroundStyle(CPTheme.muted(scheme))
                        TextField("Add your own task", text: $manualName).cpFont(12).submitLabel(.done).onSubmit { addManualTask() }
                            .accessibilityLabel("Add your own task")
                        Button("Add") { addManualTask() }
                            .cpFont(11, .semibold)
                            .disabled(manualName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                    .padding(.horizontal, 12).frame(minHeight: 40)
                    .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass").cpIconFont(10, .bold).foregroundStyle(CPTheme.muted(scheme))
                        TextField("Search assignments or classes", text: $search).cpFont(12)
                            .accessibilityLabel("Search assignments or classes")
                    }
                    .padding(.horizontal, 12).frame(minHeight: 40)
                    .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    if setupCandidates.isEmpty {
                        NativeEmptyState(title: search.isEmpty ? "Nothing due in the next four weeks" : "No matches", symbol: "checkmark.circle", detail: search.isEmpty ? "Add a task of your own above." : nil)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(setupCandidates) { item in
                                candidateRow(item)
                                if item.id != setupCandidates.last?.id { CPRowDivider(leading: 30) }
                            }
                        }
                    }
                }
                durationCard
                Button(action: startSession) {
                    Label(selected.isEmpty ? "Choose a task to begin" : "Start session", systemImage: "play.fill")
                }
                .buttonStyle(CPButtonStyle(kind: .primary, fullWidth: true))
                .disabled(selected.isEmpty)
            }
            .cpPagePadding()
        }
        .background(CPBackdrop())
    }

    private func candidateRow(_ item: AssignmentItem) -> some View {
        let isSelected = selected.contains(item.id)
        return Button {
            if isSelected { selected.remove(item.id); selectedOrder.removeAll { $0 == item.id } }
            else { selected.insert(item.id); selectedOrder.append(item.id) }
        } label: {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .strokeBorder(isSelected ? Color.clear : CPTheme.muted(scheme).opacity(0.55), lineWidth: 1.5)
                    if isSelected {
                        RoundedRectangle(cornerRadius: 6, style: .continuous).fill(CPTheme.foreground(scheme))
                        Image(systemName: "checkmark").cpIconFont(9, .bold).foregroundStyle(CPTheme.background(scheme))
                    }
                }
                .frame(width: 20, height: 20)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name).cpFont(12, .medium).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(2)
                    Text(item.courseID == 0 ? item.courseName : store.displayName(courseID: item.courseID, fallback: item.courseName))
                        .cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1)
                }
                Spacer(minLength: 6)
                if let due = item.dueDate {
                    Text(due.formatted(.dateTime.month(.abbreviated).day())).cpFont(11, .medium).monospacedDigit().foregroundStyle(CPTheme.faint(scheme))
                }
            }
            .padding(.vertical, 9)
            .contentShape(Rectangle())
        }
        .buttonStyle(CPPressStyle())
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var selectedOrderCard: some View {
        CPGlassCard {
            CPCardHeader(title: "Order", subtitle: "You'll work through these from the top")
            VStack(spacing: 0) {
                ForEach(items.indices, id: \.self) { index in
                    let item = items[index]
                    HStack(spacing: 8) {
                        Text("\(index + 1)").cpFont(11, .bold).monospacedDigit()
                            .foregroundStyle(CPTheme.foreground(scheme))
                            .frame(width: 22, height: 22)
                            .background(CPTheme.foreground(scheme).opacity(0.07), in: Circle())
                        Text(item.name).cpFont(12, .medium).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(1)
                        Spacer(minLength: 4)
                        Button { moveSelection(item.id, -1) } label: { Image(systemName: "chevron.up").frame(width: 32, height: 40) }
                            .disabled(index == 0).accessibilityLabel("Move \(item.name) earlier")
                        Button { moveSelection(item.id, 1) } label: { Image(systemName: "chevron.down").frame(width: 32, height: 40) }
                            .disabled(index == items.count - 1).accessibilityLabel("Move \(item.name) later")
                        Button { selected.remove(item.id); selectedOrder.removeAll { $0 == item.id } } label: { Image(systemName: "xmark").frame(width: 32, height: 40) }
                            .accessibilityLabel("Remove \(item.name)")
                    }
                    .cpFont(11, .semibold)
                    .foregroundStyle(CPTheme.muted(scheme))
                    .buttonStyle(.plain)
                    if index < items.count - 1 { CPRowDivider(leading: 30) }
                }
            }
        }
    }

    private var durationCard: some View {
        CPGlassCard {
            CPCardHeader(title: "How long?", subtitle: pomodoroEnabled ? "Focus blocks with short breaks between" : "One timed block") {
                Toggle("Pomodoro", isOn: $pomodoroEnabled).labelsHidden().accessibilityLabel("Pomodoro")
            }
            if pomodoroEnabled {
                Picker("Pomodoro length", selection: $pomodoroPreset) {
                    Text("25 / 5").tag("classic")
                    Text("50 / 10").tag("deep")
                    Text("Custom").tag("custom")
                }
                .pickerStyle(.segmented)
                if pomodoroPreset == "custom" {
                    VStack(spacing: 0) {
                        minutesRow("Focus minutes", value: $customFocus)
                        CPRowDivider()
                        minutesRow("Short break", value: $customShortBreak)
                        CPRowDivider()
                        minutesRow("Long break", value: $customLongBreak)
                        CPRowDivider()
                        minutesRow("Long break every", value: $customRounds, unit: "blocks")
                    }
                    .padding(.horizontal, 12)
                    .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: CPLayout.innerRadius, style: .continuous))
                }
                HStack(spacing: 6) {
                    CPPill(text: "\(chosenPlan.focus)m focus", tone: .accent)
                    CPPill(text: "\(chosenPlan.shortBreak)m break")
                    CPPill(text: "\(chosenPlan.longBreak)m after \(chosenPlan.rounds)")
                }
            } else {
                HStack(spacing: 8) {
                    ForEach([15, 25, 45, 60], id: \.self) { value in
                        Button { duration = value } label: { CPChip(text: "\(value)m", selected: duration == value) }.buttonStyle(.plain)
                    }
                }
                minutesRow("Custom (minutes)", value: $duration)
                    .padding(.horizontal, 12)
                    .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: CPLayout.innerRadius, style: .continuous))
                Text("1 to 480 minutes").cpFont(11).foregroundStyle(CPTheme.faint(scheme))
            }
        }
    }

    private func minutesRow(_ title: String, value: Binding<Int>, unit: String = "min") -> some View {
        HStack {
            Text(title).cpFont(12).foregroundStyle(CPTheme.foreground(scheme))
            Spacer()
            TextField("0", value: value, format: .number)
                .cpFont(12, .semibold).monospacedDigit()
                .keyboardType(.numberPad).multilineTextAlignment(.trailing)
                .frame(width: 56)
                .accessibilityLabel(title)
            Text(unit).cpFont(11).foregroundStyle(CPTheme.muted(scheme))
        }
        .frame(minHeight: 40)
    }

    private var currentItem: AssignmentItem? { items.isEmpty ? nil : items[min(currentIndex, items.count - 1)] }

    private var activeSession: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: CPLayout.stack) {
                VStack(spacing: 18) {
                    HStack {
                        CPPill(text: "\(completedIDs.count) finished", tone: completedIDs.isEmpty ? .neutral : .accent, symbol: "checkmark")
                        Spacer()
                        Text(activePlan.map { cycleText($0) } ?? "\(Int((Double(duration * 60 - remaining) / Double(max(1, duration * 60))) * 100))% of session")
                            .cpFont(11, .medium).foregroundStyle(CPTheme.muted(scheme))
                    }
                    CPRing(progress: Double(blockMinutes * 60 - remaining) / Double(max(1, blockMinutes * 60)), color: phase == "focus" ? CPTheme.primary(scheme: scheme) : CPTheme.warning, lineWidth: 7) {
                        VStack(spacing: 6) {
                            Text(String(format: "%02d:%02d", remaining / 60, remaining % 60))
                                .cpFont(40, .light).tracking(-1.5).monospacedDigit()
                                .lineLimit(1).minimumScaleFactor(0.4)
                                .foregroundStyle(CPTheme.foreground(scheme))
                            Text(running ? phaseLabel : "PAUSED").cpFont(11, .semibold).tracking(1.4)
                                .lineLimit(1).minimumScaleFactor(0.6)
                                .foregroundStyle(CPTheme.muted(scheme))
                        }
                        .padding(.horizontal, 22)
                    }
                    .frame(width: 210, height: 210)
                    .accessibilityElement(children: .combine)
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    if let plan = activePlan { blockDots(plan) }
                    if phase != "focus" {
                        Text("Step away for a moment.").cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme))
                    } else if let item = currentItem {
                        VStack(spacing: 4) {
                            Text("NOW STUDYING").cpFont(11, .semibold).tracking(0.6).foregroundStyle(CPTheme.muted(scheme))
                            Text(item.name).cpFont(15, .semibold).multilineTextAlignment(.center).foregroundStyle(CPTheme.foreground(scheme))
                                .fixedSize(horizontal: false, vertical: true)
                            if !item.courseName.isEmpty {
                                Text(item.courseID == 0 ? item.courseName : store.displayName(courseID: item.courseID, fallback: item.courseName))
                                    .cpFont(11).foregroundStyle(CPTheme.muted(scheme))
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                    HStack(spacing: 22) {
                        Button { navigateTask(-1) } label: { controlCircle("backward.fill", size: 44) }
                            .buttonStyle(CPPressStyle()).accessibilityLabel("Previous assignment").disabled(items.count < 2)
                        Button { togglePause() } label: {
                            Image(systemName: running ? "pause.fill" : "play.fill").cpIconFont(18, .bold)
                                .foregroundStyle(CPTheme.background(scheme))
                                .frame(width: 60, height: 60)
                                .background(CPTheme.foreground(scheme), in: Circle())
                        }
                        .buttonStyle(CPPressStyle()).accessibilityLabel(running ? "Pause" : "Resume")
                        Button { navigateTask(1) } label: { controlCircle("forward.fill", size: 44) }
                            .buttonStyle(CPPressStyle()).accessibilityLabel("Next assignment").disabled(items.count < 2)
                    }
                    HStack(spacing: 8) {
                        Button { finishTask() } label: { Label("Finish task", systemImage: "checkmark") }
                            .buttonStyle(CPButtonStyle(kind: .secondary, fullWidth: true))
                            .disabled(items.isEmpty)
                        if activePlan != nil && phase != "focus" {
                            Button("Skip break") { skipBreak() }.buttonStyle(CPButtonStyle(kind: .quiet, fullWidth: true))
                        }
                    }
                }
                .padding(18)
                .frame(maxWidth: .infinity)
                .cpSurface(strong: true, radius: 22)

                CPGlassCard {
                    CPCardHeader(title: "Up next", subtitle: "\(completedIDs.count) of \(items.count) finished")
                    VStack(spacing: 0) {
                        ForEach(items.indices, id: \.self) { index in
                            let item = items[index]
                            let done = completedIDs.contains(item.id)
                            Button { currentIndex = index } label: {
                                HStack(spacing: 10) {
                                    Text("\(index + 1)").cpFont(11, .bold).monospacedDigit()
                                        .foregroundStyle(currentIndex == index ? CPTheme.background(scheme) : CPTheme.muted(scheme))
                                        .frame(width: 22, height: 22)
                                        .background(currentIndex == index ? CPTheme.foreground(scheme) : CPTheme.inset(scheme), in: Circle())
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.name).cpFont(12, .medium).strikethrough(done)
                                            .foregroundStyle(done ? CPTheme.muted(scheme) : CPTheme.foreground(scheme)).lineLimit(2)
                                        if !item.courseName.isEmpty { Text(item.courseName).cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1) }
                                    }
                                    Spacer(minLength: 6)
                                    if done { Image(systemName: "checkmark").cpIconFont(10, .bold).foregroundStyle(CPTheme.foreground(scheme)) }
                                }
                                .padding(.vertical, 9)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(CPPressStyle())
                            .accessibilityAddTraits(currentIndex == index ? .isSelected : [])
                            if index < items.count - 1 { CPRowDivider(leading: 32) }
                        }
                    }
                }
                Button("End session", role: .destructive) { running = false; blockEndsAt = nil; sessionFinished = true }
                    .buttonStyle(CPButtonStyle(kind: .quiet, fullWidth: true))
                    .foregroundStyle(CPTheme.danger)
            }
            .cpPagePadding()
        }
        .background(CPBackdrop())
    }

    private func controlCircle(_ symbol: String, size: CGFloat) -> some View {
        Image(systemName: symbol).cpIconFont(13, .semibold)
            .foregroundStyle(CPTheme.foreground(scheme))
            .frame(width: size, height: size)
            .background(CPTheme.inset(scheme), in: Circle())
    }

    private func blockDots(_ plan: NativePomodoroPlan) -> some View {
        let done = phase == "long-break" ? plan.rounds : round % plan.rounds
        return HStack(spacing: 6) {
            ForEach(0..<plan.rounds, id: \.self) { index in
                Capsule()
                    .fill(index < done ? CPTheme.primary(scheme: scheme) : index == done && phase == "focus" ? CPTheme.primary(scheme: scheme).opacity(0.45) : CPTheme.inset(scheme))
                    .frame(width: 22, height: 5)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(cycleText(plan))
    }

    private var summary: some View {
        ScrollView {
            VStack(spacing: CPLayout.stack) {
                VStack(spacing: 14) {
                    Image(systemName: "checkmark").cpIconFont(18, .bold)
                        .foregroundStyle(CPTheme.foreground(scheme))
                        .frame(width: 52, height: 52)
                        .background(CPTheme.foreground(scheme).opacity(0.07), in: Circle())
                    VStack(spacing: 4) {
                        Text("Session finished").cpFont(22, .regular).foregroundStyle(CPTheme.foreground(scheme))
                        Text("Nice work. Take a breath before the next thing.").cpFont(12).foregroundStyle(CPTheme.muted(scheme)).multilineTextAlignment(.center)
                    }
                    HStack(spacing: 8) {
                        CPStatTile(value: "\(completedIDs.count) of \(items.count)", label: "Tasks finished", tone: .accent)
                        if activePlan != nil { CPStatTile(value: "\(round)", label: "Focus blocks") }
                    }
                    VStack(spacing: 8) {
                        Button("Plan another") { resetSession(keepSelection: true) }.buttonStyle(CPButtonStyle(kind: .primary, fullWidth: true))
                        Button("Done") { resetSession(keepSelection: false) }.buttonStyle(CPButtonStyle(kind: .quiet, fullWidth: true))
                    }
                }
                .padding(20)
                .frame(maxWidth: .infinity)
                .cpSurface(strong: true, radius: 22)
            }
            .cpPagePadding()
        }
        .background(CPBackdrop())
    }
    private var chosenPlan: NativePomodoroPlan {
        switch pomodoroPreset {
        case "deep": return NativePomodoroPlan(focus: 50, shortBreak: 10, longBreak: 30, rounds: 4)
        case "custom": return NativePomodoroPlan(focus: min(120, max(1, customFocus)), shortBreak: min(30, max(1, customShortBreak)), longBreak: min(60, max(1, customLongBreak)), rounds: min(8, max(2, customRounds)))
        default: return NativePomodoroPlan(focus: 25, shortBreak: 5, longBreak: 15, rounds: 4)
        }
    }
    private var blockMinutes: Int { activePlan?.minutes(for: phase) ?? duration }
    /// Where the student is in the current cycle of focus blocks.
    private func cycleText(_ plan: NativePomodoroPlan) -> String {
        if phase == "long-break" { return "\(plan.rounds) of \(plan.rounds) blocks done" }
        let done = round % plan.rounds
        return phase == "focus" ? "Focus block \(done + 1) of \(plan.rounds)" : "\(done) of \(plan.rounds) blocks done"
    }
    private var phaseLabel: String {
        phase == "long-break" ? "LONG BREAK" : phase == "short-break" ? "SHORT BREAK" : "FOCUS TIME"
    }
    private func startSession() {
        guard !selected.isEmpty else { return }
        duration = min(480, max(1, duration))
        activePlan = pomodoroEnabled ? chosenPlan : nil
        phase = "focus"; round = 0
        completedIDs.removeAll(); currentIndex = 0
        remaining = blockMinutes * 60
        blockEndsAt = Date().addingTimeInterval(TimeInterval(remaining))
        sessionStarted = true; sessionFinished = false; running = true
    }
    private func togglePause() {
        if running {
            tick(); running = false; blockEndsAt = nil
        } else {
            blockEndsAt = Date().addingTimeInterval(TimeInterval(remaining)); running = true
        }
    }
    private func tick() {
        guard sessionStarted, !sessionFinished, running, let end = blockEndsAt else { return }
        let now = Date()
        if now < end { remaining = max(1, Int(ceil(end.timeIntervalSince(now)))); return }
        guard let plan = activePlan else {
            remaining = 0; running = false; blockEndsAt = nil; sessionFinished = true
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            return
        }
        var nextEnd = end
        var nextPhase = phase
        var nextRound = round
        for _ in 0..<24 {
            if now < nextEnd { break }
            if nextPhase == "focus" {
                nextRound += 1
                nextPhase = nextRound % plan.rounds == 0 ? "long-break" : "short-break"
            } else { nextPhase = "focus" }
            nextEnd = nextEnd.addingTimeInterval(TimeInterval(plan.minutes(for: nextPhase) * 60))
        }
        if now >= nextEnd { nextEnd = now.addingTimeInterval(TimeInterval(plan.minutes(for: nextPhase) * 60)) }
        if nextPhase != phase { UINotificationFeedbackGenerator().notificationOccurred(.success) }
        phase = nextPhase; round = nextRound; blockEndsAt = nextEnd
        remaining = max(1, Int(ceil(nextEnd.timeIntervalSince(now))))
    }
    private func skipBreak() {
        guard let plan = activePlan, phase != "focus" else { return }
        phase = "focus"; remaining = plan.focus * 60
        blockEndsAt = Date().addingTimeInterval(TimeInterval(remaining))
        running = true
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func addManualTask() {
        let name = manualName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        let id = -Int(Date().timeIntervalSince1970 * 1000)
        let item = AssignmentItem(id: id, name: name, description: nil, dueAt: nil, htmlURL: "", pointsPossible: nil, courseID: 0, courseName: "Personal task", courseCode: "", submission: nil)
        manualTasks.append(item); selected.insert(id); selectedOrder.append(id); manualName = ""
    }
    /// Moves a task within the visible order. The order can also hold tasks that
    /// no longer exist, so positions are looked up by id, not by row number.
    private func moveSelection(_ id: Int, _ direction: Int) {
        let visible = items.map(\.id)
        guard let row = visible.firstIndex(of: id), visible.indices.contains(row + direction),
              let from = selectedOrder.firstIndex(of: id), let to = selectedOrder.firstIndex(of: visible[row + direction]) else { return }
        selectedOrder.swapAt(from, to)
    }
    private func navigateTask(_ direction: Int) { guard !items.isEmpty else { return }; currentIndex = (currentIndex + direction + items.count) % items.count }
    private func finishTask() { guard items.indices.contains(currentIndex) else { return }; completedIDs.insert(items[currentIndex].id); if completedIDs.count >= items.count { running = false; blockEndsAt = nil; sessionFinished = true; UINotificationFeedbackGenerator().notificationOccurred(.success) } else { for step in 1...items.count { let next = (currentIndex + step) % items.count; if !completedIDs.contains(items[next].id) { currentIndex = next; break } } } }
    private func resetSession(keepSelection: Bool) { running = false; blockEndsAt = nil; activePlan = nil; phase = "focus"; round = 0; sessionFinished = false; sessionStarted = false; completedIDs.removeAll(); remaining = duration * 60; currentIndex = 0; if !keepSelection { selected.removeAll(); selectedOrder.removeAll(); manualTasks.removeAll() } }
}

extension AssignmentItem {
    var dueDate: Date? { dueAt.flatMap { ISO8601DateFormatter.canvasDate(from: $0) } }
    var isCanvasFinished: Bool {
        guard let submission else { return false }
        if submission.excused == true { return true }
        if submission.missing == true { return false }
        if submission.submittedAt != nil || submission.workflowState == "submitted" || submission.workflowState == "pending_review" { return true }
        return submission.workflowState == "graded" && (submission.score != nil || !(submission.grade ?? "").isEmpty)
    }
    var isStaleOverdue: Bool { dueDate.map { $0 < NativeParity.startOfRecentWindow() } ?? false }
    @MainActor func isFinished(in store: NativeContentStore) -> Bool {
        if store.completed.contains(id) { return true }
        guard isCanvasFinished else { return false }
        guard let reopened = store.reopenedAt[id] else { return true }
        return submission?.submittedAt.flatMap { ISO8601DateFormatter.canvasDate(from: $0) }.map { $0 > reopened } ?? false
    }
    @MainActor func isVisible(in store: NativeContentStore, showCompleted: Bool = false) -> Bool {
        if isFinished(in: store) { return showCompleted && NativeParity.isInDisplayWindow(self) }
        if dueAt == nil && (pointsPossible ?? 0) <= 0 { return showCompleted }
        return !isStaleOverdue
    }
    static func dueSort(_ lhs: AssignmentItem, _ rhs: AssignmentItem) -> Bool {
        let left = lhs.dueDate ?? .distantFuture, right = rhs.dueDate ?? .distantFuture
        return left == right ? lhs.name.localizedStandardCompare(rhs.name) == .orderedAscending : left < right
    }
}

extension AnnouncementItem {
    func isWithin(weeks: Int) -> Bool {
        if weeks == 0 { return true }
        guard let posted = ISO8601DateFormatter.canvasDate(from: postedAt) else { return true }
        return posted >= Date().addingTimeInterval(Double(-7 * weeks) * 86400)
    }
}

extension String {
    /// Canvas HTML as readable plain text: block tags become line breaks, list
    /// items become bullets, scripts and styles are dropped, and entities such as
    /// &#8217; or &rsquo; turn back into the characters they stand for.
    /// Cached: Canvas text is cleaned once, not on every redraw.
    var strippingHTML: String {
        if let cached = NativeTextCache.html(for: self) { return cached }
        let value = strippingHTMLUncached
        NativeTextCache.store(html: self, value)
        return value
    }

    private var strippingHTMLUncached: String {
        var text = replacingOccurrences(of: "(?is)<(script|style)\\b[^>]*>.*?</\\1\\s*>", with: "", options: .regularExpression)
        text = text.replacingOccurrences(of: "(?i)<li\\b[^>]*>", with: "\n• ", options: .regularExpression)
        text = text.replacingOccurrences(of: "(?i)<br\\s*/?>|</p>|</div>|</li>|</h[1-6]>|</tr>|</blockquote>", with: "\n", options: .regularExpression)
        text = text.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        text = text.decodingHTMLEntities.replacingOccurrences(of: "\u{00A0}", with: " ")
        text = text.replacingOccurrences(of: "[ \\t]+\\n", with: "\n", options: .regularExpression)
        text = text.replacingOccurrences(of: "\\n{3,}", with: "\n\n", options: .regularExpression)
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Decodes numeric (&#8217; &#x2019;) and common named HTML entities, once.
    var decodingHTMLEntities: String {
        guard contains("&"),
              let pattern = try? NSRegularExpression(pattern: "&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});") else { return self }
        let named: [String: String] = [
            "amp": "&", "lt": "<", "gt": ">", "quot": "\"", "apos": "'", "nbsp": "\u{00A0}",
            "rsquo": "\u{2019}", "lsquo": "\u{2018}", "rdquo": "\u{201D}", "ldquo": "\u{201C}",
            "sbquo": "\u{201A}", "bdquo": "\u{201E}", "ndash": "\u{2013}", "mdash": "\u{2014}",
            "hellip": "\u{2026}", "bull": "\u{2022}", "middot": "\u{00B7}", "prime": "\u{2032}",
            "copy": "\u{00A9}", "reg": "\u{00AE}", "trade": "\u{2122}", "deg": "\u{00B0}",
            "times": "\u{00D7}", "divide": "\u{00F7}", "plusmn": "\u{00B1}", "frac12": "\u{00BD}",
            "frac14": "\u{00BC}", "frac34": "\u{00BE}", "sup2": "\u{00B2}", "sup3": "\u{00B3}",
            "euro": "\u{20AC}", "pound": "\u{00A3}", "cent": "\u{00A2}", "yen": "\u{00A5}",
            "sect": "\u{00A7}", "para": "\u{00B6}", "laquo": "\u{00AB}", "raquo": "\u{00BB}",
            "rarr": "\u{2192}", "larr": "\u{2190}", "le": "\u{2264}", "ge": "\u{2265}", "ne": "\u{2260}",
            "aacute": "\u{00E1}", "eacute": "\u{00E9}", "iacute": "\u{00ED}", "oacute": "\u{00F3}", "uacute": "\u{00FA}",
            "Aacute": "\u{00C1}", "Eacute": "\u{00C9}", "Iacute": "\u{00CD}", "Oacute": "\u{00D3}", "Uacute": "\u{00DA}",
            "ntilde": "\u{00F1}", "Ntilde": "\u{00D1}", "uuml": "\u{00FC}", "ouml": "\u{00F6}", "auml": "\u{00E4}",
            "ccedil": "\u{00E7}", "egrave": "\u{00E8}", "agrave": "\u{00E0}", "ecirc": "\u{00EA}", "iquest": "\u{00BF}", "iexcl": "\u{00A1}",
        ]
        let source = self as NSString
        var result = ""
        var cursor = 0
        for match in pattern.matches(in: self, range: NSRange(location: 0, length: source.length)) {
            result += source.substring(with: NSRange(location: cursor, length: match.range.location - cursor))
            let entity = source.substring(with: match.range(at: 1))
            let replacement: String?
            if entity.hasPrefix("#x") || entity.hasPrefix("#X") {
                replacement = UInt32(entity.dropFirst(2), radix: 16).flatMap { Unicode.Scalar($0) }.map { String(Character($0)) }
            } else if entity.hasPrefix("#") {
                replacement = UInt32(entity.dropFirst()).flatMap { Unicode.Scalar($0) }.map { String(Character($0)) }
            } else {
                replacement = named[entity]
            }
            result += replacement ?? source.substring(with: match.range)
            cursor = match.range.location + match.range.length
        }
        result += source.substring(from: cursor)
        return result
    }
}

extension ISO8601DateFormatter {
    static let canvas: ISO8601DateFormatter = { let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return formatter }()
    static let canvasWithoutFractionalSeconds: ISO8601DateFormatter = { let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime]; return formatter }()
    /// Parsed once per string. Every list sorts and filters by due date many times
    /// per redraw, and ISO 8601 parsing is slow enough to make scrolling stutter.
    static func canvasDate(from value: String) -> Date? {
        if let cached = NativeTextCache.date(for: value) { return cached }
        guard let date = canvas.date(from: value) ?? canvasWithoutFractionalSeconds.date(from: value) else { return nil }
        NativeTextCache.store(date: value, date)
        return date
    }
}

/// Small thread-safe caches for values the app derives from Canvas text.
enum NativeTextCache {
    private static let lock = NSLock()
    private static var dates: [String: Date] = [:]
    private static var cleanedHTML: [String: String] = [:]

    static func date(for key: String) -> Date? {
        lock.lock(); defer { lock.unlock() }
        return dates[key]
    }
    static func store(date key: String, _ value: Date) {
        lock.lock(); defer { lock.unlock() }
        if dates.count > 4000 { dates.removeAll(keepingCapacity: true) }
        dates[key] = value
    }
    static func html(for key: String) -> String? {
        lock.lock(); defer { lock.unlock() }
        return cleanedHTML[key]
    }
    static func store(html key: String, _ value: String) {
        lock.lock(); defer { lock.unlock() }
        if cleanedHTML.count > 600 { cleanedHTML.removeAll(keepingCapacity: true) }
        cleanedHTML[key] = value
    }
}

struct NativeEmptyState: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @State private var appeared = false
    let title: String; let symbol: String; var detail: String? = nil
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: symbol).cpIconFont(14, .semibold)
                .foregroundStyle(CPTheme.foreground(scheme))
                .frame(width: 38, height: 38)
                .background(CPTheme.foreground(scheme).opacity(0.07), in: Circle())
                .accessibilityHidden(true)
            Text(title).cpFont(13, .semibold).foregroundStyle(CPTheme.foreground(scheme)).multilineTextAlignment(.center)
            if let detail { Text(detail).cpFont(11).lineSpacing(2).foregroundStyle(CPTheme.muted(scheme)).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true) }
        }
            .padding(.vertical, 14).padding(.horizontal, 12).frame(maxWidth: .infinity)
            .accessibilityElement(children: .combine)
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared || reduceMotion ? 0 : 5)
            .onAppear { withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) { appeared = true } }
    }
}
