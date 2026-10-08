# Report branding

Put the company logo in this folder (SVG, PNG, JPG or WebP, any file name; if there are several images, `logo.*`
wins). It appears in the Allure report header and is embedded in the report, so archived single-file reports keep it.

- A wide logo that already contains the company name (like `sysyitlogo.png`) shows on a white tile next to
  "QA Automation Report"; the browser-tab icon then stays the small "N" mark, as a wordmark is unreadable at 16 px.
- SVG is best (sharp at every size). A PNG should be at least 128 px high, with a transparent background.
- No image here: the report uses the default blue "N" mark with the company name as text.

Company name, colours and header text: `src/report/brand.mjs`. After changing the logo, rebuild the report:
`npm run report`.
