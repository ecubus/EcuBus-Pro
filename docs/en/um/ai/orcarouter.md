# OrcaRouter Provider

EcuBus-Pro can use [OrcaRouter](https://www.orcarouter.ai) as an AI provider.
OrcaRouter is an OpenAI-compatible AI gateway for models and agents. There are
two ways to connect, and they are independent — use whichever suits the machine
you are on.

| Method | Label in **Home → AI** | Credential |
| --- | --- | --- |
| Existing key | **OrcaRouter - API** | You paste an `sk-orca-…` key. |
| Account login | **OrcaRouter - Auth** | A browser sign-in issues an `sk-orca-…` key. |

Both produce the same kind of key and both route inference through
`https://api.orcarouter.ai/v1`. Neither one replaces the other: the API-key path
works on a machine with no browser sign-in, and the account path works when you
do not have a key to hand.

## Connect with an API key

1. Create a key at <https://www.orcarouter.ai/console/authorized-apps>.
2. Open **Home → AI → OrcaRouter - API**.
3. Paste the key and choose **Save key**.

The key is stored with the same protected storage the application already uses
for other credentials (Electron `safeStorage`, backed by the OS keychain where
one is available). Once saved it is never shown again — the panel only displays
a masked placeholder. Use **Clear** to remove it.

The console link in the panel is also where you revoke a key.

## Connect with your OrcaRouter account

1. Open **Home → AI → OrcaRouter - Auth**.
2. Choose **Connect with OrcaRouter**. Your browser opens the OrcaRouter consent
   screen.
3. Approve. The browser returns to a loopback address on this machine and the
   key is stored automatically — there is nothing to copy.

This uses OAuth 2.0 with PKCE (`S256`) and a loopback redirect. No client secret
is involved and there is no redirect URI to register: the app binds an ephemeral
port on `127.0.0.1` and OrcaRouter returns the authorization code there. The
authorization code is valid for ten minutes and can be used once.

The consent screen also offers *"Show me a code"*. The app always sends the
`S256` challenge method so that a code shown on screen is still only redeemable
by the process that started the sign-in.

If the browser does not open, the panel displays the authorization URL so you
can open it yourself.

### What is stored, and for how long

The result of a sign-in is a normal, long-lived OrcaRouter API key that belongs
to your account. It is billed to you, listed in your console, and revocable by
you at any time.

OrcaRouter does **not** issue a refresh token, and there is no refresh endpoint.
The app therefore reuses the stored key until OrcaRouter revokes it. It does not
re-authenticate on every launch — OrcaRouter limits PKCE-issued keys to ten per
user per 24 hours, and a client that re-authorizes on every start would lock
itself out.

When a request is rejected as unauthorized, the app marks that exact credential
as needing re-authentication and prompts you to sign in again. It does not
delete the stored key on the first failure, and it does not retry the request in
a loop.

Refreshable OAuth tokens rotate automatically; durable key grants such as
OrcaRouter are reused until the provider revokes them.

## Selecting a model

The model selector lists what your account can actually call. The list is
fetched live from `GET https://api.orcarouter.ai/v1/models` using your stored
key, so it reflects your workspace rather than a hard-coded catalogue. Use
**Refresh** to re-fetch it.

Model ids keep their vendor namespace (`anthropic/claude-opus-4.8`,
`openai/gpt-5.5`, …). Nothing needs to be typed by hand.

The list is filtered to what the current request can use:

- **Text** requests offer models that can serve a chat turn.
- Turn on **Attach an image** and the list narrows to chat models that
  explicitly declare image input. A model that does not declare image support is
  never offered for an image request, and a model you had selected that no
  longer qualifies is cleared so you can pick again.

If the catalogue cannot be reached, the selector falls back to a small,
verified list and the panel shows a **Degraded** badge with the reason. It never
falls back to a free-text field, and live results are never mixed with the
fallback list.

## Configuration

| Setting | Environment variable | Default |
| --- | --- | --- |
| Authentication | `ORCA_AUTH_BASE_URL` | `https://www.orcarouter.ai` |
| Inference and models | `ORCA_API_BASE_URL` | `https://api.orcarouter.ai` |
| Both at once | `ORCA_BASE_URL` | *(unset)* |

Explicit per-purpose values win; `ORCA_BASE_URL` is the shared fallback used for
whichever one is not set, which is what a single-origin self-hosted deployment
needs. Remote origins must use HTTPS; plain HTTP is accepted only for loopback
development.

The two origins are never derived from one another. Authentication lives on the
auth origin at `/auth` and `/api/v1/auth/keys`; inference and model discovery
live on the API origin under `/v1` and are never used for authentication.

## Where the key lives

The key is held by the application's main process and is never sent to the
renderer, a browser context, a log line, an analytics event or an error message.
All inference and model-discovery requests are made from the main process.
