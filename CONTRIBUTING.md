# Contributing

Thank you for helping IT teams design better AI solutions.

## The most useful contributions

1. **Knowledge base corrections.** A service was renamed, retired or reached general availability; a control is missing; a metric target is unrealistic. Open a "Knowledge base update" issue with a link to the primary source (vendor documentation, release notes, specification). Search snippets and third-party blogs are not sources.
2. **Examples.** Real, anonymised answers files for common scenarios in `examples/`.
3. **Features** from the [roadmap](ROADMAP.md). Comment on the issue before starting so work is not duplicated.

## Rules for the knowledge base

- Every service entry keeps `"verify": true` unless you have opened the provider's documentation for the current release. Say which page in your pull request.
- Every control needs at least one framework reference.
- Preview features are labelled as preview in the service name.
- Never add an unannounced product.
- Plain language, short sentences, no marketing adjectives.

## Development

```bash
git clone https://github.com/azcloudops/ai-solution-blueprint
cd ai-solution-blueprint
npm run check        # knowledge base check, tests, build
open dist/index.html # or xdg-open on Linux
```

No dependencies to install. Node.js 20 or later.

## Pull requests

- One topic per pull request.
- `npm run check` must pass.
- Add a line under "Unreleased" in `CHANGELOG.md`.
- By contributing you agree your work is licensed under the MIT License.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).
