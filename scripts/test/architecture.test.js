import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'espree';
const project = new URL('../..', import.meta.url).pathname;
function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(join(directory, entry.name))
      : /\.(js|jsx)$/.test(entry.name)
        ? [join(directory, entry.name)]
        : [],
  );
}
function visit(node, action) {
  if (!node || typeof node !== 'object') return;
  action(node);
  for (const value of Object.values(node))
    if (Array.isArray(value)) value.forEach((child) => visit(child, action));
    else if (value && typeof value === 'object') visit(value, action);
}
function tierExpression(node) {
  return (
    node &&
    ((node.type === 'Identifier' && /^(tier|subscription|subscriptionConfig)$/.test(node.name)) ||
      (node.type === 'MemberExpression' &&
        /^(tier|subscription|subscriptionConfig)$/.test(
          node.property?.name || node.property?.value,
        )))
  );
}
test('routes, controllers and React contain no direct tier comparisons or subscription assignment checks', () => {
  const violations = [];
  for (const directory of [
    'unfazed-backend/src/routes',
    'unfazed-backend/src/controllers',
    'unfazed-frontend/src',
  ]) {
    for (const path of sourceFiles(join(project, directory))) {
      const tree = parse(readFileSync(path, 'utf8'), {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      });
      visit(tree, (node) => {
        if (
          node.type === 'BinaryExpression' &&
          (tierExpression(node.left) || tierExpression(node.right))
        )
          violations.push(path);
      });
      assert.ok(
        !readFileSync(path, 'utf8').includes('subscriptionConfig'),
        `Subscription assignment outside the service/model: ${path}`,
      );
    }
  }
  assert.deepEqual(violations, []);
});
test('frontend sources never reference Razorpay server secrets', () => {
  for (const path of sourceFiles(join(project, 'unfazed-frontend/src')))
    assert.doesNotMatch(readFileSync(path, 'utf8'), /RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET/);
});
