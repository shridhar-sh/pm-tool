// Requires a disposable local MongoDB: MONGO_URL=mongodb://127.0.0.1:27019
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  assert(process.env.MONGO_URL, 'Set MONGO_URL to a local test MongoDB');
  const base = 'http://127.0.0.1:8019';
  const server = spawn(process.env.PYTHON || 'python', ['-m', 'uvicorn', 'backend.tests.browser_app:app', '--port', '8019'], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, DB_NAME: process.env.DB_NAME || 'pm_browser_test' },
    stdio: 'ignore',
  });
  let browser;
  const errors = [];
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { ready = (await fetch(`${base}/api/`)).ok; } catch {}
      if (ready) break;
      await new Promise(r => setTimeout(r, 100));
    }
    assert(ready, 'Test API must start');
    async function api(url, method = 'GET', body) {
      const response = await fetch(`${base}/api${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      assert(response.ok, `${method} ${url}: ${response.status}`);
      return response.json();
    }
    const project = await api('/projects', 'POST', {
      name: 'Browser Test Film', client: 'Test client', sow: 'Film', csDoneBy: 'CS',
      projectStartDate: '2026-11-04', projectEndDate: '2026-11-30', statusCategory: 'yet_to_start',
      assignedAM: 'Maya Mahadevan', assignedLP: 'Mohammed Burhan', pod: 'POD 1',
    });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    await page.getByTestId('login-email-input').fill('pm@agency.com');
    await page.getByTestId('login-password-input').fill('demo123');
    await page.getByTestId('login-submit-button').click();
    await page.goto(`${base}/project/${project.id}`);
    await page.getByRole('heading', { name: project.name, exact: true }).waitFor();
    await page.getByTestId('add-task-button').click();
    await page.getByTestId('task-title-input').fill('Prepare first cut');
    await page.getByTestId('assigned-to-input').fill('Shridhar Bahubali S');
    await page.getByTestId('due-date-input').fill('2026-11-12');
    await page.getByTestId('save-task-button').click();
    await page.getByRole('heading', { name: 'Prepare first cut', exact: true }).waitFor();
    const task = (await api(`/tasks/project/${project.id}`))[0];
    await page.goto(`${base}/my-tasks`);
    await page.getByTestId(`task-checkbox-${task.id}`).click();
    await page.waitForFunction(async id => (await (await fetch(`/api/tasks/project/${id}`)).json())[0].completed, project.id);
    await page.reload();
    await page.getByTestId(`task-checkbox-${task.id}`).waitFor();
    assert.equal(await page.getByTestId(`task-checkbox-${task.id}`).getAttribute('data-state'), 'checked');
    await page.goto(`${base}/project/${project.id}`);
    await page.getByTestId(`task-item-${task.id}`).locator('svg.text-green-600').waitFor();
    await page.getByTestId('approvals-tab').click();
    await page.getByTestId('request-approval-button').click();
    await page.getByTestId('approval-title-input').fill('Approve first cut');
    await page.getByTestId('approver-input').fill('Shridhar Bahubali S');
    await page.getByTestId('save-approval-button').click();
    await page.getByRole('heading', { name: 'Approve first cut', exact: true }).waitFor();
    const approval = (await api(`/approvals/project/${project.id}`))[0];
    await page.getByTestId(`approve-button-${approval.id}`).click();
    await page.getByTestId(`approval-item-${approval.id}`).getByText('approved', { exact: true }).waitFor();
    await page.reload();
    await page.getByTestId('approvals-tab').click();
    await page.getByTestId(`approval-item-${approval.id}`).getByText('approved', { exact: true }).waitFor();
    await page.goto(`${base}/am-tracker`);
    await page.getByTestId(`checkbox-${project.id}-0`).click();
    await page.waitForFunction(async id => (await (await fetch(`/api/projects/${id}`)).json()).statusCategory === 'strategy', project.id);
    await page.goto(`${base}/project/${project.id}`);
    await page.getByTestId('status-button-strategy').waitFor();
    assert((await page.getByTestId('status-button-strategy').getAttribute('class')).includes('bg-slate-900'));
    await page.goto(`${base}/timelines/${project.id}`);
    await page.getByTestId('stage-duration-0').fill('2');
    await page.waitForFunction(async id => (await (await fetch(`/api/projects/${id}`)).json()).workflowStages[0].duration === 2, project.id);
    await page.getByTestId('cell-0-0').click();
    await page.waitForFunction(async id => (await (await fetch(`/api/projects/${id}`)).json()).extraDayMarkers['2026-11-04'], project.id);
    await page.getByTestId('cell-0-3').click();
    await page.waitForFunction(async id => (await (await fetch(`/api/projects/${id}`)).json()).workingDays['2026-11-07'], project.id);
    await page.getByTestId('stage-overlap-1').fill('-1');
    await page.waitForFunction(async id => (await (await fetch(`/api/projects/${id}`)).json()).stageOverlaps['1'] === -1, project.id);
    await page.reload();
    await page.getByTestId('cell-0-0').getByText('E', { exact: true }).waitFor();
    await page.getByTestId('cell-0-3').getByText('W', { exact: true }).waitFor();
    assert.equal(await page.getByTestId('stage-overlap-1').inputValue(), '-1');
    await page.goto(`${base}/project/${project.id}`);
    await page.getByRole('heading', { name: project.name, exact: true }).waitFor();
    // A changed record from another session is picked up on returning to the tab.
    await api(`/projects/${project.id}`, 'PATCH', { name: 'Updated in another session' });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('heading', { name: 'Updated in another session', exact: true }).waitFor();
    await api('/team-members/bulk', 'POST', { members: [
      { employeeId: 'browser-am', name: 'Maya Mahadevan', shortName: 'MM', role: 'Account Manager', department: 'accounts' },
      { employeeId: 'browser-lp', name: 'Mohammed Burhan', shortName: 'MB', role: 'Line Producer', department: 'production' },
    ] });
    await api(`/projects/${project.id}`, 'PATCH', { assignedAM: 'MM', assignedLP: 'MB' });
    for (const [name, role] of [['Maya Mahadevan', 'account_manager'], ['Mohammed Burhan', 'line_producer']]) {
      await page.evaluate(user => localStorage.setItem('user', JSON.stringify(user)), { name, role });
      await page.goto(base);
      await page.getByTestId(`project-item-${project.id}`).waitFor();
    }
    assert.deepEqual(errors, []);
    await api(`/projects/${project.id}`, 'DELETE');
    console.log('Browser workflows passed: task creation/completion/reload, approval/reload, stage status, E/W/overlap persistence, returning-tab refresh, AM/LP short names; no JS errors.');
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
