# SCRUM-101 — User can log in

| Item          | Value                |
| ------------- | -------------------- |
| Jira          | SCRUM-101            |
| Epic          | Authentication       |
| Module        | Login                |
| Platform      | web                  |
| URL / Screen  | /                    |
| Priority      | critical             |

## Description
As a registered customer, I want to log in with my username and password so that I can shop.

## Acceptance criteria
1. Given valid credentials, when I click Login, then I land on the Products page.
2. Given a wrong password, then I see "Epic sadface: Username and password do not match any user in this service".
3. Given a locked-out user, then I see "Epic sadface: Sorry, this user has been locked out."
4. Username and password are required and show their own error message when empty.

## Fields
| Field        | Type     | Required | Rules / Validation | Error message                        | Locator hint             |
| ------------ | -------- | -------- | ------------------ | ------------------------------------ | ------------------------ |
| Username     | text     | yes      |                    | Epic sadface: Username is required   | data-test=username       |
| Password     | password | yes      | masked             | Epic sadface: Password is required   | data-test=password       |
| Login button | button   |          |                    |                                      | data-test=login-button   |
| Error message| label    |          |                    |                                      | data-test=error          |

## Test data / accounts
- `standard_user` / `secret_sauce` — valid user (from .env)
- `locked_out_user` / `secret_sauce` — locked user
