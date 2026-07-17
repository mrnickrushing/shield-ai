const { FlatCompat } = require("@eslint/eslintrc");
const path = require("node:path");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: path.dirname(require.resolve("eslint-config-expo/package.json")),
});

module.exports = [
  ...compat.extends("expo"),
  {
    ignores: ["dist/*", ".expo/*", "node_modules/*", "scripts/*", "patches/*", "android/*", "ios/*"],
  },
  {
    files: ["eslint.config.js", "plugins/**/*.js"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        module: "readonly",
        require: "readonly",
      },
    },
  },
  {
    files: ["plugins/safariExtension/resources/**/*.js"],
    languageOptions: {
      globals: {
        document: "readonly",
        history: "readonly",
        location: "readonly",
        sessionStorage: "readonly",
      },
    },
  },
  {
    rules: {
      // TypeScript already validates module resolution; the import resolver
      // can't follow package "exports" maps (e.g. expo-file-system).
      "import/no-unresolved": "off",
    },
  },
];
