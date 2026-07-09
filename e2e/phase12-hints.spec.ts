import { test, expect, type Page } from "@playwright/test";
import mongoose from "mongoose";
import { seedLiveEvent, QA_EMAIL, QA_PASSWORD, type SeededLiveEvent } from "./seedLiveEvent";

function watch(page: Page, label: string) {
  page.on("pageerror", (err) => {
    throw new Error(`[${label}] Uncaught page error: ${err.message}`);
  });
}

let seed: SeededLiveEvent;

test.describe.serial("Phase 12: hint power-card request/approve/reject lifecycle", () => {
  test.setTimeout(90_000);
  let host: Page;
  let p1: Page;

  test.beforeAll(async ({ browser }) => {
    seed = await seedLiveEvent();
    const db = mongoose.connection.db!;
    // Grant Team A one Hint and one Shield card (mirrors a prior store purchase / host grant).
    await db.collection("teampowercards").insertMany([
      { teamId: seed.teamAId, powerCardId: seed.powerCardIds["Hint"], remainingUses: 1, status: "AVAILABLE", createdAt: new Date(), updatedAt: new Date() },
      { teamId: seed.teamAId, powerCardId: seed.powerCardIds["Shield"], remainingUses: 1, status: "AVAILABLE", createdAt: new Date(), updatedAt: new Date() },
    ]);

    const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    host = await hostCtx.newPage();
    watch(host, "host");
    const p1Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    p1 = await p1Ctx.newPage();
    watch(p1, "p1");
  });

  test.afterAll(async () => {
    await host?.context().close();
    await p1?.context().close();
    await mongoose.disconnect().catch(() => {});
  });

  test("setup: login, join, advance to question", async () => {
    await host.goto("/admin");
    await host.getByLabel(/email or username/i).fill(QA_EMAIL);
    await host.getByLabel("Password").fill(QA_PASSWORD);
    await host.getByRole("button", { name: "Sign in" }).click();
    await expect(host.getByText(/good (morning|afternoon|evening)/i)).toBeVisible({ timeout: 60_000 });

    await host.goto(`/host/${seed.roomId}`);
    await expect(host.getByText("Main Room", { exact: true }).first()).toBeVisible({ timeout: 60_000 });

    await p1.goto(`/play/${seed.roomCode}`);
    await p1.getByPlaceholder("Moksh").fill("Amit");
    await p1.locator("button", { hasText: "Team A" }).click();
    await p1.getByRole("button", { name: "Join room" }).click();
    await expect(p1.getByText("You're in, Amit!", { exact: true })).toBeVisible({ timeout: 30_000 });

    await host.getByRole("button", { name: "Next", exact: true }).click();
    await host.getByRole("button", { name: "Next", exact: true }).click();
    await expect(host.getByText("Current Question", { exact: true })).toBeVisible({ timeout: 30_000 });
  });

  test("Phase 12a: participant requests Hint -> host sees request", async () => {
    await expect(p1.getByText("Hint", { exact: true })).toBeVisible({ timeout: 20_000 });
    await p1.locator("button", { hasText: "Hint" }).click();

    await expect(async () => {
      await host.reload();
      const text = await host.locator("body").innerText();
      expect(text).toContain("Power Requests");
      expect(text).toContain("Approve");
    }).toPass({ timeout: 30_000 });
  });

  test("Phase 12b: host approves, activates, and consumes the request", async () => {
    await host.getByRole("button", { name: "Approve" }).click();
    await expect(host.getByRole("button", { name: "Activate" })).toBeVisible({ timeout: 20_000 });
    await host.getByRole("button", { name: "Activate" }).click();
    await expect(host.getByRole("button", { name: "Mark Consumed" })).toBeVisible({ timeout: 20_000 });
    await host.getByRole("button", { name: "Mark Consumed" }).click();

    await expect(async () => {
      const db = mongoose.connection.db!;
      const owned = await db.collection("teampowercards").findOne({ teamId: seed.teamAId, powerCardId: seed.powerCardIds["Hint"] });
      expect(owned?.status).toBe("CONSUMED");
      expect(owned?.remainingUses).toBe(0);
    }).toPass({ timeout: 20_000 });
  });

  test("Phase 12c: reject flow — Shield request returns to AVAILABLE", async () => {
    await p1.reload();
    const shieldButton = p1.locator("button", { hasText: "Shield" });
    await expect(shieldButton).toBeVisible({ timeout: 20_000 });
    await shieldButton.click();

    await expect(async () => {
      await host.reload();
      const text = await host.locator("body").innerText();
      expect(text).toContain("Reject");
    }).toPass({ timeout: 30_000 });
    await host.getByRole("button", { name: "Reject" }).click();

    await expect(async () => {
      const db = mongoose.connection.db!;
      const owned = await db.collection("teampowercards").findOne({ teamId: seed.teamAId, powerCardId: seed.powerCardIds["Shield"] });
      expect(owned?.status).toBe("AVAILABLE");
      expect(owned?.remainingUses).toBe(1);
    }).toPass({ timeout: 20_000 });
  });
});
