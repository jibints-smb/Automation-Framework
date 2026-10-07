# MOB-201 — User can log in to the mobile app

| Item          | Value                |
| ------------- | -------------------- |
| Jira          | MOB-201              |
| Epic          | Authentication       |
| Module        | Mobile login         |
| Platform      | android, ios         |
| URL / Screen  | Login screen         |
| Priority      | critical             |

## Description
As an app user, I want to log in so that I can reach my home screen.

## Acceptance criteria
1. Valid credentials take the user to the Home screen.
2. A wrong password shows "Invalid username or password".
3. "Remember me" keeps the user logged in after restarting the app.

## Fields
| Field         | Type     | Required | Rules | Error message             | Locator hint (accessibility id)   |
| ------------- | -------- | -------- | ----- | ------------------------- | --------------------------------- |
| Username      | text     | yes      |       | Username is required      | login-username                    |
| Password      | password | yes      |       | Password is required      | login-password                    |
| Remember me   | checkbox | no       |       |                           | Android id: com.company.app:id/remember_me, iOS: login-remember-me |
| Login button  | button   |          |       |                           | login-button                      |
| Error message | label    |          |       |                           | login-error                       |
