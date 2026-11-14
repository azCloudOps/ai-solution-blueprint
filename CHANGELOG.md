# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Native Android and iOS apps (Capacitor 8) for Google Play and the App Store, built and uploaded by GitHub Actions.
- Installable web app (PWA) with offline support.
- My blueprints: keep many blueprints on the device; open, duplicate and delete them. Blueprints saved by 1.0.0 are migrated automatically.
- Native share sheet for Markdown, JSON and SVG exports in the mobile apps; Android back button support.
- IBM Plex Sans bundled so every channel renders the same brand font with no network requests.
- Store listing kit: copy, privacy answers, screenshots, feature graphic and a privacy policy page.

### Changed
- "Start over" is now "New blueprint" and keeps the previous blueprint in My blueprints.
- Share links created in the apps or from a local file point to the hosted web app.

## [1.0.0] - 2026-11-17

Knowledge base 2026.11.0, reviewed 2026-11-14.

### Added
- Eight-step web designer: idea, use case, data, actions and risk, platform, scale and cost, readiness, blueprint.
- Six solution patterns with transparent, rule-based recommendation and reasons.
- Risk tiering (1 to 4) and 31 governance controls mapped to NIST AI RMF, NIST AI 600-1, OWASP Top 10 for LLM Applications, EU AI Act and ISO/IEC 42001.
- Reference architectures for Microsoft Azure (Microsoft Foundry), AWS (Amazon Bedrock and AgentCore), Google Cloud (Gemini Enterprise Agent Platform) and a portable multi-cloud stack.
- Architecture diagram generated as SVG and Mermaid.
- Monthly cost estimate with cost per task and FinOps guardrails.
- Stage-gated production readiness checklist (19 items) and delivery roadmap.
- Exports: Markdown, JSON, SVG, Mermaid, print to PDF; shareable links that carry answers in the URL fragment.
- Zero-dependency CLI: `new`, `render`, `validate`, `example`, `web`, `kb`.
- Monthly release automation: CI, GitHub Pages deploy, tagged releases, knowledge base review issue.

### Verify
- All cloud service names are flagged for verification. Microsoft Ignite 2026 and AWS re:Invent 2026 updates are scheduled for 1.1.0.
