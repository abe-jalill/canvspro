import UIKit
import SwiftUI

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        let host = UIHostingController(rootView: NativeRootView())
        host.view.backgroundColor = UIColor(named: "LaunchBackground")
        window?.backgroundColor = UIColor(named: "LaunchBackground")
        window?.rootViewController = host
        window?.makeKeyAndVisible()

        // A link that launched the app waits in the router until the tabs are on screen.
        if let url = connectionOptions.urlContexts.first?.url { NativeRouter.shared.open(url) }
        if let url = connectionOptions.userActivities.first(where: { $0.activityType == NSUserActivityTypeBrowsingWeb })?.webpageURL {
            NativeRouter.shared.open(url)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        NativeRouter.shared.open(url)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        guard userActivity.activityType == NSUserActivityTypeBrowsingWeb, let url = userActivity.webpageURL else { return }
        NativeRouter.shared.open(url)
    }
}

/// Holds the page a link asked for (canvaspro://assignments, or a canvaspro.app
/// address) until the signed-in tabs can show it.
@MainActor
final class NativeRouter: ObservableObject {
    static let shared = NativeRouter()
    @Published var pendingPath: String?

    func open(_ url: URL) {
        if url.scheme == "canvaspro" {
            // canvaspro://assignments → "/assignments"
            let parts = [url.host(percentEncoded: false), url.path(percentEncoded: false)].compactMap { $0 }
            pendingPath = "/" + parts.joined().trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        } else if let host = url.host(percentEncoded: false), host == "canvaspro.app" || host == "www.canvaspro.app" {
            let path = url.path(percentEncoded: false)
            pendingPath = path.isEmpty || path == "/" ? "/dashboard" : path
        }
    }

    /// Hands the waiting path to the caller once, then clears it.
    func takePendingPath() -> String? {
        defer { pendingPath = nil }
        return pendingPath
    }
}
