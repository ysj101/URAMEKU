# Contributor / coding agent guidance

- Product: ウラメク. Never rename the service without a user request.
- Preserve C-2 canonical character silhouettes; don't regenerate character faces from scratch.
- Treat all assets not manually reviewed as **not release-approved**.
- Keep cases JSON-driven, no pseudo-scientific personality diagnostic.
- Never alter answer keys to make tests pass; check documented facts/denominators.
- Before claiming completion run `python3 scripts/validate_assets.py` and check `qa/coverage.json`.
- User-facing specs must not disclose or name third-party visual inspiration sources.
- This repository is a starter, not a deployed/production-certified application.
