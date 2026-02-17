# Local development: connecting from hytopia.com/play

## The problem: CORS / Private Network Access

When you open **hytopia.com/play** and enter `https://local.hytopiahosting.com:8080`, the browser may block the connection with:

- **"Permission was denied for this request to access the `loopback` address space"** (CORS / Private Network Access)
- **"Could not connect to server local.hytopiahosting.com:8080"**
- **ERR_CERT_COMMON_NAME_INVALID** if you use `localhost:8080` (the SDK dev cert is for `local.hytopiahosting.com`, not `localhost`)

**Why:** The play client runs on a **public** origin (`https://compat-*.play.hytopia.com`). Your dev server is on a **local/private** address (127.0.0.1). Browsers (Chrome and others) block "public → private" requests unless the server explicitly allows them by responding to a preflight with `Access-Control-Allow-Private-Network: true`. The HYTOPIA SDK’s built-in web server does not send this header, so the connection is blocked.

## Recommended workaround: tunnel (no PNA)

Use a tunnel so the play client talks to a **public** URL that forwards to your local server. Then there is no "public → loopback" request and Private Network Access does not apply.

### 1. Install cloudflared

Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/) (Cloudflare’s free tunnel client) on the machine that runs your game server.

### 2. Run the server **without** SSL

The tunnel provides HTTPS; your server can listen on plain HTTP:

```bash
# Terminal 1: start game without SSL (tunnel will handle HTTPS)
NODE_ENV=production bun --watch index.ts
```

On Windows PowerShell:

```powershell
$env:NODE_ENV="production"; bun --watch index.ts
```

### 3. Start the tunnel

```bash
# Terminal 2: tunnel port 8080 (default game port)
cloudflared tunnel --url http://localhost:8080
```

Copy the printed URL (e.g. `https://something-random.trycloudflare.com`).

### 4. Connect from the play client

1. Go to **https://hytopia.com/play**
2. When asked for the server URL, paste your **tunnel URL** (e.g. `https://something-random.trycloudflare.com`)
3. Play; the client connects to the public tunnel URL, which forwards to your local server.

**Note:** The tunnel URL changes each time you start `cloudflared`. For a stable URL you’d need a named Cloudflare tunnel (optional, not required for local dev).

## Direct connection (when it works)

If you are not hitting PNA (e.g. older browser or different environment):

1. Add to `/etc/hosts`: `127.0.0.1 local.hytopiahosting.com`
2. Start the server: `bun --watch index.ts`
3. In the browser, trust the dev certificate at `https://local.hytopiahosting.com:8080` (Advanced → Continue).
4. In the play client, enter `https://local.hytopiahosting.com:8080`.

Use the **tunnel** approach if you see the "loopback address space" / PNA error.
