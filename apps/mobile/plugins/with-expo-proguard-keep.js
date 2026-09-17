const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Appends a ProGuard keep rule for expo.modules.** so R8 does not strip
 * Kotlin reflection types (e.g. expo.modules.kotlin.types.LazyKType) that
 * prebuilt expo module AARs resolve at runtime. Without this, release
 * builds crash on startup with NoClassDefFoundError.
 */
function withExpoProguardKeep(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const root = config.modRequest.projectRoot;
      const file = path.join(root, "android", "app", "proguard-rules.pro");
      const rule = "-keep class expo.modules.** { *; }";
      let content = "";
      if (fs.existsSync(file)) {
        content = fs.readFileSync(file, "utf8");
      }
      if (!content.includes(rule)) {
        content +=
          "\n# Keep expo modules (R8 strips Kotlin reflection types used at runtime)\n" +
          rule +
          "\n";
        fs.writeFileSync(file, content, "utf8");
      }
      return config;
    },
  ]);
}

module.exports = withExpoProguardKeep;
