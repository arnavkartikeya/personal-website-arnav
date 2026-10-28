#!/usr/bin/env node
/**
 * npm run publish [-- --dry-run] [-- -m "message"]
 *
 * Builds the site (which validates every post against the content schema),
 * then commits only content (src/content, public) and pushes main. The push
 * triggers .github/workflows/deploy.yml, which rebuilds and deploys to Pages.
 *
 * This is the step the editor's Publish button will eventually call after
 * writing a post into src/content/blog/.
 */
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const msgIndex = args.indexOf('-m');
const customMessage = msgIndex >= 0 ? args[msgIndex + 1] : undefined;
const CONTENT_PATHS = ['src/content', 'public'];

// trimEnd, not trim: porcelain status lines start with a meaningful space.
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trimEnd();
const run = (cmd, a) => execFileSync(cmd, a, { stdio: 'inherit' });
const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};

const branch = git('branch', '--show-current');
if (branch !== 'main') fail(`Publishing deploys from main, but you're on "${branch}".`);

const changed = git('status', '--porcelain', '--untracked-files=all', '--', ...CONTENT_PATHS)
  .split('\n')
  .filter(Boolean)
  .map((line) => line.slice(3));
const unpushed = unpushedCount();

function unpushedCount() {
  try {
    return Number(git('rev-list', '--count', '@{u}..HEAD'));
  } catch {
    return 0; // no upstream yet; the first push sets it
  }
}

if (changed.length === 0 && unpushed === 0) {
  console.log('Nothing to publish: no content changes and nothing unpushed.');
  process.exit(0);
}

console.log('Content changes:\n' + (changed.map((f) => `  ${f}`).join('\n') || '  (none, pushing existing commits)'));

console.log('\nBuilding to check everything renders…');
try {
  run('npm', ['run', 'build']);
} catch {
  fail('Build failed, nothing was committed. Fix the errors above and try again.');
}

const posts = [...new Set(changed.filter((f) => f.startsWith('src/content/blog/')).map((f) => f.split('/')[3].replace(/\.mdx?$/, '')))];
const message = customMessage ?? (posts.length ? `Publish: ${posts.join(', ')}` : 'Update site content');

if (dryRun) {
  console.log(`\n(dry run) Would commit "${message}" and push main.`);
  process.exit(0);
}

if (changed.length > 0) {
  run('git', ['add', '--', ...CONTENT_PATHS]);
  run('git', ['commit', '-m', message]);
}
run('git', ['push', '-u', 'origin', 'main']);
console.log('\n✓ Pushed. GitHub Actions will deploy in a minute or two (see the Actions tab).');
