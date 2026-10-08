# BK-1 — Admin login

| Item       | Value                                  |
| ---------- | -------------------------------------- |
| Jira key   | BK-1                                   |
| Title      | Admin login                            |
| Platform   | Web (admin panel) only                 |
| Build date | _to fill in_                           |
| Status     | Done                                   |

## 1. Acceptance criteria (as implemented)

1. A signed-out user who opens any admin page is sent to `/auth/login?callbackUrl=<the page they asked for>`.
2. The admin signs in with an email address and password.
3. The email is trimmed and lower-cased before it is checked and sent, so ` Admin@Bergen.com ` signs in as
   `admin@bergen.com`.
4. Both fields are required. The email must be a valid address. Errors show under the field, and no request is sent.
5. Wrong credentials show an error toast, and the admin stays on the login page.
6. A successful login shows a "Welcome back" toast. The admin then goes to `callbackUrl` if there is one, or to the
   dashboard (`/`) if not.
7. **Keep me signed in**
   - Ticked: the session lasts 30 days. The email and password are filled in again the next time the login page
     opens, including after logout.
   - Unticked: the session lasts 1 day. Any saved email and password are removed.
8. A signed-in admin who opens any `/auth/*` page is sent to the dashboard.
9. When the session ends (the 1-day or 30-day limit, or a failed token refresh), the next page load goes back to login.
10. Logout ends the session on the API and goes to `/auth/login`.

## 2. Where the screen is

| Item             | Value                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| URL              | `/auth/login` (browser tab title: "Sign in")                                         |
| Who can open it  | Signed-out users only. A signed-in admin is redirected to `/`                         |
| Roles            | One role: admin. The panel has no other roles                                      |
| Entry points     | Any protected URL while signed out; Logout; "← Back to sign in" on the recovery screens |

## 3. Fields

| Field             | Selector    | Type             | Required | Rules                                                            | Default                    |
| ----------------- | ----------- | ---------------- | -------- | ---------------------------------------------------------------- | -------------------------- |
| Email address     | `#lg-email` | email            | Yes      | Valid email format. Spaces around it are trimmed and it is lower-cased before checking | Empty (or the saved email, see AC 7) |
| Password          | `#lg-pass`  | password / text  | Yes      | Not empty. There are no length or format rules on login          | Empty (or the saved password) |
| Keep me signed in | checkbox    | checkbox         | No       | none                                                             | Unticked (ticked if a login is saved) |

Placeholders: "Enter your email", "Enter your password".

## 4. Buttons and links

| Control                  | When enabled                    | Success                                              | Failure                          |
| ------------------------ | ------------------------------- | ---------------------------------------------------- | -------------------------------- |
| **Sign in to dashboard** | Always, except while a request is in progress. While waiting it is disabled and reads **"Signing in…"** | Success toast, then go to `callbackUrl` or `/` | Error toast; the button is enabled again |
| **Forgot?** (link, next to the Password label) | Always             | Opens `/auth/forgot-password` (see BK-2)              | none                             |
| Eye icon in Password     | Always                          | Shows or hides the password. aria-label is "Show password" or "Hide password" | none |
| Theme toggle (top right) | Always                          | Switches between light and dark theme                 | none                             |

The form also submits when you press Enter in either field.

## 5. Messages (exact text)

| Where                | When                                              | Text                                                      |
| -------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| Under Email          | Empty                                             | Enter your email address                                  |
| Under Email          | Not a valid email                                 | Enter a valid email address                               |
| Under Password       | Empty                                             | Enter your password                                       |
| Error toast          | Wrong email or password                           | Invalid email address or password. Please try again.      |
| Error toast          | The authentication callback failed                | Authentication failed. Please try again.                  |
| Error toast          | Any other auth error (for example a broken session cookie) | Something went wrong. Please try again.          |
| Success toast        | Login OK                                          | **Welcome back**, with the line: Signing you in…          |

Toasts close on their own after about 2.6 seconds.

Static text on the page:
- Heading: "Sign in to the admin panel"
- Subheading: "Use your Bergen Kids admin credentials to login."

## 6. Business rules

- **Session length**
  - Keep me signed in ticked: 30 days.
  - Unticked: 1 day.
  - Both limits are counted from the moment of login. Activity does not extend them.
- **Remembered login**
  - When a login succeeds with the box ticked, the browser saves the email and the password in plain text in
    localStorage, under the key `bk-admin-remembered-login`. The product asked for this.
  - When a login succeeds with the box unticked, that key is deleted.
  - Logout does **not** delete the key.
  - To reset this state, clear the site data.
- **Token refresh:** when the API access token expires, the app gets a new one in the background. If that fails, the
  admin is sent to login on the next navigation.
- **Old or broken session cookie:** it is cleared without the admin doing anything. After it is cleared, the next
  login attempt works.

## 7. APIs

The browser does not call these directly. They run on the Next.js server, so they **do not show in the browser's
Network tab**.

| Method | Endpoint           | Body                       | Used for                     |
| ------ | ------------------ | -------------------------- | ---------------------------- |
| POST   | `admin/auth/login` | `{ "email", "password" }`  | Sign in; returns the tokens and the user |
| POST   | `auth/token`       | `{ "refresh_token" }`      | Background token refresh     |
| POST   | `auth/logout`      | `{}` (bearer token)        | Logout                       |

## 8. Changes since the last build

- **6df3858 (22 Sep):** the app now reads the session again right after login. Before this, live updates and the
  session keep-alive could keep using the old (signed-out or expired) session until the window lost and regained focus.
- **e0ce9d8 (1 Oct):** internal changes only. Nothing changes for the user on this screen.

## 9. Test ids

The app has no `data-testid` attributes yet. These selectors are stable:

| Element                  | Selector                                                    |
| ------------------------ | ----------------------------------------------------------- |
| Email                    | `#lg-email`                                                 |
| Password                 | `#lg-pass`                                                  |
| Show / hide password     | `getByRole('button', { name: 'Show password' })` (or `'Hide password'`) |
| Keep me signed in        | `getByLabel('Keep me signed in')`                           |
| Submit                   | `getByRole('button', { name: 'Sign in to dashboard' })`     |
| Forgot link              | `getByRole('link', { name: 'Forgot?' })`                    |
| Field errors             | `role="alert"` under each field                             |

## 10. Credentials

QA needs **one admin account**. The credentials are shared through the password manager and are not written in this
file.
