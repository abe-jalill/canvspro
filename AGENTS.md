<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep @tanstack/react-router >= 1.170.39: older versions blank the signed-in pages on first load ("Uncaught undefined") because the client-only layout rendered before its load started.
- Root footer visibility is decided from the URL path, not route matches: matches differ between server and client for the client-only signed-in area.
