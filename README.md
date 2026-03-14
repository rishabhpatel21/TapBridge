# TapBridge

TapBridge lets you launch desktop apps and websites from a React Native mobile app over your local network.

**Project Goal**
Provide a fast, secure, and simple “remote launcher” that keeps control and data on your own devices.

**Primary Use**
Trigger desktop apps or websites from your phone while both devices are on the same network.

**How It Works**
1. The PC runs a WebSocket server that exposes a controlled set of launchers.
2. The mobile app connects over the LAN, authenticates with a pairing token, and sends commands.
3. The PC validates each request and launches the app or URL.

## Structure
- `mobile/` Expo React Native app
- `pc-client/` Node.js WebSocket service

## Requirements
- Node.js + npm for `pc-client/`
- Expo toolchain for `mobile/`
- PC and mobile on the same LAN
- Firewall rule allowing inbound connections on the chosen port

## Quick Start (Development)
PC server:
```bash
cd pc-client
npm install
npm run dev
```

Mobile app:
```bash
cd mobile
npm install
npm run start
```

## Configuration
PC server config: `pc-client/config.json`

Example:
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
    },
    {
      "id": "youtube",
      "name": "YouTube",
      "kind": "website",
      "target": "https://youtube.com"
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

**Config fields**
- `port`: WebSocket port.
- `authToken`: Required token for pairing and every request. Use a strong value.
- `allowUnregistered`: If `false`, only launchers in `launchers` are allowed.
- `launchers`: Explicit app/website entries that can be launched.
- `tls`: Optional TLS config for `wss://`.
- `security`: Optional rate limits and size caps.

**Environment variables**
- `TAPBRIDGE_CONFIG`: Path to the config file.
- `TAPBRIDGE_AUTH_TOKEN`: Overrides `authToken` from config.

## Pairing
1. Start the PC server.
2. Scan the terminal QR in the mobile app.
3. If pairing manually, enter IP, port, token, and toggle “Secure TLS (wss)” when applicable.

## Security Measures
- **Per‑message auth**: Each client message includes the pairing token.
- **Strict validation**: Payloads are validated before execution.
- **Rate limiting**: Excessive requests are blocked.
- **Message size caps**: Large payloads are rejected.
- **Allow‑list support**: Disable `allowUnregistered` for strict control.
- **Optional TLS**: Use `wss://` to encrypt traffic over the network.

## Privacy
- No cloud backend.
- Pairing happens over the local network.
- The PC server logs the connecting IP address and launch events.

## API Protocol (WebSocket)
All client messages include an `auth.token` field.

Client message shape:
```json
{
  "type": "list_apps",
  "payload": { "includeIcons": true },
  "auth": { "token": "YOUR_TOKEN" }
}
```

Supported client message types:
- `ping`
- `list_apps`
- `launch`

Server message types:
- `pong`
- `status`
- `error`
- `apps`
- `apps_changed`
- `app_icons`
- `app_icons_done`

## Deployment Guidance
**PC server**
1. Set a strong `authToken`.
2. Set `allowUnregistered: false` for a strict allow‑list.
3. Enable TLS if the network is untrusted.
4. Open the selected port only to your local network.
5. Run the server as a background service on your OS.

**Mobile app**
1. Build a release using your preferred Expo workflow.
2. Distribute through your internal process or app store pipeline.

## Troubleshooting
- **Unauthorized**: Token missing or incorrect. Re‑scan the QR or paste the token.
- **Unable to reach server**: Check PC IP, port, firewall, and same‑network access.
- **Rate limit exceeded**: Slow down requests or adjust `security` values.
- **Icons not loading**: Retry with `includeIcons` and ensure the server is reachable.

## Notes
- Launching apps is OS‑specific and depends on installed software paths.
- If TLS is enabled, the mobile device must trust the certificate chain.

## License
See `LICENSE`.
