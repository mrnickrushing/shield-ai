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
if (patched === 0) console.log('[patch-metro] nothing to patch');
