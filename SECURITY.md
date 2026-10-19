# Security policy

LinguaFlow runs inside the browser on netflix.com pages and handles only local data. If you find a vulnerability (for example a way for page content to execute code through the overlay, or any unintended network access), please **do not open a public issue**. Use GitHub's *Report a vulnerability*: https://github.com/avyronn/linguaflow/security/advisories/new

Design guarantees we rely on: all subtitle text is rendered as text nodes (no `innerHTML`), the manifest requests only `storage` and `https://www.netflix.com/*`, and the only `fetch` calls read files packaged inside the extension.
