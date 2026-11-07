# BusinessPilot AI — Atomic AI (Stage 2 integrated build)

This build continues the supplied Stage 1 project and retains its Firebase project, Google sign-in, static frontend, Firestore data model, Vercel deployment model and Super Admin custom-claim bootstrap.

## Included in this build

### Public website and authentication
- Mobile-first SaaS landing page, feature sections, pricing cards and policy links.
- Firebase Google sign-in only.
- First-time business onboarding and owner membership creation.
- English / Telugu / Hindi language selector. The navigation labels are translated; not every paragraph and form has been localized yet.
- Public prices load from the server-managed platform configuration when the backend is configured. Defaults remain visible if the backend is unavailable.

### Business workspace
- Overview and record-based analytics.
- Customer, product and order CRUD routed through a trusted server endpoint.
- Server-side Free-plan quotas (default: 50 customers, 50 products, 100 orders); Super Admin can edit these limits.
- Server-side ownership checks for record updates and archives.
- Inventory view, CSV / JSON exports, automation definitions, support tickets and subscription view.
- Automation creation and AI generation require an active Premium subscription. Expired Premium accounts retain access to basic customer/product/order records; Premium-only features become read-only.
- WhatsApp and Instagram inboxes remain disconnected until official Meta app credentials, permissions and webhooks are configured.

### Super Admin
- Separate navigation based on a Firebase custom claim (`super_admin === true`).
- First-time bootstrap restricted to the configured UID and email; browser storage and frontend role values are not authorization sources.
- User suspend/reactivate and business suspend/reactivate operations through a server endpoint.
- Premium grant/revoke controls, payment review/history, coupon manager, pricing manager, audit logs, support ticket listing, AI provider setup guidance and monitoring status.
- Pricing, trial duration, Free-plan quotas and manual UPI payment instructions are stored in `application_settings/platform` and changed only through a verified Super Admin API call.

### Pricing, subscriptions and coupons
- Default prices: WhatsApp ₹199 monthly / ₹499 quarterly; Instagram ₹199 / ₹499; Combined ₹359 / ₹899.
- Yearly billing choices are present, but yearly amounts default to **not configured** because no yearly price was supplied. Super Admin must set a yearly price before a yearly payment request can be submitted.
- A configurable one-time Premium trial (default 7 days).
- Subscription expiry is checked server-side for AI and automation access.
- Coupon create/edit/pause/delete, percentage or fixed discounts, expiry, maximum redemptions, email restrictions and configured Premium benefit days.
- A 100% coupon can grant its configured Premium benefit without payment through the server-side redemption endpoint. Partial coupons are applied to payment requests on the server.
- Coupon eligibility, expiry, usage count, account restriction and redemption are checked server-side. Coupon documents are not writable by business owners.

### Manual UPI payments
- Super Admin can configure the verified UPI ID, payee name and instructions. No UPI ID or bank details are invented or prefilled.
- Payment requests are created by the trusted backend. The server calculates package price and coupon discount; client-submitted amount is not accepted.
- UTR/reference duplicate check, payment date, pending state and payment history.
- Approval requires a Super Admin token, an internal note and explicit confirmation that the account holder independently verified actual bank credit. A screenshot or UTR alone is not proof of receipt.
- No automatic payment collection or renewal is claimed.

### AI Studio
- OpenAI-compatible server endpoint (`/api/ai-generate`).
- Provider credentials remain server-side. Without `AI_API_KEY`, the endpoint returns a clear not-configured response.
- The endpoint checks active Premium status server-side and asks the model not to invent business facts.
- Generated content remains a draft and should be reviewed before sending.

## Backend endpoints added

