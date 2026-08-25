import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '/').split('/');
const apiRoot = process.env.GITHUB_API_URL ?? 'https://api.github.com';
const token = process.env.GITHUB_TOKEN ?? '';

function fail(message) {
  throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function resetDirectory(path) {
  rmSync(path, { force: true, recursive: true });
  mkdirSync(path, { recursive: true });
}

function appendOutput(name, value) {
  writeFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: 'a' });
}

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${apiRoot}${path}`;
  const headers = {
    Accept: options.accept ?? 'application/vnd.github+json',
    'User-Agent': 'videojs-codex-workflows',
    'X-GitHub-Api-Version': '2022-11-28',
    ...options.headers,
  };

  if (token && url.startsWith(apiRoot)) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? 'GET',
    redirect: options.redirect ?? 'follow',
  });

  if (options.allow404 && response.status === 404) return null;

  if (!response.ok) {
    const detail = await response.text();

    fail(`GitHub request failed (${response.status}) ${url}: ${detail.slice(0, 500)}`);
  }

  if (options.format === 'buffer') return Buffer.from(await response.arrayBuffer());
  if (response.status === 204) return null;

  return response.json();
}

async function paginate(path, maxPages = 3) {
  const separator = path.includes('?') ? '&' : '?';
  const values = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await request(`${path}${separator}per_page=100&page=${page}`);
    const pageValues = Array.isArray(result) ? result : result.items;

    values.push(...pageValues);
    if (pageValues.length < 100) break;
  }

  return values;
}

function eventPayload() {
  return readJson(process.env.GITHUB_EVENT_PATH);
}

function issueFields(issue) {
  return {
    assignees: (issue.assignees ?? []).map((assignee) => assignee.login),
    body: issue.body ?? '',
    comments: issue.comments ?? 0,
    htmlUrl: issue.html_url,
    labels: (issue.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name)),
    locked: issue.locked ?? false,
    milestone: issue.milestone?.title ?? null,
    number: issue.number,
    state: issue.state,
    title: issue.title,
    updatedAt: issue.updated_at,
    user: issue.user?.login ?? null,
  };
}

function pullRequestFields(pullRequest) {
  return {
    author: pullRequest.user?.login ?? null,
    baseRef: pullRequest.base?.ref ?? null,
    body: pullRequest.body ?? '',
    headRef: pullRequest.head?.ref ?? null,
    headSha: pullRequest.head?.sha ?? null,
    htmlUrl: pullRequest.html_url,
    mergeCommitSha: pullRequest.merge_commit_sha ?? null,
    mergedAt: pullRequest.merged_at ?? null,
    number: pullRequest.number,
    state: pullRequest.state,
    title: pullRequest.title,
    updatedAt: pullRequest.updated_at,
  };
}

function usefulSearchTerms(title) {
  const stopWords = new Set([
    'about',
    'after',
    'before',
    'chore',
    'docs',
    'feature',
    'from',
    'issue',
    'that',
    'this',
    'videojs',
    'with',
  ]);

  return [...new Set((title.toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? []).filter((term) => !stopWords.has(term)))]
    .slice(0, 5)
    .join(' ');
}

async function searchIssues(query, limit = 30) {
  const parameters = new URLSearchParams({ per_page: String(Math.min(limit, 100)), q: query });
  const result = await request(`/search/issues?${parameters}`);

  return result.items.slice(0, limit);
}

async function getIssue(number) {
  return request(`/repos/${owner}/${repo}/issues/${number}`);
}

async function getIssueComments(number) {
  return paginate(`/repos/${owner}/${repo}/issues/${number}/comments`, 2);
}

async function getPullRequest(number) {
  return request(`/repos/${owner}/${repo}/pulls/${number}`);
}

async function prepareIssueTriage(outputDirectory) {
  const event = eventPayload();
  const issue = issueFields(event.issue);
  const terms = usefulSearchTerms(issue.title);
  const queryTerms = terms || `#${issue.number}`;
  const [labels, milestones, candidates, pullRequests, docsIndex] = await Promise.all([
    paginate(`/repos/${owner}/${repo}/labels`, 3),
    paginate(`/repos/${owner}/${repo}/milestones?state=open`, 2),
    searchIssues(`repo:${owner}/${repo} is:issue state:open ${queryTerms}`, 30),
    searchIssues(`repo:${owner}/${repo} is:pr state:open ${queryTerms}`, 20),
    fetch('https://videojs.org/llms.txt').then((response) => (response.ok ? response.text() : '')).catch(() => ''),
  ]);

  writeJson(join(outputDirectory, 'context.json'), {
    candidates: candidates.filter((candidate) => candidate.number !== issue.number).map(issueFields),
    docsIndex,
    issue,
    labels: labels.map((label) => ({ description: label.description ?? '', name: label.name })),
    milestones: milestones.map((milestone) => ({ description: milestone.description ?? '', title: milestone.title })),
    openPullRequests: pullRequests.map((pullRequest) => ({
      body: pullRequest.body ?? '',
      htmlUrl: pullRequest.html_url,
      number: pullRequest.number,
      title: pullRequest.title,
    })),
    roadmapUrl: 'https://github.com/orgs/videojs/projects/7',
    trigger: event.action,
  });
}

