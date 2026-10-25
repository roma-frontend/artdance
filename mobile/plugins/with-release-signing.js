// Release-подпись Android для локальных сборок: ключ берётся из gradle-свойств, а не debug.keystore.
// EAS подписывает сам (EAS_BUILD=true), поэтому там проверка не мешает.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// artdance-release-signing';

const SIGNING = `
        release { ${MARKER}
            if (findProperty('ARTDANCE_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('ARTDANCE_UPLOAD_STORE_FILE'))
                storePassword findProperty('ARTDANCE_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('ARTDANCE_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('ARTDANCE_UPLOAD_KEY_PASSWORD')
            }
        }`;

const GUARD = `
${MARKER}
gradle.taskGraph.whenReady { graph ->
    def releasing = graph.allTasks.any { task ->
        (task.name.startsWith('assemble') || task.name.startsWith('bundle')) && task.name.endsWith('Release')
    }
    if (releasing && System.getenv('EAS_BUILD') != 'true' && !findProperty('ARTDANCE_UPLOAD_STORE_FILE')) {
        throw new GradleException('Release signing is not configured: set ARTDANCE_UPLOAD_STORE_FILE, ARTDANCE_UPLOAD_STORE_PASSWORD, ARTDANCE_UPLOAD_KEY_ALIAS and ARTDANCE_UPLOAD_KEY_PASSWORD in ~/.gradle/gradle.properties.')
    }
}
`;

function applySigning(contents) {
  if (contents.includes(MARKER)) return contents;
  let next = contents.replace(/(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/, `$1${SIGNING}`);
  next = next.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
  return `${next}\n${GUARD}`;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language === 'groovy') mod.modResults.contents = applySigning(mod.modResults.contents);
    return mod;
  });
};

module.exports.applySigning = applySigning;
