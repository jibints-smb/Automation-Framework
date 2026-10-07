/**
 * Mobile app home screen — field model (placeholder IDs, see login.model.ts).
 */
import { defineMobileFields } from '@core/models/field.types';

export const MobileHomeFields = defineMobileFields({
  welcomeTitle: { label: 'Welcome title', type: 'label', locator: { accessibilityId: 'home-title' } },
  menuButton: { label: 'Menu', type: 'button', locator: { accessibilityId: 'home-menu' } },
});
