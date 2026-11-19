import { expect, test } from "@playwright/test";
import { BASE } from "./helpers";

// Phase 7a: "Your albums on this device" (lib/myAlbums.ts, lib/albumActions.ts).

test.skip(!BASE, "set E2E_BASE_URL to run end-to-end tests");

test("albums opened as host are listed on the home page, checked by the server", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/`);
  await expect(page.getByRole("heading", { name: "Your albums" }), "nothing saved yet").toHaveCount(0);

  const name = `My album ${Date.now()}`;
  await page.getByPlaceholder("Sam & Alex's Wedding").fill(name);
  await page.getByRole("button", { name: "Create event" }).click();
  await page.waitForURL(/\/host\/.+\?t=/);
  const hostUrl = page.url();
  // Saved once the host page has started up in the browser.
  await expect.poll(() => page.evaluate(() => localStorage.getItem("snap-my-albums") ?? "")).toContain(name);

  await page.goto(`${BASE}/`);
  await expect(page.getByRole("heading", { name: "Your albums" })).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row.getByText("Live")).toBeVisible();
  await expect(row.getByText("0 photos")).toBeVisible();
  await row.getByRole("link", { name }).click();
  await expect(page).toHaveURL(hostUrl);

  // A saved entry whose token is wrong is never shown as usable.
  await page.goto(`${BASE}/`);
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem("snap-my-albums") ?? "[]");
    list.push({ id: "00000000-0000-4000-8000-000000000001", token: "00000000-0000-4000-8000-0000000000ff", name: "Not mine", savedAt: 0 });
    localStorage.setItem("snap-my-albums", JSON.stringify(list));
  });
  await page.reload();
  const forged = page.getByRole("listitem").filter({ hasText: "Not mine" });
  await expect(forged.getByText("No longer available")).toBeVisible();
  await expect(forged.getByRole("link")).toHaveCount(0);

  // Remove from list (the album itself stays).
  await row.getByRole("button", { name: `Remove ${name} from this list` }).click();
  await row.getByRole("button", { name: "Remove from list" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: name })).toHaveCount(0);
  await page.goto(hostUrl);
  await expect(page.getByText(name).first()).toBeVisible();
});
