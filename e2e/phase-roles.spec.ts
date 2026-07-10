import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import mongoose from "mongoose";
import { seedLiveEvent, QA_EMAIL, QA_PASSWORD, type SeededLiveEvent } from "./seedLiveEvent";

function watch(page: Page, label: string) {
  page.on("pageerror", (err) => {
    throw new Error(`[${label}] Uncaught page error: ${err.message}`);
  });
}

let seed: SeededLiveEvent;

test.describe.serial("Team Device Roles: captain / vice captain / member", () => {
  test.setTimeout(120_000);
  let host: Page;
  let p1Ctx: BrowserContext; // Amit — first phone, auto-captain
  let p1: Page;
  let p2: Page; // Jay — second phone, vice captain
  let p3: Page; // Rahul — third phone, member

  test.beforeAll(async ({ browser }) => {
    seed = await seedLiveEvent();
    const db = mongoose.connection.db!;
    // Team A owns a Hint card so the Powers drawer has inventory to gate.
    await db.collection("teampowercards").insertOne({
      teamId: seed.teamAId,
      powerCardId: seed.powerCardIds["Hint"],
      remainingUses: 2,
      status: "AVAILABLE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    host = await hostCtx.newPage();
    watch(host, "host");
    p1Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    p1 = await p1Ctx.newPage();
    watch(p1, "p1");
    const p2Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    p2 = await p2Ctx.newPage();
    watch(p2, "p2");
    const p3Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    p3 = await p3Ctx.newPage();
    watch(p3, "p3");
  });

  test.afterAll(async () => {
    await host?.context().close();
    await p1Ctx?.close().catch(() => {});
    await p2?.context().close();
    await p3?.context().close();
    await mongoose.disconnect().catch(() => {});
  });

  async function join(page: Page, name: string) {
    await page.goto(`/play/${seed.roomCode}`);
    await page.getByPlaceholder("Moksh").fill(name);
    await page.locator("button", { hasText: "Team A" }).click();
    await page.getByRole("button", { name: "Join room" }).click();
    await expect(page.getByText(`You're in, ${name}!`, { exact: true })).toBeVisible({ timeout: 30_000 });
  }

  test("setup: host login + console open", async () => {
    await host.goto("/admin");
    await host.getByLabel(/email or username/i).fill(QA_EMAIL);
    await host.getByLabel("Password").fill(QA_PASSWORD);
    await host.getByRole("button", { name: "Sign in" }).click();
    await expect(host.getByText(/good (morning|afternoon|evening)/i)).toBeVisible({ timeout: 60_000 });
    await host.goto(`/host/${seed.roomId}`);
    await expect(host.getByText("Main Room", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  });

  test("R1: first phone auto-becomes Captain", async () => {
    await join(p1, "Amit");
    await expect(p1.getByText("👑 Captain", { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("R2: second phone auto-becomes Vice Captain", async () => {
    await join(p2, "Jay");
    await expect(p2.getByText("⭐ Vice Captain", { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("R3: third phone auto-becomes Member", async () => {
    await join(p3, "Rahul");
    await expect(p3.getByText("👤 Member", { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("R4: member sees inventory but cannot activate powers", async () => {
    await p3.getByRole("button", { name: /⚡ Powers/ }).click();
    await expect(p3.getByText(/Only the captain can activate/)).toBeVisible({ timeout: 10_000 });
    await expect(p3.getByRole("button", { name: "Use Power" })).toHaveCount(0);
    await p3.getByRole("button", { name: "Close" }).click();
  });

  test("R5: captain can request a power; host receives it", async () => {
    // Cards can only be played while a question is live (server-enforced) —
    // advance WELCOME -> ROUND_INTRO -> QUESTION before using one.
    await host.getByRole("button", { name: "Next", exact: true }).click();
    await host.getByRole("button", { name: "Next", exact: true }).click();
    await expect(host.getByText("Current Question", { exact: true })).toBeVisible({ timeout: 30_000 });

    await p1.getByRole("button", { name: /⚡ Powers/ }).click();
    const useButton = p1.getByRole("button", { name: "Use Power" });
    await expect(useButton).toBeVisible({ timeout: 10_000 });
    await useButton.click();
    await expect(p1.getByRole("button", { name: "Pending" })).toBeVisible({ timeout: 20_000 });
    await p1.getByRole("button", { name: "Close" }).click();

    await expect(async () => {
      await host.reload();
      const text = await host.locator("body").innerText();
      expect(text).toContain("Approve");
    }).toPass({ timeout: 60_000 });
  });

  test("R6: captain disconnects — vice captain becomes temporary captain", async () => {
    // Close the captain's phone, then age its heartbeat past the connected
    // window so the test doesn't sit through the real 15s timeout.
    await p1Ctx.close();
    const db = mongoose.connection.db!;
    await db.collection("participants").updateOne(
      { teamId: seed.teamAId, name: "Amit" },
      { $set: { lastSeenAt: new Date(Date.now() - 60_000) } }
    );

    await expect(p2.getByText(/you are temporary captain/i)).toBeVisible({ timeout: 20_000 });
    await expect(p2.getByText("👑 Temp Captain", { exact: true })).toBeVisible({ timeout: 10_000 });
    // Members see the captain-down notice too.
    await expect(p3.getByText(/Captain.*disconnected/i).first()).toBeVisible({ timeout: 10_000 });

    // The acting captain now gets the activate control (the Hint request from
    // R5 is still pending host approval, so the button reads "Pending" — the
    // point is a member would see the "Only captain" note instead of a button).
    await p2.getByRole("button", { name: /⚡ Powers/ }).click();
    await expect(p2.getByRole("button", { name: /Use Power|Pending/ })).toBeVisible({ timeout: 10_000 });
    await expect(p2.getByText(/Only the captain can activate/)).toHaveCount(0);
    await p2.getByRole("button", { name: "Close" }).click();
  });

  test("R7: host reassigns the captaincy from the console", async () => {
    await host.reload();
    await host.getByRole("button", { name: /Team A/ }).first().click();
    await expect(host.getByText("CONNECTED DEVICES", { exact: true })).toBeVisible({ timeout: 20_000 });

    // Click "Make Captain" on Jay's device row (Amit is offline, Rahul is a member).
    const jayDeviceRow = host
      .locator("div.flex.items-center.gap-2", { hasText: "Jay" })
      .filter({ has: host.getByRole("button", { name: "Make Captain" }) })
      .first();
    await jayDeviceRow.getByRole("button", { name: "Make Captain" }).click();

    // Jay's phone flips from acting to full captain.
    await expect(p2.getByText("👑 Captain", { exact: true })).toBeVisible({ timeout: 20_000 });
    // The change is announced on the phones' live feed.
    await expect(p3.getByText(/Jay is now team captain/).first()).toBeVisible({ timeout: 20_000 });
  });

  test("R8: leaderboard opens as a modal from the bottom bar", async () => {
    await p2.getByRole("button", { name: /🏆 Leaderboard/ }).click();
    await expect(p2.getByText("YOU", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(p2.getByText("Team B", { exact: true })).toBeVisible();
    await p2.getByRole("button", { name: "Close" }).click();
  });

  test("R9: store button appears only when host opens the store; member can't buy", async () => {
    await expect(p2.getByRole("button", { name: /🛒 Store/ })).toHaveCount(0);

    await host.getByRole("button", { name: "Power Store", exact: true }).click();
    await expect(p2.getByRole("button", { name: /🛒 Store/ })).toBeVisible({ timeout: 20_000 });

    // Member view: sees the store, cannot buy.
    await p3.getByRole("button", { name: /🛒 Store/ }).click();
    await expect(p3.getByText(/Only the captain can buy/)).toBeVisible({ timeout: 10_000 });
    await p3.getByRole("button", { name: "Close" }).click();
  });

  test("R10: captain-submit answer mode — captain submits, host sees it", async () => {
    const db = mongoose.connection.db!;
    await db.collection("rooms").updateOne(
      { _id: seed.roomId },
      { $set: { "settings.answerMode": "CAPTAIN_SUBMIT" } }
    );

    // R5 already advanced to Q1 — two more steps land on Q2 (via A1), still a
    // live question, which is what captain-submit needs.
    await host.getByRole("button", { name: "Next", exact: true }).click();
    await host.getByRole("button", { name: "Next", exact: true }).click();
    await expect(host.getByText("Current Question", { exact: true })).toBeVisible({ timeout: 30_000 });

    // Member sees the "captain submits" note, no input.
    await expect(p3.getByText(/the captain submits the answer/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(p3.getByPlaceholder(/Type your team's answer/)).toHaveCount(0);

    // Captain types and submits.
    const input = p2.getByPlaceholder(/Type your team's answer/);
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.fill("Option A");
    await p2.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(p2.getByText("TEAM ANSWER SUBMITTED", { exact: true })).toBeVisible({ timeout: 60_000 });

    // Host sees the written answer next to the current question.
    await expect(async () => {
      await host.reload();
      const text = await host.locator("body").innerText();
      expect(text).toContain("SUBMITTED ANSWERS");
      expect(text).toContain("Option A");
    }).toPass({ timeout: 60_000 });
  });
});
