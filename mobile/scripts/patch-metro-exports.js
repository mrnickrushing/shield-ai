// nativewind@4.2.5 includes @react-native/community-cli-plugin@0.86.0 which
// causes npm to hoist metro@0.84.x to node_modules. metro@0.84.x removed
// src/lib/TerminalReporter.js (and other files) that @expo/cli@0.22.x depends on.
//
// Fix: replace all top-level metro-* packages (and ob1, which metro-source-map
// needs) with the 0.81.5 copies that @react-native/community-cli-plugin uses.
// These copies are already in node_modules; we just need them at the top level.
const fs = require('fs');
const path = require('path');
const nm = path.join(__dirname, '..', 'node_modules');
const src = path.join(nm, '@react-native', 'community-cli-plugin', 'node_modules');

if (!fs.existsSync(src)) {
  console.log('[patch-metro] community-cli-plugin nested modules not found, skipping metro replacement');
} else {
  // Replace metro-* and ob1 with 0.81.5 from the nested community-cli-plugin copy
  const replace = fs.readdirSync(src).filter(n => n.startsWith('metro') || n === 'ob1');
  for (const pkg of replace) {
    const srcPkg = path.join(src, pkg);
    const dstPkg = path.join(nm, pkg);
    const srcVer = JSON.parse(fs.readFileSync(path.join(srcPkg, 'package.json'), 'utf8')).version;
    const dstVer = fs.existsSync(path.join(dstPkg, 'package.json'))
      ? JSON.parse(fs.readFileSync(path.join(dstPkg, 'package.json'), 'utf8')).version
      : '(none)';
    if (srcVer === dstVer) continue;
    fs.rmSync(dstPkg, { recursive: true, force: true });
    fs.cpSync(srcPkg, dstPkg, { recursive: true });
    console.log(`[patch-metro] replaced ${pkg}: ${dstVer} → ${srcVer}`);
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