- `POST /api/admin-bootstrap` — one-time Super Admin custom-claim bootstrap.
- `GET|POST /api/platform-config` — public read of safe platform pricing/payment display settings; Super Admin-only writes.
- `POST /api/payment-quote` — calculates the server-authoritative payable amount before the customer pays.
- `POST /api/payment-submit` — validates package, server price, unique UTR and coupon before creating a pending payment request.
- `POST /api/payment-review` — Super Admin-only approve/reject with bank-credit confirmation.
- `POST /api/coupon-redeem` — one-time full-free coupon redemption and Premium grant.
- `POST /api/trial-activate` — one-time configurable Premium trial.
- `POST /api/admin-manage` — Super Admin user/business status and subscription operations.
- `POST /api/business-record` — server-side record CRUD/archive with ownership and Free-plan quota checks.
- `POST /api/ai-generate` — optional Premium AI generation through an OpenAI-compatible provider.

## Deployment setup

Use the existing Firebase project `businesspilot-ai-3932a` and existing Vercel project. Do not create a replacement project.

1. Back up the current GitHub repository before uploading these files.
2. Upload the contents of this ZIP to the existing repository root and deploy through the already connected Vercel project.
3. In Firebase Authentication, enable Google provider and add the deployed Vercel domain to Authorized domains.
4. Publish the included `firestore.rules` to the existing Firestore database.
5. Deploy the included Firestore composite index (`business_members: uid + status`) from `firestore.indexes.json` if Firebase has not already built it.
6. Configure the Vercel environment variables below and redeploy.
7. Sign in with the configured Super Admin Google account once to perform first-time bootstrap. If the bootstrap marker already exists, do not delete it or try to bypass it; have the Firebase project owner inspect the custom claim and marker.

### Required Vercel environment variables

- `FIREBASE_PROJECT_ID=businesspilot-ai-3932a`
- `FIREBASE_SERVICE_ACCOUNT_JSON` = complete Firebase Admin service-account JSON stored as a Vercel secret
- `SUPER_ADMIN_UID` = configured Super Admin UID
- `SUPER_ADMIN_EMAIL` = configured Super Admin email

Never commit a service-account JSON, private key, AI key, Meta token or other secret to GitHub or browser code.

### Optional AI provider variables

- `AI_API_KEY` — provider secret
- `AI_BASE_URL` — optional OpenAI-compatible API base URL (defaults to `https://api.openai.com/v1`)
- `AI_MODEL` — optional model name (defaults to `gpt-4o-mini`)

### Manual UPI setup

After Super Admin bootstrap, open **Pricing Manager** and enter the account holder's verified UPI ID, payee name and payment instructions. The account holder should confirm the displayed details before accepting payments. Do not approve a request until actual bank credit is independently verified by the account holder.

### Example 100% coupon

In **Coupon Manager**, create code `Akhilnetha`, set type to Percentage, value to `100`, choose the expiry and redemption limit, set the Premium benefit duration, and enable it. The example code is not automatically activated by this build; Super Admin must explicitly create and enable it.

## Important configuration / integration boundaries

These integrations cannot be activated merely by writing frontend code. They need account-owner credentials, provider approval, webhooks and deployment configuration:

- WhatsApp Cloud API and Instagram Messaging: not connected; no messages are sent.
- Email delivery: Email Studio currently prepares drafts only; no mail provider is configured.
- Payment gateway / automatic renewal: not configured; manual UPI workflow only.
- Automated scheduled backups and retention: not configured; manual exports are available.
- Team invitations and role-based member management: team page is currently view-only.
- Full Telugu/Hindi translation: language selector currently translates navigation labels; remaining content localization is still required.
- Advanced support replies, complete monitoring probes, and advanced reporting are not yet integrated.

## Validation performed for this ZIP

- JavaScript syntax check for every Vercel API endpoint.
- JavaScript module syntax check for `assets/app.js`.
- JSON parse check for `package.json` and Firebase configuration files.
- Static review of Firestore rules and backend authorization paths.

A live Firebase/Vercel deployment test, Google sign-in test, Firestore Rules Emulator test, actual bank-credit verification and provider integration test require access to the project owner's Firebase/Vercel accounts and real provider credentials. They have not been represented as completed here.

## Live WhatsApp + Instagram Messaging (Meta Cloud APIs)

