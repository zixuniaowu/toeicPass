const appJson = require("./app.json");

const baseConfig = appJson.expo;

const variant = process.env.APP_VARIANT ?? "production";
// APP_LANG selects the store-separated flavor: "en" and "ja" build two
// independent apps (different package/bundle ids and names). "both" keeps the
// combined legacy app with the in-app language toggle (used for development).
const lang = process.env.APP_LANG ?? "both";

const variants = {
  development: {
    androidPackageSuffix: ".dev",
    bundleIdentifierSuffix: ".dev",
    nameSuffix: " Dev",
    schemeSuffix: "-dev",
    slugSuffix: "-dev",
  },
  preview: {
    androidPackageSuffix: ".preview",
    bundleIdentifierSuffix: ".preview",
    nameSuffix: " Preview",
    schemeSuffix: "-preview",
    slugSuffix: "-preview",
  },
  production: {
    androidPackageSuffix: "",
    bundleIdentifierSuffix: "",
    nameSuffix: "",
    schemeSuffix: "",
    slugSuffix: "",
  },
};

const langs = {
  both: {
    name: baseConfig.name,
    androidPackage: baseConfig.android.package,
    iosBundleIdentifier: baseConfig.ios.bundleIdentifier,
    scheme: baseConfig.scheme,
    slug: baseConfig.slug,
  },
  en: {
    name: "英语跟读 LangBoost",
    androidPackage: "com.toeicpass.english",
    iosBundleIdentifier: "com.toeicpass.english",
    scheme: "langboost-en",
    slug: "langboost-en",
  },
  ja: {
    name: "日语跟读 LangBoost",
    androidPackage: "com.toeicpass.japanese",
    iosBundleIdentifier: "com.toeicpass.japanese",
    scheme: "langboost-ja",
    slug: "langboost-ja",
  },
};

const selectedVariant = variants[variant] ?? variants.production;
const selectedLang = langs[lang] ?? langs.both;

const iconForLang = {
  en: "./assets/icon-en.png",
  ja: "./assets/icon-ja.png",
  both: baseConfig.icon,
};

module.exports = () => ({
  ...baseConfig,
  name: `${selectedLang.name}${selectedVariant.nameSuffix}`,
  slug: `${selectedLang.slug}${selectedVariant.slugSuffix}`,
  scheme: `${selectedLang.scheme}${selectedVariant.schemeSuffix}`,
  icon: iconForLang[lang] ?? baseConfig.icon,
  android: {
    ...baseConfig.android,
    package: `${selectedLang.androidPackage}${selectedVariant.androidPackageSuffix}`,
    adaptiveIcon: {
      ...baseConfig.android.adaptiveIcon,
      foregroundImage: iconForLang[lang] ?? baseConfig.android.adaptiveIcon.foregroundImage,
    },
  },
  ios: {
    ...baseConfig.ios,
    bundleIdentifier: `${selectedLang.iosBundleIdentifier}${selectedVariant.bundleIdentifierSuffix}`,
  },
  plugins: [
    ...(baseConfig.plugins ?? []),
    "./plugins/with-expo-proguard-keep.js",
  ],
  extra: {
    ...(baseConfig.extra ?? {}),
    appVariant: variant,
    appLang: lang,
    ...(process.env.EXPO_PUBLIC_LAN_API_URL || process.env.APP_LAN_API_URL
      ? { lanApiBase: process.env.EXPO_PUBLIC_LAN_API_URL ?? process.env.APP_LAN_API_URL }
      : {}),
    ...(process.env.EXPO_PUBLIC_PREVIEW_API_URL || process.env.APP_PREVIEW_API_URL
      ? { previewApiBase: process.env.EXPO_PUBLIC_PREVIEW_API_URL ?? process.env.APP_PREVIEW_API_URL }
      : {}),
    ...(process.env.EXPO_PUBLIC_API_URL ? { apiBase: process.env.EXPO_PUBLIC_API_URL } : {}),
  },
});
