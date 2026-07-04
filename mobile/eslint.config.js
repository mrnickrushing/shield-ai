const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "node_modules/*", "scripts/*", "patches/*"],
  },
  {
    rules: {
      // TypeScript already validates module resolution; the import resolver
      // can't follow package "exports" maps (e.g. expo-file-system).
      "import/no-unresolved": "off",
      // Reanimated's documented API mutates sharedValue.value in handlers
      // and effects, which this rule can't distinguish from render mutation.
      "react-hooks/immutability": "off",
      // Prop->state sync effects predate this rule; treat as advisory.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
