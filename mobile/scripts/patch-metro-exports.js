// nativewind@4.2.5 pulls @react-native/community-cli-plugin@0.86.0 which
// hoists metro@0.84.x to node_modules. That version has a strict exports map
// that omits ./src/lib/TerminalReporter, which @expo/cli@0.22.x imports directly.
// This script adds the missing export so the production bundle step doesn't fail.
const fs = require('fs');
const pkgPath = require.resolve('metro/package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg.exports && !pkg.exports['./src/lib/TerminalReporter']) {
  pkg.exports['./src/lib/TerminalReporter'] = './src/lib/TerminalReporter.js';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[patch-metro-exports] added TerminalReporter export to metro@' + pkg.version);
}
