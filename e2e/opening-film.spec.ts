import { expect, test } from '@playwright/test';

// 設定の storageState は「見終えた状態」なので、ここだけ初回訪問として始める
test.use({ storageState: { cookies: [], origins: [] } });

test('初回だけオープニング動画を流し、スキップ後は再訪しても出さない', async ({ page }) => {
  await page.goto('/');
  const film = page.getByRole('dialog', { name: 'ウラメクのオープニング' });
  await expect(film).toBeVisible();
  await expect(film.getByRole('button', { name: '動画をスキップ' })).toBeFocused();
  await film.getByRole('button', { name: '動画をスキップ' }).click();
  await expect(film).toBeHidden();
  await expect(page.getByRole('button', { name: '調査をはじめる' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '調査をはじめる' })).toBeVisible();
  await expect(film).toBeHidden();
});
