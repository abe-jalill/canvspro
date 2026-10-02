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
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        // Native deep-link routing will be added with the first feature that needs it.
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        // Native universal-link routing will be added with the first feature that needs it.
    }
}
