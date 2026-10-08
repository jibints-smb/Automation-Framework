/**
 * Admin Dashboard (`/`) and the account menu in the sidebar — field model.
 * Source: requirements/web/BK-1-login.md (landing page after login, Sign out)
 */
import { defineWebFields } from '@core/models/field.types';

export const DashboardFields = defineWebFields({
  heading: { label: 'Dashboard heading', type: 'label', locator: { role: 'heading', name: 'Dashboard', exact: true } },
  accountMenu: { label: 'Account menu', type: 'button', locator: { role: 'button', name: /Super Admin/ } },
  signOut: { label: 'Sign out', type: 'button', locator: { role: 'button', name: 'Sign out', exact: true } },
  confirmSignOut: {
    label: 'Sign out (confirm)',
    type: 'button',
    locator: { css: '[role="alertdialog"] button:text-is("Sign out")' },
  },
});
