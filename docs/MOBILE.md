# Mobile apps: Google Play and App Store

AI Solution Blueprint ships to four channels from one codebase:

| Channel | What users get | How it is built |
|---|---|---|
| Web (GitHub Pages and azcloudops.org) | Installable web app (PWA) that works offline | `.github/workflows/pages.yml` |
| Google Play | Native Android app | `.github/workflows/mobile-android.yml` |
| App Store | Native iPhone and iPad app | `.github/workflows/mobile-ios.yml` (runs on a GitHub-hosted Mac; no Mac needed) |
| Command line | `aiblueprint` CLI | `npx github:azcloudops/ai-solution-blueprint` |

The store apps use [Capacitor](https://capacitorjs.com/) 8. The same web app runs inside a native shell with native features on top: a share sheet for Markdown, JSON and SVG exports; saved blueprints on the device; the Android back button; offline use with no network calls; native icons and splash screens.

App ID on both stores: `org.azcloudops.blueprint`. The app version always equals the root `package.json` version.

## One-time setup

### 1. Developer accounts

| | Google Play Console | Apple Developer Program |
|---|---|---|
| Cost | US$25 once | US$99 per year |
| Account type for azCloudOps today | Personal (no registered company yet) | Individual (no registered company yet) |
| Name shown on the store | A developer name you choose, for example "azCloudOps" | Your legal name as the seller |
| Extra step for new personal accounts | Closed test with at least 12 testers for 14 continuous days before production | None |
| Switch to company later | Requires a D-U-N-S number | Request a conversion with a D-U-N-S number |

Verify fees and rules at sign-up; they change.

### 2. Android upload key (do this once, keep it safe)

On any machine with Java installed:

```bash
keytool -genkeypair -v -keystore azcloudops-upload.jks -alias upload \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 azcloudops-upload.jks > azcloudops-upload.jks.b64   # macOS: base64 -i azcloudops-upload.jks
```

Store the `.jks` file and both passwords in a password manager. Enroll in Play App Signing when you create the app (it is the default), so Google holds the app signing key and this file is only your upload key.

### 3. GitHub repository secrets

Settings, Secrets and variables, Actions, New repository secret:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Contents of `azcloudops-upload.jks.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | Key password |
| `PLAY_SERVICE_ACCOUNT_JSON` | Optional. Service account JSON with release permissions in Play Console, for automatic upload. Without it, download the .aab from the workflow run and upload it by hand. |
| `APPLE_TEAM_ID` | Ten-character Team ID from developer.apple.com, Membership |
| `APP_STORE_CONNECT_KEY_ID` | Key ID of an App Store Connect API key (Users and Access, Integrations, Team Keys) with the App Manager or Admin role |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID shown on the same page |
| `APP_STORE_CONNECT_KEY_P8` | Full contents of the downloaded `AuthKey_XXXX.p8` file |

Until the secrets exist, the store workflows skip with a warning instead of failing.

### 4. Create the store records

- Play Console: Create app, name "AI Solution Blueprint", app, free. Complete App content (privacy policy, data safety, content rating, target audience, ads: none) using `docs/store/STORE_LISTING.md`.
- App Store Connect: Apps, New App, iOS, name "AI Solution Blueprint", bundle ID `org.azcloudops.blueprint` (register it under Identifiers first), SKU `aiblueprint`. Complete App Privacy ("Data Not Collected"), age rating and the listing from `docs/store/STORE_LISTING.md`.
- Upload the screenshots and feature graphic in `docs/store/`.

## Release flow (every month)

1. Follow `docs/RELEASING.md` and tag `vX.Y.0`.
2. The tag triggers the Pages deploy, the GitHub Release, the Android bundle and the iOS archive.
3. Android: the bundle lands on the internal track (or download it from the workflow run). Promote it to closed testing, then production, in Play Console.
4. iOS: the build appears in TestFlight after processing. Add it to a new App Store version, update "What's New" from the CHANGELOG, and submit for review.
5. To re-upload the same version (for example after a rejected build), run the Android workflow manually with a higher `build_seq`. iOS build numbers use the workflow run number, so they always increase.

## First launch timeline (personal Google Play account)

| Day | Step |
|---|---|
| 0 | Accounts approved, secrets added, tag pushed, internal test works |
| 1 | Closed test opened with at least 12 testers (colleagues, community members, conference contacts) |
| 15 | Apply for production access in Play Console |
| About 17 to 22 | Production review, then live on Google Play |

App Store review usually takes one to a few days. Submit iOS in parallel with the Android closed test.

## App Store review notes

Apple rejects apps that are only a repackaged website (guideline 4.2, Minimum Functionality). This app is a bundled, offline tool rather than a website in a frame, and it adds native features. Paste this into App Review Information, Notes:

> AI Solution Blueprint is an offline design tool for enterprise IT teams. All logic and content are bundled in the app; it makes no network requests and collects no data. Native features: the iOS share sheet exports blueprints as Markdown, JSON and SVG files; multiple blueprints are saved on the device; works fully offline. To try it quickly, tap "Load an example" and choose "IT help desk answers", then open step 8, Blueprint, and tap "Download Markdown" to see the share sheet.

No approval is guaranteed. If Apple still cites 4.2, the planned additions that strengthen the native case are: a Files app document type for `.aiblueprint.json` (open blueprints from Files, Mail and Teams), PDF export through the native print renderer, and home screen quick actions.

## Local development (optional)

```bash
cd mobile
npm ci
npm run sync            # builds mobile/www and copies it into both native projects
npm run open:android    # Android Studio
npm run open:ios        # Xcode (macOS only)
npm run assets          # regenerate icons and splash screens from ../assets
```

## Verify before first submission

- Test the share sheet on a real Android phone and a real iPhone and iPad (the CI build cannot do this).
- Confirm that the build uses the latest Xcode and iOS SDK that App Store Connect requires at submission time.
- Confirm Google Play's target API level requirement still matches `targetSdkVersion` in `mobile/android/variables.gradle` (36 as of November 2026).
- Confirm the app name is available on both stores.
