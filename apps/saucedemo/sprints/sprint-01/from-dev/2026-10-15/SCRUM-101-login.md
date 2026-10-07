# SCRUM-101 Login (web) - build 1.0.0, 15 Oct

<!--
  EXAMPLE developer note, saved exactly as received (never edit it). Developers write in their own format;
  QA merges it into requirements/web/SCRUM-101-login.md. Practice steps: sprints/sprint-01.md
-->

Hi QA, login is ready on https://www.saucedemo.com

What's built:
- Username + password + Login button on the home page (/)
- Valid login goes to /inventory.html (Products)
- Accounts: standard_user (normal), locked_out_user (locked), problem_user. Password for all is in the password manager, not here.

Errors (shown in the red box above the button):
- empty username -> "Epic sadface: Username is required"
- empty password -> "Epic sadface: Password is required"
- wrong password -> "Epic sadface: Username and password do not match any user in this service"
- locked user -> "Epic sadface: Sorry, this user has been locked out."
- NEW: the red box has an X button that closes it; the red X icons on the inputs disappear too

Test ids (data-test): username, password, login-button, error, error-button (the X)

Changed since last build:
- added the close (X) button on the error box
