// nativewind@4.x (via @react-native/community-cli-plugin) hoists metro@0.84.x to
// node_modules. metro@0.84.x removed src/lib/TerminalReporter.js (and other files)
// that @expo/cli@0.22.x depends on.
//
// Fix: replace all top-level metro-* packages (and ob1) with the 0.81.5 copies
// that @react-native/community-cli-plugin nests. Those copies are already on disk
// after npm ci; we just promote them to the top level.
const fs = require('fs');
const path = require('path');
const nm = path.join(__dirname, '..', 'node_modules');
const src = path.join(nm, '@react-native', 'community-cli-plugin', 'node_modules');

if (!fs.existsSync(src)) {
  console.log('[patch-metro] community-cli-plugin nested modules not found, skipping metro replacement');
} else {
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

// expo nests some of its own packages; they must be at the top level so Metro
// can resolve them during bundling (e.g. @expo/vector-icons → expo-font).
const expoNested = path.join(nm, 'expo', 'node_modules');
if (fs.existsSync(expoNested)) {
  for (const name of fs.readdirSync(expoNested)) {
    if (!name.startsWith('expo')) continue;
    const srcPkg = path.join(expoNested, name);
    const dstPkg = path.join(nm, name);
    if (!fs.existsSync(path.join(srcPkg, 'package.json'))) continue;
    if (fs.existsSync(path.join(dstPkg, 'package.json'))) continue;
    fs.rmSync(dstPkg, { recursive: true, force: true });
    fs.cpSync(srcPkg, dstPkg, { recursive: true });
    const ver = JSON.parse(fs.readFileSync(path.join(dstPkg, 'package.json'), 'utf8')).version;
    console.log(`[patch-metro] promoted ${name}@${ver} to top level`);
  }
}
