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

// expo-asset is only installed nested under expo/node_modules but
// @expo/metro-config resolves it from the project root.
const expoAssetSrc = path.join(dst, 'expo', 'node_modules', 'expo-asset');
const expoAssetDst = path.join(dst, 'expo-asset');
if (
  fs.existsSync(path.join(expoAssetSrc, 'package.json')) &&
  !fs.existsSync(path.join(expoAssetDst, 'package.json'))
) {
  fs.rmSync(expoAssetDst, { recursive: true, force: true });
  fs.cpSync(expoAssetSrc, expoAssetDst, { recursive: true });
  const ver = JSON.parse(fs.readFileSync(path.join(expoAssetDst, 'package.json'), 'utf8')).version;
  console.log(`[patch-metro] promoted expo-asset@${ver} to top level`);
}
