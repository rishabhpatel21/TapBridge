# TapBridge

Launch desktop apps and websites from your phone over your local network. TapBridge is designed to be fast, secure, and fully local — no cloud required.

## What You Ship for Production
TapBridge is a **two‑app product**:
1. **Desktop App (Electron)** — runs the PC server and shows a pairing QR.
2. **Mobile App (Expo)** — pairs via QR and sends launch commands.

Users install the desktop app on their computer and the mobile app on their phone. Pairing is done **only by scanning the QR**.

## How It Works
1. The desktop app starts the local WebSocket server.
2. The server generates a pairing token.
3. The desktop app shows a QR that includes IP, port, and token.
4. The mobile app scans the QR and connects.

## Repository Structure
- `pc-desktop/` Electron desktop app (production PC client)
- `pc-client/` Node.js server (bundled inside the desktop app)
- `mobile/` Expo React Native app

## Requirements (Dev)
- Node.js + npm
- Expo toolchain (mobile)

## Development Setup
Desktop app:
```bash
cd pc-desktop
npm install
npm run dev
```

Mobile app:
```bash
cd mobile
npm install
npm run start
```

## Production Builds
Desktop installers (Windows/macOS/Linux):
```bash
cd pc-desktop
npm install
npm run dist
```

Installers are created in `pc-desktop/dist`.

Mobile releases:
```bash
cd mobile
npm install
npx expo login
npx eas build:configure
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```

## Pairing (QR‑Only)
1. Install and open the desktop app.
2. Scan the QR code using the mobile app.
3. Connection is automatic — no manual IP/port/token required.

## Configuration (Desktop Server)
The desktop app bundles `pc-client/config.json`. You can still customize it before packaging:

```json
{
  "port": 5050,
  "authToken": "CHANGE_ME",
  "allowUnregistered": false,
  "launchers": [
    {
      "id": "brave",
      "name": "Brave Web Browser",
      "kind": "app",
      "target": "/usr/bin/brave-browser"
    }
  ],
  "tls": {
    "keyPath": "certs/server.key",
    "certPath": "certs/server.crt",
    "caPath": "certs/ca.crt"
  },
  "security": {
    "maxMessageBytes": 65536,
    "rateLimitWindowMs": 10000,
    "rateLimitMaxMessages": 80,
    "maxInvalidMessages": 5
  }
}
```

### Key Options
- `authToken`: Required for every request. The QR embeds it for pairing.
- `allowUnregistered`: Set `false` to enforce a strict allow‑list.
- `launchers`: Explicit apps/websites that can be launched.
- `tls`: Optional `wss://` support for encrypted LAN traffic.
- `security`: Rate limits and payload caps.

### Environment Variables
- `TAPBRIDGE_AUTH_TOKEN`: Overrides `authToken`
- `TAPBRIDGE_CONFIG`: Custom config path

## Security Highlights
- Per‑message authentication token
- Strict payload validation
- Rate limiting + message size caps
- Optional TLS (`wss://`)
- No cloud dependency

## Troubleshooting
- **QR not showing**: Ensure the PC server is running and the desktop app can start it.
- **Unauthorized**: Token mismatch — re‑scan the QR.
- **No connection**: Check same Wi‑Fi and firewall rules.

## Notes
- `pc-client/` is not distributed to users directly. It is bundled inside the desktop app.
- If you choose to ship a standalone server later, you can use the service files in `pc-client/`.

## License
See `LICENSE`.
