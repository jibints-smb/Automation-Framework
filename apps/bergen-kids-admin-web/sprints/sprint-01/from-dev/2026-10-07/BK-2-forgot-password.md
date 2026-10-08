# BK-2 — Forgot password (account recovery)

| Item       | Value                                  |
| ---------- | -------------------------------------- |
| Jira key   | BK-2                                   |
| Title      | Forgot password                        |
| Platform   | Web (admin panel) only                 |
| Build date | _to fill in_                           |
| Status     | Done                                   |

## 1. Acceptance criteria (as implemented)

1. From the login page, **Forgot?** opens `/auth/forgot-password`.
2. The admin enters their email address. A 4-digit code is emailed, and the admin goes to the code screen.
3. The code screen shows which email address the code was sent to. The code is checked as soon as the 4th digit is
   typed; there is no submit button.
4. A wrong code clears the boxes and shows an error. The admin can try again.
5. **Resend code** is disabled for 30 seconds after the screen opens and after each resend. The UI has no limit on
   the number of resends.
6. A correct code opens the set-password screen.
7. The new password must meet 5 rules. A checklist under the field ticks each rule as the admin types.
8. The confirm field must match the new password.
9. After a successful reset, a toast shows and the admin goes to `/auth/login` to sign in with the new password.
10. If the reset session expires (the API returns 403) on the code screen, a message shows and the admin goes to login
    after 2 seconds.
11. Opening the code screen or the set-password screen without the required URL parameters redirects to `/auth/login`.
12. All three screens are for signed-out users only. A signed-in admin is redirected to the dashboard.

## 2. Where the screens are

| Step | URL                                                         | Tab title          | Opened from                     |
| ---- | ----------------------------------------------------------- | ------------------ | ------------------------------- |
| 1    | `/auth/forgot-password`                                     | Forgot password    | "Forgot?" on the login page; "← Back to forgot password" |
| 2    | `/auth/code-verification?sessionid=<id>&email=<email>`      | Verify your email  | Step 1 after it succeeds        |
| 3    | `/auth/set-password?sessionid=<id>`                         | Set password       | Step 2 after it succeeds        |

Roles: one role, admin. Users must be signed out.

## 3. Step 1 — Forgot password

### Fields
| Field         | Selector    | Type  | Required | Rules                                                              | Default |
| ------------- | ----------- | ----- | -------- | ------------------------------------------------------------------ | ------- |
| Email address | `#fp-email` | email | Yes      | Valid email format. **Not** trimmed or lower-cased, unlike login. Focused when the page opens | Empty |

### Buttons and links
| Control                    | When enabled                                   | Success                     | Failure                    |
| -------------------------- | ---------------------------------------------- | --------------------------- | -------------------------- |
| **Send verification code** | Always, except while sending. While sending it is disabled and reads **"Sending…"** | Go to step 2   | Red banner above the field; the button is enabled again |
| **← Back to sign in**      | Always                                         | `/auth/login`               | none                       |

### Messages
| Where         | When                                  | Text                                                    |
| ------------- | ------------------------------------- | ------------------------------------------------------- |
| Under Email   | Empty                                 | Enter your email address                                |
| Under Email   | Not a valid email                     | Enter a valid email address                             |
| Red banner    | API error                             | The message from the API. If it sends none: Something went wrong. Please try again. |
| Red banner    | API returns success without a session id | Something went wrong. Please try again.              |

Static text on the page:
- Label above the heading: "Account recovery"
- Heading: "Forgot your password?"
- Subheading: "Enter your registered email and we'll send you a verification code."

Step 1 has no toasts.

## 4. Step 2 — Verify your email

### Fields
| Field             | Selector                          | Type             | Required | Rules                                                                 |
| ----------------- | --------------------------------- | ---------------- | -------- | --------------------------------------------------------------------- |
| Verification code | `getByLabel('Verification code')` | 4 single-digit boxes | Yes   | Digits only. Letters, symbols and spaces cannot be typed or pasted. It submits by itself when the 4th digit is entered. The first box is focused when the page opens |

### Buttons and links
| Control                        | When enabled                                                         | Success                                         | Failure |
| ------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------- | ------- |
| *(no submit button)*           | n/a                                                                  | Correct code: go to step 3                      | Wrong code: the boxes are cleared, the error shows, and the first box is focused again |
| **Resend code** ("in Ns" countdown next to it) | Disabled for 30 s after the page opens and after each resend. Also disabled while a code is being checked or a resend is in progress (reads **"Sending…"**) | Success toast; the boxes are cleared; the countdown restarts at 30 s | Red banner |
| **← Back to forgot password**  | Always                                                               | `/auth/forgot-password`                         | none    |

### Messages
| Where           | When                                          | Text                                                         |
| --------------- | --------------------------------------------- | ------------------------------------------------------------ |
| Under the code  | While the code is being checked               | Verifying…                                                   |
| Under the code  | Wrong code (any error except 403)             | Incorrect code entered. Please try again.                    |
| Red banner      | Verify or resend returns **403**              | Your session has expired. Redirecting to sign in… (goes to `/auth/login` after 2 s) |
| Red banner      | Resend fails (not 403)                        | The message from the API. If it sends none: Failed to resend the code. |
| Success toast   | Resend OK                                     | **New code sent**, with the line: Check {email} for a fresh 4-digit code. |

Static text on the page:
- Heading: "Verify your email"
- Subheading: "Enter the 4-digit code sent to **{email}**"

