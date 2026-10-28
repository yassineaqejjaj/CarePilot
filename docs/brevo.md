# Brevo transport

Brevo is the requested external communications service. The application and HTTP adapter use open-source components; Brevo itself is an external commercial service chosen by the project owner.

The public demo remains `MESSAGING_PROVIDER=console`: no real email, SMS or WhatsApp is sent. The adapter is executable and tested with mocked HTTP calls, but real sender/account authorization cannot be verified without the owner's Brevo configuration.

## Server-only configuration

```dotenv
MESSAGING_PROVIDER=brevo
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=M3aya Santé
BREVO_SMS_SENDER=M3aya
BREVO_WHATSAPP_SENDER=
BREVO_WHATSAPP_TEMPLATE_FR=0
BREVO_WHATSAPP_TEMPLATE_AR=0
MESSAGING_WEBHOOK_SECRET=
```

Never use a `VITE_` variable for these values. Configure a verified email sender/domain, the permitted SMS sender for the destination country and sufficient account credits. Activate WhatsApp Business and approved templates in Brevo before enabling that channel. Keep all initial tests on fictional data and authorized test recipients.

- Email: `POST /v3/smtp/email`, plain-text transactional messages.
- SMS: `POST /v3/transactionalSMS/send`, international number without `+`, transactional mode, Unicode enabled.
- WhatsApp: `POST /v3/whatsapp/sendMessage`, using a configured approved template per language. Because template parameters have not been validated against the owner's account, messages containing invitation URLs fail closed for this channel; use email/SMS or manually transfer the secure invitation. Arbitrary free text is not sent outside an unverified 24-hour conversation window. The UI records that a configured template was used, not that an arbitrary draft body was delivered.

## Delivery webhook

Configure Brevo transactional email/SMS events to call:

`POST https://<api-host>/api/operations/webhooks/brevo`

Set authentication to **Bearer** with the same random value as `MESSAGING_WEBHOOK_SECRET`. The endpoint fails closed when the secret is missing. Keep secrets out of the URL/query string. Configure one event per request (batching disabled).

The adapter maps `message-id` / `messageId` to the stored provider reference. Delivered, sent/request and failure events update the message and dispatch. Late sent/failure events cannot roll back a delivered message; a late sent event cannot erase a recorded failure. Replayed states are harmless. Opens and clicks never fabricate delivery. Unknown provider references and unsupported events do not change a dossier. No webhook payload containing recipient/body data is logged or retained.

WhatsApp callback/statistics mapping is not claimed as validated: provider acceptance remains distinct from delivery. Patient replies are fully supported inside the secure portal; external inbound email/SMS threading requires a provider-specific, authenticated mapping and is not silently inferred from phone numbers.

## Approval and resilience

A coordinator must confirm each outbound template. The preparation center reserves an idempotency key before the network call; a duplicate request cannot resend the message. An ambiguous crash/network error is not retried automatically: verify the provider, then record manual follow-up. Non-console reminders/info messages require patient consent, use the establishment's configured hours (08:00–20:00 Africa/Casablanca by default), and enforce one transmitted reminder per journey per 24 h. Initial invitations are a separate explicit staff action.

An explicit email/SMS/WhatsApp selection never silently falls back to another channel if its destination is absent. Addresses remain masked in the transmission log; administrative conversation bodies are encrypted.

Brevo delivery semantics and operating fees remain subject to its account configuration. No real financial transaction or medical decision is performed by this transport.

Sources: [email](https://developers.brevo.com/docs/send-a-transactional-email), [SMS](https://developers.brevo.com/docs/transactional-sms-endpoints), [WhatsApp](https://developers.brevo.com/docs/whatsapp-messages), [webhook authentication](https://developers.brevo.com/docs/secured-webhooks), [delivery events](https://developers.brevo.com/docs/transactional-webhooks).
