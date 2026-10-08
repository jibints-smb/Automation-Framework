/**
 * Parts of the Bergen Kids Admin shell shared by every page — field model.
 */
import { defineWebFields } from '@core/models/field.types';

export const AppShellFields = defineWebFields({
  /** Full-screen "Loading console" splash over every first page load (about 3.5 s), then removed. */
  splash: { label: 'Loading splash', type: 'label', locator: { role: 'progressbar', name: 'Loading Bergen Kids Admin' } },
});
