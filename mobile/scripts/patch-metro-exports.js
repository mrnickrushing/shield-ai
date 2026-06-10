// nativewind@4.2.5 includes @react-native/community-cli-plugin@0.86.0 which
// causes npm to hoist metro@0.84.x to node_modules. The 0.84.x packages have
// strict exports maps that break @expo/cli@0.22.x and @expo/metro-config, both
// of which were built against metro@0.81.x.
//
// Fix: replace all top-level metro-* packages with the 0.81.5 copies that
// @react-native/community-cli-plugin nested for itself.
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'node_modules', '@react-native', 'community-cli-plugin', 'node_modules');
const dst = path.join(__dirname, '..', 'node_modules');

if (!fs.existsSync(src)) {
  console.log('[patch-metro] no nested community-cli-plugin found, skipping');
  process.exit(0);
}

const pkgs = fs.readdirSync(src).filter(n => n.startsWith('metro'));
let patched = 0;
for (const pkg of pkgs) {
  const srcPkg = path.join(src, pkg);
  const dstPkg = path.join(dst, pkg);
  const srcVer = JSON.parse(fs.readFileSync(path.join(srcPkg, 'package.json'), 'utf8')).version;
  const dstVer = fs.existsSync(path.join(dstPkg, 'package.json'))
    ? JSON.parse(fs.readFileSync(path.join(dstPkg, 'package.json'), 'utf8')).version
    : '(none)';
  if (srcVer === dstVer) continue;
  fs.rmSync(dstPkg, { recursive: true, force: true });
  fs.cpSync(srcPkg, dstPkg, { recursive: true });
  console.log(`[patch-metro] replaced ${pkg}: ${dstVer} → ${srcVer}`);
  patched++;
}
if (patched === 0) console.log('[patch-metro] metro: nothing to patch');

// Packages that are nested under their parent but must be at the top level
// so Babel / metro can resolve them from the project root.
const promotions = [
  // expo-asset: @expo/metro-config requires it from the project root
  [path.join(dst, 'expo', 'node_modules', 'expo-asset'), path.join(dst, 'expo-asset')],
  // nativewind nests its runtime deps; they must be at top level for Metro resolution
  [path.join(dst, 'nativewind', 'node_modules', 'react-native-worklets'), path.join(dst, 'react-native-worklets')],
  [path.join(dst, 'nativewind', 'node_modules', 'react-native-reanimated'), path.join(dst, 'react-native-reanimated')],
  [path.join(dst, 'nativewind', 'node_modules', 'react-native-css-interop'), path.join(dst, 'react-native-css-interop')],
];

for (const [srcPkg, dstPkg] of promotions) {
  const srcJson = path.join(srcPkg, 'package.json');
  const dstJson = path.join(dstPkg, 'package.json');
  if (!fs.existsSync(srcJson)) continue;
  if (fs.existsSync(dstJson)) continue;  // already at top level
  fs.rmSync(dstPkg, { recursive: true, force: true });
  fs.cpSync(srcPkg, dstPkg, { recursive: true });
  const ver = JSON.parse(fs.readFileSync(dstJson, 'utf8')).version;
  console.log(`[patch-metro] promoted ${path.basename(dstPkg)}@${ver} to top level`);
}
