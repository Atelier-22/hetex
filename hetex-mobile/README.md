# Hetex AI — Mobile (v1)

Built in Uganda. Designed for the world.

This is a real React Native + Expo app — not a website in a wrapper. It
talks to your existing Hetex AI backend (the Next.js project) over the
same API routes and database as the web app. Login, register, and chat
are wired to real endpoints and verified to type-check and bundle clean
with Metro. **I could not run this on a phone or simulator myself** — my
build environment has no iOS/Android tooling. You'll be the first to
actually see it running on a device.

## What's real right now

- Login, Register, Chat — full working screens, real network calls
- Bearer-token auth (JWT) issued by your backend, stored securely on-device
  via `expo-secure-store`
- Chat replies come from the same Claude integration and system prompt as
  the web app — same conversations show up if you open them on web too

## What's different from the web app (for now)

- **No streaming.** The phone gets the full reply in one piece, not
  word-by-word. Real SSE support for React Native is a follow-up (needs a
  polyfill or library — `react-native-sse` is the usual choice).
- **Payments, transactions, saved services, settings — not built yet.**
  This first version proves the architecture (phone → your backend →
  database → AI) with the core chat loop. Everything else in the web app
  can be added screen by screen the same way.

## Running this — read this part carefully

### 1. Start your backend first
In the `hetex-ai` folder (the Next.js project): `npm run dev`

### 2. Find your computer's LAN IP address
Your phone can't reach `localhost` — that means "the phone itself" on a
phone, not your computer. You need your computer's actual network address.

- **Windows:** open PowerShell, run `ipconfig`, look for "IPv4 Address"
  (something like `192.168.1.42`)
- **Mac:** System Settings → Wi-Fi → Details → look for your IP

### 3. Set that IP in the app
Open `src/api/client.ts` and change:
```ts
export const API_BASE_URL = "http://192.168.1.100:3000";
```
to your actual IP, keeping port `:3000`.

### 4. Your phone and computer need to be on the same Wi-Fi network
This won't work over mobile data or a different network.

### 5. Install Expo Go on your phone
Search "Expo Go" in the App Store or Play Store.

### 6. Run the app
```bash
cd hetex-mobile
npm install
npx expo start
```
A QR code appears in your terminal. Scan it with:
- **iPhone:** the Camera app
- **Android:** the Expo Go app's built-in scanner

Your phone will load the app. Register an account (same database as your
web app — an account made on web works here too) and try chatting.

## If it doesn't connect

- Double check the IP in `client.ts` matches what `ipconfig` showed
- Make sure `npm run dev` is actually running in the `hetex-ai` folder
- Some routers isolate devices from each other ("AP isolation") — if nothing
  works, try your phone's mobile hotspot instead, connect your computer to
  it, and use the IP your computer gets on that hotspot network

## Project structure

```
App.tsx                    # navigation + auth-gated routing
src/
  api/client.ts             # talks to your Next.js backend, token storage
  context/AuthContext.tsx   # login state across the app
  screens/
    LoginScreen.tsx
    RegisterScreen.tsx
    ChatScreen.tsx
```

## Next real milestones (screen by screen, same pattern as this one)

1. Real SSE streaming (react-native-sse)
2. Conversation history / recent chats list
3. Payment review cards (reuse the same backend tool-calling flow)
4. Transactions, Payment Methods, Saved Services screens
5. Push notifications (Expo Notifications)
6. Building an actual installable app (EAS Build) instead of Expo Go
