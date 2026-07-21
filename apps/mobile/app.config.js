const appJson = require("./app.json");

const baseConfig = appJson.expo;
const variant = process.env.APP_VARIANT ?? "production";

const variants = {
  development: {
    androidPackageSuffix: ".dev",
    bundleIdentifierSuffix: ".dev",
    name: "toeicPass Dev",
    scheme: "toeicpass-dev",
    slug: "toeicpass-mobile-dev",
  },
  preview: {
    androidPackageSuffix: ".preview",
    bundleIdentifierSuffix: ".preview",
    name: "toeicPass Preview",
    scheme: "toeicpass-preview",
    slug: "toeicpass-mobile-preview",
  },
  production: {
    androidPackageSuffix: "",
    bundleIdentifierSuffix: "",
    name: baseConfig.name,
    scheme: baseConfig.scheme,
    slug: baseConfig.slug,
  },
};

const selectedVariant = variants[variant] ?? variants.production;

module.exports = () => ({
  ...baseConfig,
  name: selectedVariant.name,
  slug: selectedVariant.slug,
  scheme: selectedVariant.scheme,
  android: {
    ...baseConfig.android,
    package: `${baseConfig.android.package}${selectedVariant.androidPackageSuffix}`,
  },
  ios: {
    ...baseConfig.ios,
    bundleIdentifier: `${baseConfig.ios.bundleIdentifier}${selectedVariant.bundleIdentifierSuffix}`,
  },
  extra: {
    ...(baseConfig.extra ?? {}),
    appVariant: variant,
    lanApiBase: process.env.EXPO_PUBLIC_LAN_API_URL ?? process.env.APP_LAN_API_URL ?? null,
    previewApiBase:
      process.env.EXPO_PUBLIC_PREVIEW_API_URL ?? process.env.APP_PREVIEW_API_URL ?? null,
  },
});
