# Roadmap

AI Solution Blueprint ships on the **first Tuesday of every month**. Each minor release refreshes the knowledge base and adds at least one feature. Patch releases (x.y.Z) ship whenever a fix is needed.

The knowledge base version follows the calendar (`YYYY.MM.patch`); the tool follows semantic versioning.

## Monthly cycle

| When | What happens |
|---|---|
| 25th of the month | The KB review workflow opens a "Knowledge base review" issue with the checklist |
| Last week | Maintainers verify service names against primary sources and merge community corrections |
| First Monday | Release candidate built from `main`; tests, KB check and visual check |
| First Tuesday | Tag `vX.Y.0`; GitHub Release with the single-file app attached; Pages and the azCloudOps Products page update; release post on azcloudops.org and LinkedIn |

## Planned releases

| Version | Date | Theme |
|---|---|---|
| 1.0.0 | 2026-11-17 | Launch: eight-step designer, four platforms, governance controls, cost estimate, readiness, CLI |
| 1.1.0 | 2026-12-01 | Ignite 2026 and re:Invent 2026 service updates; KubeCon NA 2026 inference updates for the portable stack; first Google Play and App Store builds (store availability follows review) |
| 1.2.0 | 2027-01-05 | Architecture decision record (ADR) export; FOCUS 1.5 aligned cost export (pending ratification) |
| 1.3.0 | 2027-02-02 | Infrastructure as code starters: Bicep, Terraform and CDK skeletons generated from the blueprint |
| 1.4.0 | 2027-03-02 | Low-code path: Copilot Studio, Power Platform and Gemini Enterprise app designs with pro-code extension points |
| 1.5.0 | 2027-04-06 | Evaluation pack: golden dataset template and CI evaluation workflow generated per pattern |
| 1.6.0 | 2027-05-04 | Portfolio view: compare several blueprints, score and prioritise an AI backlog |
| 1.7.0 | 2027-06-01 | Threat model export (STRIDE plus OWASP LLM) and red team test plan |
| 1.8.0 | 2027-07-06 | Localization: Spanish, Portuguese, French, German, Japanese, Hindi |
| 1.9.0 | 2027-08-03 | Industry packs: financial services, healthcare, public sector |
| 1.10.0 | 2027-09-07 | Agent governance pack aligned with EnterpriseAgentGuard (cross-platform agent inventory and policy) |
| 2.0.0 | 2027-10-05 | Plugin knowledge packs so organizations can ship their own internal standards on top of the public knowledge base |

Dates are targets. Themes may move if a major platform change needs to land first.

## Growth goals

The north star is one million people designing AI solutions with the tool. Progress is measured without tracking users:

| Signal | Source |
|---|---|
| Web sessions | GitHub Pages and azcloudops.org traffic analytics (aggregate only) |
| App installs | Google Play Console and App Store Connect (aggregate store statistics) |
| CLI installs | GitHub clone and release download counts; npm downloads once published to the registry |
| Community | GitHub stars, forks, issues, discussions and knowledge base contributions |

| Milestone | Target |
|---|---|
| 1,000 users | Launch month plus conference talks |
| 10,000 users | First quarter after launch |
| 100,000 users | Within twelve months, with localization and industry packs |
| 1,000,000 users | Stretch goal: partner channels, training providers and enterprise adoption |

Levers: a live demo in every conference talk; a monthly "what changed in the knowledge base" post; one blueprint walkthrough article per month on azcloudops.org; shareable blueprint links; university and bootcamp partnerships; translations; Google Play and App Store listings; a VS Code extension (planned after 2.0).
