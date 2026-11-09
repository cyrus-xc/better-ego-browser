// Imported only by the installed official ego-browser runtime.
export async function dispatch(request) {
  if (typeof taskSpace !== 'function') throw new Error('Official ego browser helpers unavailable');
  const { action } = request;
  if (action === 'spaces') {
    return { source:'official-space-summary', coverage:'recent-tab-titles', spaces:await listTaskSpaces() };
  }
  if (action === 'create') {
    const task = await taskSpace(request.name);
    return { spaceId: task.spaceId, page: 'p1' };
  }
  const task = await taskSpace(request.spaceId);
  if (action === 'finish') { await task.finish({ keep: [] }); return { finished: true }; }
  const page = task.page('p1');
  if (action === 'navigate') await page.goto(request.url);
  else if (action === 'click') await page.click(request.selector, { label: 'perform requested browser action' });
  else if (action === 'fill') await page.fill(request.selector, request.text);
  else if (action === 'screenshot') return { path: await page.screenshot({ path: request.artifactPath }) };
  else if (action !== 'snapshot') throw new Error('Unsupported browser operation');
  return { spaceId: task.spaceId, title: await page.title(), url: await page.url(), snapshot: await page.snapshot() };
}