## 5. Step 3 — Set a new password

### Fields
| Field            | Selector       | Type            | Required | Rules                                                                       | Default |
| ---------------- | -------------- | --------------- | -------- | --------------------------------------------------------------------------- | ------- |
| New password     | `#sp-password` | password / text | Yes      | All 5 rules: **at least 8 characters, an uppercase letter, a lowercase letter, a number, a special character** (any character that is not a letter or a digit). Focused when the page opens | Empty |
| Confirm password | `#sp-confirm`  | password / text | Yes      | Must exactly match New password                                             | Empty |

Placeholders: "At least 8 characters", "Re-enter the new password". Each field has an eye toggle (aria-label
"Show password" / "Hide password").

**Password checklist** (under New password, in this order):
- At least 8 characters
- An uppercase letter
- A lowercase letter
- A number
- A special character

Each rule turns green with a tick as soon as it is met. Before the first submit, unmet rules are grey. After a failed
submit, unmet rules are red.

### Buttons and links
| Control                | When enabled                                        | Success                                      | Failure |
| ---------------------- | --------------------------------------------------- | -------------------------------------------- | ------- |
| **Set password**       | Always, except while saving. While saving it reads **"Saving…"** | Success toast, then go to `/auth/login` | Red banner and an error toast, both with the API message |
| **← Back to sign in**  | Always                                              | `/auth/login`                                | none    |

### Messages
| Where                    | When                                              | Text                                                          |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------- |
| Under New password       | Empty on submit                                   | Enter a new password.                                         |
| Under New password       | One or more rules not met on submit               | Your new password doesn't meet all the requirements yet.      |
| Under Confirm password   | Empty on submit                                   | Please confirm your new password.                             |
| Live hint under Confirm  | Something is typed and it matches                 | Both passwords match (green)                                  |
| Live hint under Confirm  | Something is typed and it does not match          | Both passwords have to match (grey; red after a submit)       |
| Red banner + error toast | API error                                         | Toast title **Couldn't set password**. The banner and the toast text show the API message, or Something went wrong. Please try again. |
| Success toast            | Password reset OK                                 | **Password set**, with the line: You can now sign in with your new password. |

Static text on the page:
- Heading: "Set a new password"
- Subheading: "Choose a password you don't use anywhere else."
- Right-hand panel: "One last step — Pick a new password and you're back in. You'll be signed out of any other
  sessions using the old one."

## 6. Business rules

- The code has **4 digits**.
- The resend cooldown is **30 seconds**. The UI has no limit on resends; the backend may limit them.
- After a resend, only the newest code works.
- The reset session id in the URL authorises steps 2 and 3. When it expires, the API returns 403. The code screen
  handles this with the "session has expired" message.
- The password rules are the same as for the signed-in "Change password" dialog.
- The visitor's IP address is forwarded to the API so that per-IP rate limits apply to the real user.

## 7. APIs

All four calls need no login. They run on the Next.js server, so they **do not show in the browser's Network tab**.

| Method | Endpoint                          | Body                                                       | Response                |
| ------ | --------------------------------- | ---------------------------------------------------------- | ----------------------- |
| POST   | `admin/auth/password/forgot`      | `{ "email" }`                                              | `{ "session_id" }`      |
| POST   | `admin/auth/password/otp/verify`  | `{ "session_id", "otp" }`                                  | `{ "session_id" }`      |
| POST   | `admin/auth/password/otp/resend`  | `{ "session_id" }`                                         | none                    |
| POST   | `admin/auth/password/reset`       | `{ "session_id", "password", "confirmNewPassword" }`       | none                    |

A 403 from verify or resend means the reset session has expired.

## 8. Changes since the last build

- **e0ce9d8 (1 Oct):** the four recovery API calls now run on the server instead of in the browser. The screens and
  their behaviour have not changed. The only difference QA will see is that these calls no longer appear in the
  browser's Network tab.

## 9. Known issues / notes for QA

- **Wrong digit count in the text:** the right-hand panel on `/auth/forgot-password` says "We'll email a **six-digit**
  code…", but the code has **4** digits. The fix is a one-line text change. It is not fixed in this build.
- **A completed reset changes the account's real password.** Please use a separate admin account for end-to-end reset
  tests, so the account used by the login tests keeps working.
- **QA OTP:** the QA backend accepts the fixed code **`1234`** for the QA admin account. The backend team should
  confirm that this works only on QA.

## 10. Test ids

The app has no `data-testid` attributes yet. These selectors are stable:

| Element                     | Selector                                                         |
| --------------------------- | ---------------------------------------------------------------- |
| Forgot email                | `#fp-email`                                                      |
| Send code                   | `getByRole('button', { name: 'Send verification code' })`        |
| OTP input                   | `getByLabel('Verification code')` (`fill('1234')` fills all 4 boxes) |
| Resend                      | `getByRole('button', { name: 'Resend code' })`                   |
| New password                | `#sp-password`                                                   |
| Confirm password            | `#sp-confirm`                                                    |
| Password checklist          | `#sp-password-rules`                                             |
| Set password                | `getByRole('button', { name: 'Set password' })`                  |
| Banners and field errors    | `role="alert"`                                                   |
| Headings                    | "Forgot your password?", "Verify your email", "Set a new password" |

## 11. Credentials

QA needs:
- One admin account with an inbox QA can read, or the fixed QA OTP above.
- Preferably a second admin account just for full reset tests.

The credentials are shared through the password manager and are not written in this file.
