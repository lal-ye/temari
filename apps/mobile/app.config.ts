import type { ConfigContext, ExpoConfig } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config, name: config.name!, slug: config.slug!,
  // Public build identity only. Never pass keys/tokens through Expo config.
  extra: { ...config.extra, buildCommit: process.env.GITHUB_SHA ?? process.env.EAS_BUILD_GIT_COMMIT_HASH ?? 'local' },
});
