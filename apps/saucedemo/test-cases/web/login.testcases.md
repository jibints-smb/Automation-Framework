# Test cases — Login

| Item        | Value                                   |
| ----------- | --------------------------------------- |
| Source      | requirements/web/SCRUM-101-login.md     |
| Jira        | SCRUM-101                               |
| Epic        | Authentication                          |
| Feature     | Login                                   |
| Platform    | web, mobile-web                         |
| Spec file   | tests/web/login/login.spec.ts           |

## Preconditions
- User is logged out and on the login page.

## Test cases
| ID          | Title                                     | Type     | Priority | Tags               | Steps                                                   | Expected result                                                         | Automate |
| ----------- | ----------------------------------------- | -------- | -------- | ------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| TC-LOGIN-01 | Valid user is taken to the Products page  | positive | critical | @smoke             | 1. Enter valid username/password 2. Click Login         | Products page is shown                                                  | yes      |
| TC-LOGIN-02 | Wrong password shows credentials error    | negative | critical | @regression        | 1. Enter valid username, wrong password 2. Click Login  | "Epic sadface: Username and password do not match any user in this service" | yes  |
| TC-LOGIN-03 | Locked out user cannot log in             | negative | normal   | @regression        | 1. Enter locked_out_user + valid password 2. Click Login | "Epic sadface: Sorry, this user has been locked out."                  | yes      |
| TC-LOGIN-04 | Empty username shows required error       | negative | normal   | @regression        | 1. Leave username empty, enter password 2. Click Login  | "Epic sadface: Username is required"                                    | yes      |
| TC-LOGIN-05 | Empty password shows required error       | negative | normal   | @regression        | 1. Enter username, leave password empty 2. Click Login  | "Epic sadface: Password is required"                                    | yes      |
