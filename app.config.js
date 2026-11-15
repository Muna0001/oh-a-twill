// Extends app.json. The web build can be served from a sub-path (GitHub Pages serves this
// project from /oh-a-twill/): set EXPO_BASE_URL=/oh-a-twill when exporting. Expo then prefixes
// every bundle and asset URL, and Expo Router strips the prefix when reading the URL.
// Without the variable the app is served from `/`, as before.
module.exports = ({ config }) => {
  const baseUrl = (process.env.EXPO_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!baseUrl) return config;
  if (!baseUrl.startsWith('/')) throw new Error(`EXPO_BASE_URL must start with "/" (got "${baseUrl}").`);
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};
