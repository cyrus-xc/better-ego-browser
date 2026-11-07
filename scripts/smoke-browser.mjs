import assert from 'node:assert/strict';
import { browserTools, resolveCli } from '../src/browser.mjs';

const tools = browserTools(await resolveCli());
const guide = await tools[0].call({});
assert.ok(!guide.isError, 'Official guide must be complete');
const result = await tools[1].call({ code: `
const task = await taskSpace('DSH official CLI verification 20261108');
console.log({ spaceId: task.spaceId });
const page = task.page('p1');
await page.goto('about:blank');
const value = await page.evaluate(() => ({ url: location.href, unicode: '官方浏览器验证' }));
console.log(JSON.stringify(value));
console.log(await page.snapshot());
await task.finish({ keep: [] });
` });
assert.ok(!result.isError, JSON.stringify(result));
assert.ok(result.content.some(block => block.text.includes('官方浏览器验证')));
console.log(result.content.map(block => block.text).join('\n'));
console.log('Official browser CLI smoke test passed.');