function referencedNumbers(text) {
  return [...new Set([...(text ?? '').matchAll(/#(\d+)/g)].map((match) => Number(match[1])))];
}

async function prepareIssueSync(outputDirectory) {
  const event = eventPayload();
  const pullRequest = await getPullRequest(event.pull_request.number);
  const [files, comments, timeline] = await Promise.all([
    paginate(`/repos/${owner}/${repo}/pulls/${pullRequest.number}/files`, 3),
    getIssueComments(pullRequest.number),
    paginate(`/repos/${owner}/${repo}/issues/${pullRequest.number}/timeline`, 3),
  ]);
  const explicit = referencedNumbers(`${pullRequest.title}\n${pullRequest.body ?? ''}`);
  const crossReferenced = timeline
    .map((item) => item.source?.issue?.number)
    .filter((number) => Number.isInteger(number));
  const terms = usefulSearchTerms(pullRequest.title);
  const searched = terms ? await searchIssues(`repo:${owner}/${repo} is:issue ${terms}`, 20) : [];
  const numbers = [...new Set([...explicit, ...crossReferenced, ...searched.map((issue) => issue.number)])]
    .filter((number) => number !== pullRequest.number)
    .slice(0, 30);
  const issues = await Promise.all(
    numbers.map(async (number) => {
      const issue = await getIssue(number);

      if (issue.pull_request) return null;

      const issueComments = await getIssueComments(number);

      return {
        ...issueFields(issue),
        comments: issueComments.map((comment) => ({ body: comment.body ?? '', user: comment.user?.login ?? null })),
      };
    })
  );

  writeJson(join(outputDirectory, 'context.json'), {
    candidateIssues: issues.filter(Boolean),
    files: files.map((file) => ({ filename: file.filename, patch: file.patch ?? '', status: file.status })),
    pullRequest: pullRequestFields(pullRequest),
    pullRequestComments: comments.map((comment) => ({ body: comment.body ?? '', user: comment.user?.login ?? null })),
  });
}

async function prepareIssueToPr(outputDirectory) {
  const event = eventPayload();
  const issue = await getIssue(event.issue.number);
  const [comments, possiblePullRequests] = await Promise.all([
    getIssueComments(issue.number),
    searchIssues(`repo:${owner}/${repo} is:pr state:open ${issue.number}`, 30),
  ]);

  writeJson(join(outputDirectory, 'context.json'), {
    issue: {
      ...issueFields(issue),
      comments: comments.map((comment) => ({ body: comment.body ?? '', user: comment.user?.login ?? null })),
    },
    possiblePullRequests: possiblePullRequests.map((pullRequest) => ({
      body: pullRequest.body ?? '',
      htmlUrl: pullRequest.html_url,
      number: pullRequest.number,
      title: pullRequest.title,
    })),
  });
}

function runGh(arguments_, options = {}) {
  return execFileSync('gh', arguments_, {
    encoding: options.encoding ?? 'utf8',
    env: { ...process.env, GH_TOKEN: token },
    maxBuffer: options.maxBuffer ?? 50 * 1024 * 1024,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  });
}

async function associatedPullRequest(workflowRun) {
  const eventPullRequest = workflowRun.pull_requests?.[0];

  if (eventPullRequest?.number) return getPullRequest(eventPullRequest.number);

  const candidates = await request(`/repos/${owner}/${repo}/commits/${workflowRun.head_sha}/pulls`);

  return candidates[0] ? getPullRequest(candidates[0].number) : null;
}

async function prepareE2E(outputDirectory) {
  const event = eventPayload();
  const workflowRun = event.workflow_run;
  const pullRequest = await associatedPullRequest(workflowRun);
  const jobs = await paginate(`/repos/${owner}/${repo}/actions/runs/${workflowRun.id}/jobs?filter=latest`, 2);

  try {
    const logs = runGh(['run', 'view', String(workflowRun.id), '--repo', `${owner}/${repo}`, '--log-failed']);

    writeFileSync(join(outputDirectory, 'failed-jobs.log'), logs.slice(-8 * 1024 * 1024));
  } catch (error) {
    writeFileSync(join(outputDirectory, 'failed-jobs.log'), `Failed to download logs: ${error.message}\n`);
  }

  const artifactsDirectory = join(outputDirectory, 'artifacts');

  mkdirSync(artifactsDirectory, { recursive: true });
  try {
    runGh(['run', 'download', String(workflowRun.id), '--repo', `${owner}/${repo}`, '--dir', artifactsDirectory]);
  } catch (error) {
    writeFileSync(join(artifactsDirectory, 'DOWNLOAD_FAILED.txt'), `${error.message}\n`);
  }

  if (pullRequest) {
    const diff = await request(`/repos/${owner}/${repo}/pulls/${pullRequest.number}`, {
      accept: 'application/vnd.github.diff',
      format: 'buffer',
    });

    writeFileSync(join(outputDirectory, 'pull-request.diff'), diff);
  } else {
    writeFileSync(join(outputDirectory, 'pull-request.diff'), 'No associated pull request was found.\n');
  }

  writeJson(join(outputDirectory, 'context.json'), {
    jobs: jobs.map((job) => ({
      conclusion: job.conclusion,
      htmlUrl: job.html_url,
      name: job.name,
      steps: (job.steps ?? []).map((step) => ({ conclusion: step.conclusion, name: step.name })),
    })),
    pullRequest: pullRequest ? pullRequestFields(pullRequest) : null,
    workflowRun: {
      event: workflowRun.event,
      headBranch: workflowRun.head_branch,
      headSha: workflowRun.head_sha,
      htmlUrl: workflowRun.html_url,
      id: workflowRun.id,
    },
  });
}

async function prepareChangelog(outputDirectory) {
  const version = process.env.CHANGELOG_VERSION;
  const releaseUrl = process.env.RELEASE_URL;

  if (!/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(version ?? '')) fail('Invalid changelog version.');

  const changelogPath = `site/src/content/changelog/${version}.mdx`;
  const changelog = readFileSync(changelogPath, 'utf8');
  const numbers = referencedNumbers(changelog).slice(0, 100);
  const aliases = numbers.map(
    (number) => `pr${number}: pullRequest(number: ${number}) {
      number title body url
      closingIssuesReferences(first: 10) {
        nodes { number title body url parent { number title } }
      }
    }`
  );
  let pullRequests = [];

  if (aliases.length > 0) {
    const result = await request('/graphql', {
      body: {
        query: `query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) { ${aliases.join('\n')} }
        }`,
        variables: { owner, repo },
      },
      method: 'POST',
    });

    pullRequests = Object.values(result.data.repository).filter(Boolean);
  }

  writeJson(join(outputDirectory, 'context.json'), {
    changelogPath,
    pullRequests,
    releaseUrl,
    version,
  });
}

async function prepareStaleDocs(outputDirectory) {
  cpSync('/tmp/api-sync', join(outputDirectory, 'api-sync'), { recursive: true });
}

async function prepare(task, outputDirectory) {
  resetDirectory(outputDirectory);

  const handlers = {
    changelog: prepareChangelog,
    'e2e-main': prepareE2E,
    'e2e-pr': prepareE2E,
    'issue-sync': prepareIssueSync,
    'issue-to-pr': prepareIssueToPr,
    'issue-triage': prepareIssueTriage,
    'stale-docs': prepareStaleDocs,
  };

  const handler = handlers[task];

  if (!handler) fail(`Unknown prepare task: ${task}`);
  await handler(outputDirectory);
}

async function restoreCache(outputDirectory) {
  resetDirectory(outputDirectory);

  const cacheArtifact = process.env.CACHE_ARTIFACT;
  const fingerprint = process.env.CODEX_FINGERPRINT;
  const parameters = new URLSearchParams({ name: cacheArtifact, per_page: '100' });
  const response = await request(`/repos/${owner}/${repo}/actions/artifacts?${parameters}`);
  const artifact = response.artifacts
    .filter((candidate) => !candidate.expired && candidate.name === cacheArtifact)
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0];

  if (!artifact) {
    appendOutput('hit', 'false');
    return;
  }

  const archive = await request(artifact.archive_download_url, { format: 'buffer' });
  const archivePath = '/tmp/codex-cache.zip';

  writeFileSync(archivePath, archive);
  execFileSync('unzip', ['-q', archivePath, '-d', outputDirectory]);

  const manifestPath = join(outputDirectory, 'manifest.json');
  const outputPath = join(outputDirectory, 'output.json');

  if (!existsSync(manifestPath) || !existsSync(outputPath)) fail('Cached Codex artifact is incomplete.');

  const manifest = readJson(manifestPath);

  if (manifest.fingerprint !== fingerprint) fail('Cached Codex artifact fingerprint does not match.');

  JSON.parse(readFileSync(outputPath, 'utf8'));
  appendOutput('hit', 'true');
}

function resultData(task, inputDirectory, resultDirectory) {
  const manifest = readJson(join(resultDirectory, 'manifest.json'));

  if (manifest.task !== task) fail(`Result task mismatch: expected ${task}, received ${manifest.task}`);
  if (manifest.fingerprint !== process.env.CODEX_FINGERPRINT) fail('Result fingerprint mismatch.');

  return {
    context: readJson(join(inputDirectory, task === 'stale-docs' ? 'api-sync/pr-meta.json' : 'context.json')),
    fingerprint: manifest.fingerprint,
    output: readJson(join(resultDirectory, 'output.json')),
    patchPath: join(resultDirectory, 'changes.patch'),
  };
}

function assertString(value, name, options = {}) {
  if (typeof value !== 'string') fail(`${name} must be a string.`);
  if (!options.allowEmpty && value.trim() === '') fail(`${name} must not be empty.`);
  if (options.max && value.length > options.max) fail(`${name} exceeds ${options.max} characters.`);

  return value.trim();
}

function assertArray(value, name, max = 100) {
  if (!Array.isArray(value)) fail(`${name} must be an array.`);
  if (value.length > max) fail(`${name} exceeds ${max} entries.`);

  return value;
}

function conventionalTitle(value, fallback) {
  const title = typeof value === 'string' ? value.trim() : '';

  return /^(build|chore|ci|docs|feat|fix|perf|refactor|test)(\([a-z0-9-]+\))?!?: .+/.test(title) && title.length <= 200
    ? title
    : fallback;
}

function marker(kind, fingerprint, suffix = '') {
  return `<!-- codex:${kind}:${fingerprint}${suffix} -->`;
}

async function currentIssue(number) {
  return getIssue(number);
}

async function updateIssue(number, body) {
  return request(`/repos/${owner}/${repo}/issues/${number}`, { body, method: 'PATCH' });
}

async function createIssueComment(number, body) {
  return request(`/repos/${owner}/${repo}/issues/${number}/comments`, { body: { body }, method: 'POST' });
}

async function upsertIssueComment(number, markerText, body) {
  const comments = await getIssueComments(number);
  const existing = comments.find((comment) => (comment.body ?? '').includes(markerText));
  const markedBody = `${body.trim()}\n\n${markerText}`;

  if (existing) {
    return request(`/repos/${owner}/${repo}/issues/comments/${existing.id}`, {
      body: { body: markedBody },
      method: 'PATCH',
    });
  }

  return createIssueComment(number, markedBody);
}

async function findOpenIssueByMarkers(markers) {
  const issues = await paginate(`/repos/${owner}/${repo}/issues?state=open&sort=created&direction=desc`, 5);

  return issues.find((issue) => !issue.pull_request && markers.every((value) => (issue.body ?? '').includes(value))) ?? null;
}

async function findOpenPullRequestByMarkers(markers) {
  const pullRequests = await paginate(`/repos/${owner}/${repo}/pulls?state=open&sort=created&direction=desc`, 3);

  return pullRequests.find((pullRequest) => markers.every((value) => (pullRequest.body ?? '').includes(value))) ?? null;
}

async function assignIssue(number, login) {
  if (!login) return false;

  try {
    await request(`/repos/${owner}/${repo}/issues/${number}/assignees`, {
      body: { assignees: [login] },
      method: 'POST',
    });
    return true;
  } catch {
    return false;
  }
}

async function applyIssueTriage(data) {
  const { context, fingerprint, output } = data;
  const issueNumber = context.issue.number;
  const issue = await currentIssue(issueNumber);
  const availableLabels = new Set(context.labels.map((label) => label.name));
  const forbiddenLabels = new Set(['epic', 'P0', 'P1', 'P2', 'triage']);
  const nextLabels = new Set((issue.labels ?? []).map((label) => label.name));

  for (const label of assertArray(output.labelsToAdd, 'labelsToAdd', 20)) {
    if (availableLabels.has(label) && !forbiddenLabels.has(label)) nextLabels.add(label);
  }
  for (const label of assertArray(output.labelsToRemove, 'labelsToRemove', 20)) {
    if (availableLabels.has(label) && !forbiddenLabels.has(label)) nextLabels.delete(label);
  }

  const update = { labels: [...nextLabels] };

  if (output.title !== null && !context.issue.body.includes('<!-- e2e-failure -->')) {
    const title = assertString(output.title, 'title', { max: 256 });

    if (!/^(Feature|Bug|Docs|Architecture|Chore|Design): /.test(title)) fail('Triage title has an unsupported prefix.');
    if (issue.title === context.issue.title || issue.title === title) update.title = title;
  }

  await updateIssue(issueNumber, update);

  if (output.comment !== null) {
    await upsertIssueComment(
      issueNumber,
      marker('issue-triage', fingerprint),
      assertString(output.comment, 'comment', { max: 10000 })
    );
  }

  if (output.closeAsDuplicate) {
    const duplicateOf = Number(output.duplicateOf);
    const candidates = new Set(context.candidates.map((candidate) => candidate.number));

    if (!candidates.has(duplicateOf)) fail('Duplicate target was not present in staged candidates.');
    await updateIssue(issueNumber, { state: 'closed', state_reason: 'not_planned' });
  }
}

async function applyIssueSync(data) {
  const { context, fingerprint, output } = data;
  const candidates = new Map(context.candidateIssues.map((issue) => [issue.number, issue]));

  for (const [index, update] of assertArray(output.updates, 'updates', 30).entries()) {
    const stagedIssue = candidates.get(Number(update.issueNumber));

    if (!stagedIssue) fail(`Issue #${update.issueNumber} was not in the staged candidate set.`);

    const issue = await currentIssue(stagedIssue.number);
    const completedItems = assertArray(update.completedChecklistItems, 'completedChecklistItems', 50).map((item) =>
      assertString(item, 'completed checklist item', { max: 500 })
    );
    const stagedBody = stagedIssue.body ?? '';
    const desiredBody = completeChecklistItems(stagedBody, completedItems);
    const currentBody = issue.body ?? '';

    if (currentBody !== stagedBody && currentBody !== desiredBody) {
      console.warn(`Skipping #${issue.number}; its body changed after inputs were staged.`);
      continue;
    }

    const issueUpdate = {};

    if (currentBody !== desiredBody) issueUpdate.body = desiredBody;
    if (update.close && !/- \[ \]/.test(desiredBody) && issue.state !== 'closed') {
      issueUpdate.state = 'closed';
      issueUpdate.state_reason = 'completed';
    }
    if (Object.keys(issueUpdate).length > 0) await updateIssue(issue.number, issueUpdate);

    if (update.comment !== null) {
      await upsertIssueComment(
        issue.number,
        marker('issue-sync', fingerprint, `:${index}`),
        assertString(update.comment, 'comment', { max: 10000 })
      );
    }
  }
}

function completeChecklistItems(body, items) {
  let updatedBody = body;

  for (const text of items) {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(`(^|\\n)(\\s*- \\[ \\]\\s+)${escaped}(?=\\n|$)`);

    updatedBody = updatedBody.replace(
      expression,
      (_match, start, prefix) => `${start}${prefix.replace('[ ]', '[x]')}${text}`
    );
  }

  return updatedBody;
}

function applyPatch(task, data) {
  if (!existsSync(data.patchPath)) fail(`${task} did not produce a patch.`);
  if (statSync(data.patchPath).size === 0) fail(`${task} produced an empty patch.`);

  execFileSync('git', ['apply', '--check', data.patchPath], { stdio: 'inherit' });
  execFileSync('git', ['apply', data.patchPath], { stdio: 'inherit' });
  execFileSync('git', ['add', '-A', '--', '.']);

  const changedFiles = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);

  if (task === 'changelog') {
    const expected = `site/src/content/changelog/${data.context.version}.mdx`;

    if (changedFiles.length !== 1 || changedFiles[0] !== expected) fail(`Changelog patch may only change ${expected}.`);
  }

  if (task === 'e2e-main' && changedFiles.some((file) => !file.startsWith('apps/e2e/'))) {
    fail('E2E corrective patches may only change apps/e2e/.');
  }

  execFileSync('git', ['diff', '--cached', '--check'], { stdio: 'inherit' });
  return changedFiles;
}

function gitCommitAndPush(branch, commitMessage) {
  execFileSync('git', ['switch', '-c', branch], { stdio: 'inherit' });
  execFileSync('git', ['config', 'user.name', 'github-actions[bot]']);
  execFileSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  execFileSync('git', ['add', '-A']);
  execFileSync('git', ['commit', '-m', commitMessage], { stdio: 'inherit' });
  execFileSync('git', ['push', '--set-upstream', 'origin', branch], { stdio: 'inherit' });
}

async function createPullRequest({ assignee, base = 'main', body, branch, draft = true, title }) {
  const pullRequest = await request(`/repos/${owner}/${repo}/pulls`, {
    body: { base, body, draft, head: branch, title },
    method: 'POST',
  });
  const assigned = await assignIssue(pullRequest.number, assignee);

  return { assigned, pullRequest };
}

async function remoteBranchExists(branch) {
  const encodedBranch = branch
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

  return (await request(`/repos/${owner}/${repo}/git/ref/heads/${encodedBranch}`, { allow404: true })) !== null;
}

async function applyIssueToPr(data) {
  const { context, fingerprint, output } = data;
  const issue = context.issue;
  const resultMarker = marker('issue-to-pr', fingerprint);
  const existing = await findOpenPullRequestByMarkers([`<!-- codex-issue:${issue.number} -->`]);

  if (existing) {
    await upsertIssueComment(issue.number, resultMarker, `An existing implementation pull request already covers this issue: ${existing.html_url}`);
    return;
  }

  const current = await currentIssue(issue.number);

  if ((current.body ?? '') !== issue.body || current.title !== issue.title) {
    await upsertIssueComment(
      issue.number,
      resultMarker,
      'The issue changed while the implementation was being prepared, so no patch was published. Reapply `agent:pr` after reviewing the latest requirements.'
    );
    return;
  }

  if (output.status !== 'implemented') {
    await upsertIssueComment(
      issue.number,
      resultMarker,
      assertString(output.issueComment, 'issueComment', { max: 10000 })
    );
    return;
  }

  const branch = `codex/issue-${issue.number}-${fingerprint.slice(0, 12)}`;
  const commitMessage = conventionalTitle(output.commitMessage, `fix: resolve #${issue.number}`);
  const title = conventionalTitle(output.prTitle, commitMessage);
  const body = `${assertString(output.prBody, 'prBody', { max: 60000 })}\n\n<!-- codex-issue:${issue.number} -->\n${resultMarker}`;

  if (!(await remoteBranchExists(branch))) {
    applyPatch('issue-to-pr', data);
    gitCommitAndPush(branch, commitMessage);
  }

  const { pullRequest } = await createPullRequest({ body, branch, title });

  await upsertIssueComment(
    issue.number,
    resultMarker,
    `${assertString(output.issueComment, 'issueComment', { max: 10000 })}\n\nDraft PR: ${pullRequest.html_url}`
  );
}

function diagnosticTitle(output, pullRequestNumber) {
  const shortFailure = assertString(output.shortFailure, 'shortFailure', { max: 100 })
    .toLowerCase()
    .replace(/[^a-z0-9 ._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!shortFailure) fail('shortFailure must contain letters or numbers.');

  const prefix = {
    'expected change': 'test: update',
    inconclusive: 'chore(ci): investigate',
    'real regression': 'fix: resolve',
  }[output.classification];

  if (!prefix) fail('Unsupported E2E classification.');

  return `${prefix} ${shortFailure} from #${pullRequestNumber}`;
}

function diagnosticBody(data) {
  const { context, output } = data;
  const pullRequest = context.pullRequest;
  const list = (values) => assertArray(values, 'diagnostic list', 50).map((value) => `- ${assertString(value, 'diagnostic item', { max: 2000 })}`).join('\n');

  return `<!-- e2e-failure -->
<!-- trigger-pr:${pullRequest.number} -->

## Summary

${output.classification} (${output.confidence} confidence): ${assertString(output.summary, 'summary', { max: 5000 })}

## Triggering PR

[${pullRequest.title}](${pullRequest.htmlUrl})

## Failed run

- Run: ${context.workflowRun.htmlUrl}
- Head SHA: \`${context.workflowRun.headSha}\`
- Affected tests:
${list(output.affectedTests)}

## Evidence

${list(output.evidence)}

## Likely cause

${assertString(output.likelyCause, 'likelyCause', { max: 10000 })}

## Recommended actions

${list(output.recommendedActions)}`;
}

async function ensureDiagnosticIssue(data) {
  const pullRequest = data.context.pullRequest;
  const markers = ['<!-- e2e-failure -->', `<!-- trigger-pr:${pullRequest.number} -->`];
  let issue = await findOpenIssueByMarkers(markers);
  let assigned = true;

  if (!issue) {
    issue = await request(`/repos/${owner}/${repo}/issues`, {
      body: {
        body: diagnosticBody(data),
        title: diagnosticTitle(data.output, pullRequest.number),
      },
      method: 'POST',
    });
    assigned = await assignIssue(issue.number, pullRequest.author);
  }

  return { assigned, issue };
}

async function applyE2EPr(data) {
  const { context, output } = data;
  if (!context.pullRequest) fail('No pull request was staged for the failed E2E run.');

  const { assigned, issue } = await ensureDiagnosticIssue(data);
  const assignmentNote = assigned ? '' : ` Assignment to @${context.pullRequest.author} was not permitted.`;
  const comment = `${assertString(output.comment, 'comment', { max: 10000 })}\n\nTracking issue: ${issue.html_url}.${assignmentNote}`;

  await upsertIssueComment(
    context.pullRequest.number,
    `<!-- e2e-failure-triage:${context.workflowRun.id} -->`,
    comment
  );
}

async function upsertCommitComment(sha, markerText, body) {
  const comments = await paginate(`/repos/${owner}/${repo}/commits/${sha}/comments`, 2);
  const existing = comments.find((comment) => (comment.body ?? '').includes(markerText));
  const markedBody = `${body.trim()}\n\n${markerText}`;

  if (existing) {
    return request(`/repos/${owner}/${repo}/comments/${existing.id}`, { body: { body: markedBody }, method: 'PATCH' });
  }

  return request(`/repos/${owner}/${repo}/commits/${sha}/comments`, { body: { body: markedBody }, method: 'POST' });
}

async function applyE2EMain(data) {
  const { context, fingerprint, output } = data;
  if (!context.pullRequest) fail('No triggering pull request was staged for the failed main revision.');

  const commitMarker = `<!-- e2e-failure-triage:${context.workflowRun.id} -->`;
  const canFix = output.classification === 'expected change' && output.confidence === 'high' && existsSync(data.patchPath) && statSync(data.patchPath).size > 0;
  let disposition;

  if (canFix) {
    const markers = ['<!-- e2e-failure-fix -->', `<!-- trigger-pr:${context.pullRequest.number} -->`];
    let pullRequest = await findOpenPullRequestByMarkers(markers);
    let assigned = true;

    if (!pullRequest) {
      const title = diagnosticTitle(output, context.pullRequest.number);
      const branch = `test/e2e-failure-${context.workflowRun.id}-${fingerprint.slice(0, 8)}`;
      const body = `<!-- e2e-failure-fix -->
<!-- trigger-pr:${context.pullRequest.number} -->

${diagnosticBody(data)}

Related infrastructure tracking: #1932

CI provides validation for this corrective patch.`;

      if (!(await remoteBranchExists(branch))) {
        applyPatch('e2e-main', data);
        gitCommitAndPush(branch, title);
      }

      const created = await createPullRequest({
        assignee: context.pullRequest.author,
        body,
        branch,
        draft: true,
        title,
      });

      pullRequest = created.pullRequest;
      assigned = created.assigned;
    } else {
      assigned = await assignIssue(pullRequest.number, context.pullRequest.author);
    }

    disposition = `Corrective draft PR: ${pullRequest.html_url}.${assigned ? '' : ` Assignment to @${context.pullRequest.author} was not permitted.`}`;
  } else {
    const diagnostic = await ensureDiagnosticIssue(data);

    disposition = `Tracking issue: ${diagnostic.issue.html_url}.${diagnostic.assigned ? '' : ` Assignment to @${context.pullRequest.author} was not permitted.`}`;
  }

  await upsertCommitComment(
    context.workflowRun.headSha,
    commitMarker,
    `${assertString(output.comment, 'comment', { max: 10000 })}\n\n${disposition}`
  );
}

function markdownCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

async function applyStaleDocs(data) {
  const { context, output } = data;

  if (!output.stale) return;

  const triggerMarker = `<!-- trigger-pr:${context.number} -->`;
  const existing = await findOpenIssueByMarkers(['<!-- drift-type:stale-docs -->', triggerMarker]);

  if (existing) return;

  const findings = assertArray(output.findings, 'findings', 100);
  const sections = ['high', 'medium', 'low'].map((confidence) => {
    const rows = findings
      .filter((finding) => finding.confidence === confidence)
      .map(
        (finding) =>
          `| ${markdownCell(finding.file)} | ${markdownCell(finding.lines)} | ${markdownCell(finding.issue)} | ${markdownCell(finding.apiChange)} |`
      );

    return `### ${confidence[0].toUpperCase()}${confidence.slice(1)} Confidence
| File | Line(s) | Issue | API Change |
|---|---|---|---|
${rows.length > 0 ? rows.join('\n') : '| None found | | | |'}`;
  });
  const body = `<!-- drift-type:stale-docs -->
${triggerMarker}

## Summary

API changes in #${context.number} (${context.title}) may have made the following documentation stale.

## Triggering PR

${context.url}

## API Changes

${assertString(output.apiChanges, 'apiChanges', { max: 10000 })}

## Stale Documentation Found

${sections.join('\n\n')}

## Recommended Actions

${assertArray(output.recommendedActions, 'recommendedActions', 50)
  .map((action) => `- ${assertString(action, 'recommended action', { max: 2000 })}`)
  .join('\n')}`;
  const issue = await request(`/repos/${owner}/${repo}/issues`, {
    body: { body, labels: ['docs', 'site'], title: `docs(site): stale docs from #${context.number}` },
    method: 'POST',
  });

  await assignIssue(issue.number, context.author);
}

async function applyChangelog(data) {
  const { context, fingerprint, output } = data;

  if (output.status !== 'changed') return;

  const branch = `docs/changelog-prose-${context.version}`;
  const existing = await request(`/repos/${owner}/${repo}/pulls?state=open&head=${owner}:${encodeURIComponent(branch)}`);

  if (existing.length > 0) return;

  const commitMessage = `docs(site): add changelog prose for ${context.version}`;
  const title = conventionalTitle(output.prTitle, commitMessage);
  const body = `${assertString(output.prBody, 'prBody', { max: 60000 })}\n\nRelease: ${context.releaseUrl}\n\n${marker('changelog', fingerprint)}`;

  if (!(await remoteBranchExists(branch))) {
    applyPatch('changelog', data);
    gitCommitAndPush(branch, commitMessage);
  }

  await createPullRequest({ body, branch, draft: true, title });
}

async function verify(task, inputDirectory, resultDirectory) {
  const data = resultData(task, inputDirectory, resultDirectory);

  if (task === 'issue-to-pr' && data.output.status !== 'implemented') return;
  if (task === 'changelog' && data.output.status !== 'changed') return;
  if (
    task === 'e2e-main' &&
    !(data.output.classification === 'expected change' && data.output.confidence === 'high')
  ) {
    return;
  }

  applyPatch(task, data);
}

async function apply(task, inputDirectory, resultDirectory) {
  const data = resultData(task, inputDirectory, resultDirectory);
  const handlers = {
    changelog: applyChangelog,
    'e2e-main': applyE2EMain,
    'e2e-pr': applyE2EPr,
    'issue-sync': applyIssueSync,
    'issue-to-pr': applyIssueToPr,
    'issue-triage': applyIssueTriage,
    'stale-docs': applyStaleDocs,
  };
  const handler = handlers[task];

  if (!handler) fail(`Unknown apply task: ${task}`);
  await handler(data);
}

async function main() {
  const [command, taskOrOutput, inputOrResult, maybeResult] = process.argv.slice(2);

  if (command === 'prepare') await prepare(taskOrOutput, resolve(inputOrResult));
  else if (command === 'restore-cache') await restoreCache(resolve(taskOrOutput));
  else if (command === 'verify') await verify(taskOrOutput, resolve(inputOrResult), resolve(maybeResult));
  else if (command === 'apply') await apply(taskOrOutput, resolve(inputOrResult), resolve(maybeResult));
  else fail(`Unknown command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  }
}

export { completeChecklistItems, conventionalTitle, diagnosticTitle, referencedNumbers, usefulSearchTerms };
