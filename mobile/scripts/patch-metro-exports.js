// nativewind@4.2.5 includes @react-native/community-cli-plugin@0.86.0 which
// causes npm to hoist metro@0.84.x to node_modules. metro@0.84.x added a strict
// exports map that prevents @expo/cli@0.22.x and @expo/metro-config from importing
// internal paths (e.g. metro/src/lib/TerminalReporter, metro-cache/src/stores/FileStore).
//
// Fix: remove the "exports" field from all top-level metro-* package.json files so
// that Node resolves internal paths the old way (direct file lookup). This avoids
// the cascade dependency issues that come from replacing the entire metro-* packages
// with their 0.81.5 equivalents.
const fs = require('fs');
const path = require('path');
const nm = path.join(__dirname, '..', 'node_modules');

const metroPkgs = [
  'metro', 'metro-babel-transformer', 'metro-cache', 'metro-cache-key',
  'metro-config', 'metro-core', 'metro-file-map', 'metro-minify-terser',
  'metro-resolver', 'metro-runtime', 'metro-source-map', 'metro-symbolicate',
  'metro-transform-plugins', 'metro-transform-worker',
];
for (const pkg of metroPkgs) {
  const jsonPath = path.join(nm, pkg, 'package.json');
  if (!fs.existsSync(jsonPath)) continue;
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  if (data.exports) {
    delete data.exports;
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`[patch-metro] removed exports restriction from ${pkg}@${data.version}`);
  }
}

// Packages that are nested under their parent but must be at the top level
// so Babel / metro can resolve them from the project root.
const promotions = [
  // expo-asset: @expo/metro-config requires it from the project root
  [path.join(nm, 'expo', 'node_modules', 'expo-asset'), path.join(nm, 'expo-asset')],
  // nativewind nests its runtime deps; they must be at top level for Metro resolution
  [path.join(nm, 'nativewind', 'node_modules', 'react-native-worklets'), path.join(nm, 'react-native-worklets')],
  [path.join(nm, 'nativewind', 'node_modules', 'react-native-reanimated'), path.join(nm, 'react-native-reanimated')],
  [path.join(nm, 'nativewind', 'node_modules', 'react-native-css-interop'), path.join(nm, 'react-native-css-interop')],
];

for (const [srcPkg, dstPkg] of promotions) {
  const srcJson = path.join(srcPkg, 'package.json');
  const dstJson = path.join(dstPkg, 'package.json');
  if (!fs.existsSync(srcJson)) continue;
  if (fs.existsSync(dstJson)) continue;
  fs.rmSync(dstPkg, { recursive: true, force: true });
  fs.cpSync(srcPkg, dstPkg, { recursive: true });
  const ver = JSON.parse(fs.readFileSync(dstJson, 'utf8')).version;
  console.log(`[patch-metro] promoted ${path.basename(dstPkg)}@${ver} to top level`);
}
