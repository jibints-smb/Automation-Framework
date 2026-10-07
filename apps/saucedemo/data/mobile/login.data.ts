/** Mobile login test data — see test-cases/mobile/login.testcases.md */
import { getEnv } from '@core/config/env';
import type { MobileLoginData } from '@apps/saucedemo/models/mobile/login.model';

export const validMobileUser: MobileLoginData = {
  username: getEnv('MOBILE_USERNAME'),
  password: getEnv('MOBILE_PASSWORD'),
  rememberMe: true,
};

export const wrongPasswordUser: MobileLoginData = {
  username: getEnv('MOBILE_USERNAME'),
  password: 'wrong_password',
};