This build includes official Meta API connection, encrypted token storage, outbound text replies, webhook verification/signature validation, inbound message persistence, conversation inboxes and server-side monitoring. It does **not** bypass Meta approval or create Meta credentials for you.

### Vercel secrets required

Add these in Vercel → Project → Settings → Environment Variables, for Production and Preview as appropriate, then redeploy:

- `META_APP_ID` — Meta Developer App ID (monitoring/config visibility).
- `META_APP_SECRET` — Meta Developer App Secret; used to validate `X-Hub-Signature-256` on webhook POSTs.
- `META_VERIFY_TOKEN` — your own long random string; use the exact same string in Meta webhook verification.
- `META_GRAPH_VERSION` — defaults to `v22.0`; update to a Graph API version supported by your Meta app before its deprecation date.
- `INTEGRATION_ENCRYPTION_KEY` — exactly 64 hex characters (32 random bytes). Generate locally with `openssl rand -hex 32`. This encrypts channel access tokens at rest. Keep a secure backup; changing it makes already stored tokens unreadable until reconnected.

Never add Meta access tokens or these secrets to GitHub, frontend JavaScript, chat, or screenshots. Do not send them to anyone.

### Meta app setup

1. Create/use a Meta Developer app owned by the business/account holder. Add the WhatsApp and Instagram products/use cases and complete any business verification or app review required for the intended users.
2. Deploy this project first. The webhook callback is `https://YOUR-VERCEL-DOMAIN/api/meta-webhook`.
3. In Meta Developer Dashboard, configure the callback URL and `META_VERIFY_TOKEN`; subscribe the WhatsApp webhook to `messages`, and subscribe Instagram messaging events (at minimum `messages`, plus any other events you intend to handle). Use the app secret corresponding to this app in Vercel.
4. For WhatsApp, configure a real WhatsApp Business Account and registered Cloud API phone number. Grant the required WhatsApp messaging permissions and subscribe the app to the WABA. A temporary test number/token may expire; production requires a suitable long-lived system-user token and approved recipient/business setup.
5. For Instagram, use an eligible Instagram professional account linked to a Facebook Page. Enable the messaging product and grant the app the relevant Instagram messaging and Page permissions, including `instagram_manage_messages`; complete App Review/advanced access when required.
6. Sign into BusinessPilot AI, open **Connected Accounts**, and enter the official token and account IDs. The server validates the token against Meta before saving it encrypted. WhatsApp requires Phone Number ID. Instagram requires Instagram professional account ID and linked Page ID.
7. Send a test DM/message from a separate customer account, confirm it appears in the relevant inbox, and reply. Meta messaging windows, recipient eligibility, templates and policy restrictions still apply; WhatsApp free-form replies are generally limited to the customer-service window.

### Monitoring

Super Admin and business owners now have a Monitoring page. It probes Firebase Admin Auth and Firestore, reports Meta webhook secret readiness and AI provider readiness, shows per-business WhatsApp/Instagram connection state, and displays recent system events. The dashboard refreshes every 30 seconds while open. It is an application-level monitor, not an uptime guarantee or external alerting service.

### Data and rules deployment

Publish the updated `firestore.rules` and `firestore.indexes.json` to the existing Firebase project. Integration credentials, account registry mappings and health probe documents are server-only. Conversations/messages are written by the verified Meta webhook using Firebase Admin and are read by authorized workspace members.

### Important current scope

- Supported send action: text replies to an existing WhatsApp/Instagram conversation. Media sending, template creation/management, broadcasts, comments, story replies, assignment workflows and automated AI replies are not included in this build.
- Webhook message types that are not text are retained as an attachment placeholder; media download/preview is not implemented.
- Meta webhook retries and provider outages are logged. Verify end-to-end delivery after deploying and subscribing the app; no provider can be marked live merely because credentials were saved.
- Monitoring records app-level health and recent events. It does not yet send SMS/email/WhatsApp alerts or retain long-term metrics.
