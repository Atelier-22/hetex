# Hetex AI — Mobile

Built in Uganda. Designed for the world.

A real React Native + Expo app — not a website in a wrapper. It talks to
[`hetex-api`](../hetex-api/README.md), the same backend and database the web app
uses, so an account made on the web works here and the conversations are the
same ones.

## What's real right now

- Login, Register, Chat — working screens, real network calls
- Bearer-token auth issued by the backend, stored on-device in
  `expo-secure-store` (Keychain / Keystore)
- Replies come from the same Claude integration and system prompt as the web app

## What's different from the web app

- **No streaming.** The phone receives the full reply in one piece rather than
  word by word. The backend supports both — it streams only when the caller
  sends `Accept: text/event-stream`, and SSE in React Native needs a polyfill
  (`react-native-sse` is the usual choice). That's the next milestone.
- **Chat only.** Conversation history, projects, settings, and library exist in
  the API but have no screens here yet. Each one is the same pattern as the
  chat screen.

## Pointing it at a backend

The app reads `EXPO_PUBLIC_API_URL`, falling back to `expo.extra.apiUrl` in
[app.json](app.json).

**Against the deployed API** — simplest, and no Wi-Fi requirements:

```bash
EXPO_PUBLIC_API_URL=https://hetex-api.onrender.com npx expo start
```

**Against a backend on your own machine** — your phone can't reach
`localhost`, because on a phone that means the phone itself. You need your
computer's LAN address:

- **Windows:** `ipconfig` → look for "IPv4 Address" (e.g. `192.168.1.42`)
- **Mac:** System Settings → Wi-Fi → Details

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.42:4000 npx expo start
```

Phone and computer must be on the same network. Some routers isolate devices
from each other ("AP isolation") — if nothing connects, try your phone's
hotspot, connect your computer to it, and use the address your computer gets
there.

## Running it

```bash
npm install
npx expo start
```

A QR code appears. Scan it with the Camera app (iPhone) or the Expo Go app's
scanner (Android). Install "Expo Go" from the App Store or Play Store first.

## Layout

```
App.tsx                    # navigation + auth-gated routing
src/
  api/client.ts             # talks to the Hetex API, token storage
  context/AuthContext.tsx   # login state across the app
  screens/
    LoginScreen.tsx  RegisterScreen.tsx  ChatScreen.tsx
```

## Next milestones

1. Real SSE streaming (`react-native-sse`)
2. Conversation history list
3. Settings and projects screens
4. Push notifications (Expo Notifications)
5. An installable build via EAS Build instead of Expo Go
