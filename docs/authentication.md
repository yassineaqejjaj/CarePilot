# M3aya Santé authentication theme

The `m3aya` login theme uses the product palette (navy, teal, soft white and a coral accent), supplied logo/favicon, locally bundled Manrope and IBM Plex Sans Arabic, and a responsive layout. French and Arabic are available, with RTL layout in Arabic. The public website passes its selected language to Keycloak using the standard `ui_locales` mechanism.

The desktop screen combines a concise journey illustration and a focused login form. Mobile keeps the form first. The illustration contains no patient data. Native labels, password-manager autocomplete, paste, password visibility, validation errors and the OIDC authorization-code/PKCE flow are retained. Primary fields and the submit button are at least 48 px high; keyboard focus and reduced-motion preferences are supported. These are contemporary design and accessibility choices, not a claimed “2027 standard” or a WCAG certification.

## Implementation

- Theme source: `infrastructure/keycloak/themes/m3aya/login/`.
- Parent: Keycloak `keycloak`, pinned to the existing Keycloak 25 deployment.
- `template.ftl` adapts the official 25.0.6 base layout; native login, password-recovery and other flow templates and security scripts are inherited.
- Message bundles: French and Arabic; no external font or analytics requests.
- Fonts retain their SIL OFL notices. The upstream layout is derived from Keycloak under Apache-2.0; see the [upstream license](https://github.com/keycloak/keycloak/blob/25.0.6/LICENSE.txt).
- Realm presentation settings: `loginTheme=m3aya`, internationalization enabled, supported locales `fr` and `ar`, default `fr`.

On a Keycloak version upgrade, compare the copied layout with the new upstream template and rerun all authentication tests. The visual theme does not upgrade the identity server or change its security policy.

## Local environment

Compose mounts the theme directory separately from the realm import. New realms use the theme from the realm configuration. Existing realms are not reimported: copy the theme into the running CarePilot Keycloak container and activate it through the admin console, or use:

```sh
export KEYCLOAK_ADMIN_PASSWORD='<local admin password>'
python scripts/keycloak-theme.py --url http://localhost:8081 \
  --backup .deploy/keycloak-theme-local-backup.json
```

The activation script updates only four presentation/locale fields, backs up their previous values, and verifies that user and client identities remain unchanged. It does not change credentials or users. Keep backups private. To roll back, restore the previous login theme and locale settings in the realm admin console from that backup; keep the theme files available until the realm no longer references them.

## Deployment

The tracked Keycloak Dockerfile and deployment-realm generator include the theme for future builds. Do not rerun the realm generator on an existing deployment merely to change the design: it generates new demonstration passwords.

The current Railway demo uses embedded H2. The theme was installed into the running service and activated through the Admin API, without a service restart or realm import, preserving existing accounts. To package only the theme for a minimal runtime that has `sh` and `base64`:

```sh
python scripts/package-keycloak-theme.py --output .deploy/theme-install.sh
# Feed that trusted file to /bin/sh -s through the service's SSH connection.
```

The installer writes only `/opt/keycloak/themes/m3aya/`. The running-container copy is ephemeral; subsequent image deployments must use the updated Dockerfile/deployment context, which includes `themes/`. A raw image redeploy without that context would lose the theme. Production identity data still needs a persistent database, backups and an upgrade plan; the design change does not address those existing demo limitations.

## Verification

```sh
cd apps/web
npx playwright test e2e/auth-design.spec.ts
```

Six scenarios check the native form and autocomplete, French/Arabic and password visibility, mobile/320 px layout, and generic invalid-login feedback using a nonexistent account, patient sign-in, and language handoff from the public website. Staff/patient sign-in regression checks use the existing demo accounts and private passwords. Screenshots are captured with empty fields and without tokens or credentials.

References: [Keycloak theme documentation](https://www.keycloak.org/ui-customization/themes), [W3C WCAG 2.2 guidance](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).
