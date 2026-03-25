/**
 * Map Server Utilities (server-only)
 *
 * Resolves Mapbox access token from env var or app_settings.
 * Separated from map-utils.ts to avoid pulling server-only deps into client bundles.
 */

import { getAppSettingValue } from '@/lib/repositories/appSettingsRepository';

/**
 * Resolve the Mapbox access token from env var (cloud) or app_settings (opensource).
 * Env var takes precedence so cloud operators can set a platform-level default.
 */
export async function getMapboxAccessToken(): Promise<string | null> {
  const envToken = process.env.MAPBOX_ACCESS_TOKEN;
  if (envToken) return envToken;

  const appToken = await getAppSettingValue<string>('mapbox', 'access_token').catch(() => null);
  return appToken || null;
}
