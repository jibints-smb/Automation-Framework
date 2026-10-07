# Test cases — Mobile login

| Item        | Value                                   |
| ----------- | --------------------------------------- |
| Source      | requirements/mobile/MOB-201-login.md    |
| Jira        | MOB-201                                 |
| Epic        | Authentication                          |
| Feature     | Mobile login                            |
| Platform    | android, ios                            |
| Spec file   | tests/mobile/login/login.spec.ts        |

## Preconditions
- App freshly installed and opened on the Login screen.

## Test cases
| ID           | Title                                  | Type     | Priority | Tags        | Steps                                             | Expected result                        | Automate |
| ------------ | -------------------------------------- | -------- | -------- | ----------- | ------------------------------------------------- | -------------------------------------- | -------- |
| TC-MLOGIN-01 | Valid user reaches the home screen     | positive | critical | @smoke      | 1. Enter valid credentials 2. Turn on Remember me 3. Tap Login | Home screen is shown       | yes      |
| TC-MLOGIN-02 | Wrong password shows an error          | negative | critical | @regression | 1. Enter valid username, wrong password 2. Tap Login | "Invalid username or password"       | yes      |
| TC-MLOGIN-03 | Remember me survives an app restart    | positive | normal   | @regression | 1. Log in with Remember me 2. Restart the app      | Home screen is shown without login     | later    |
