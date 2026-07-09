import fs from "node:fs";
import mongoose from "mongoose";
import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const QA_EMAIL = "qa.playwright@encore.local";
const QA_PASSWORD = "QaPlaywright@123";
const COMPETITION_TITLE = "Test Jain Event 2026";
const ROOM_NAME = "Main Room";

/** PHASE 1: clean-database test — wipes all prior data owned by the QA
 * account so every run starts from a known-empty state. Never touches other
 * accounts' data (all queries are scoped by ownerId). */
async function resetQaData() {
  const env = fs.readFileSync(".env.local", "utf8");
  const uri = env.match(/MONGODB_URI="?([^"\n]+)"?/)?.[1];
  if (!uri) throw new Error("MONGODB_URI missing");

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db!;
  const owner = await db.collection("users").findOne({ email: QA_EMAIL });
  if (!owner) {
    await mongoose.disconnect();
    return;
  }
  const ownerId = owner._id;

  const competitions = await db.collection("competitions").find({ ownerId }).project({ _id: 1 }).toArray();
  const competitionIds = competitions.map((c) => c._id);
  const rooms = await db.collection("rooms").find({ competitionId: { $in: competitionIds } }).project({ _id: 1 }).toArray();
  const roomIds = rooms.map((r) => r._id);
  const teams = await db.collection("teams").find({ roomId: { $in: roomIds } }).project({ _id: 1 }).toArray();
  const teamIds = teams.map((t) => t._id);

  await Promise.all([
    db.collection("scenes").deleteMany({ roomId: { $in: roomIds } }),
    db.collection("participants").deleteMany({ roomId: { $in: roomIds } }),
    db.collection("teampowercards").deleteMany({ teamId: { $in: teamIds } }),
    db.collection("powercardrequests").deleteMany({ roomId: { $in: roomIds } }),
    db.collection("cointransactions").deleteMany({ roomId: { $in: roomIds } }),
    db.collection("scoretransactions").deleteMany({ roomId: { $in: roomIds } }),
    db.collection("eventlogs").deleteMany({ roomId: { $in: roomIds } }),
    db.collection("teams").deleteMany({ roomId: { $in: roomIds } }),
    db.collection("rooms").deleteMany({ competitionId: { $in: competitionIds } }),
    db.collection("competitions").deleteMany({ ownerId }),
    db.collection("questions").deleteMany({ ownerId }),
    db.collection("rounds").deleteMany({ ownerId }),
    db.collection("powercards").deleteMany({ ownerId }),
  ]);

  await mongoose.disconnect();
}

/** Scopes a click to the question-type picker grid, since the same label
 * text (e.g. "Text") can also appear as a type badge on existing question
 * cards behind the modal. */
async function pickQuestionType(host: Page, label: string) {
  const typeGrid = host.locator("div.px-6.py-6.grid");
  await typeGrid.getByText(label, { exact: true }).click();
}

/** Fails the test on any uncaught page error; logs console errors, per BUG FIX RULE. */
function watchForErrors(page: Page, label: string) {
  page.on("pageerror", (err) => {
    throw new Error(`[${label}] Uncaught page error: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // eslint-disable-next-line no-console
      console.log(`[${label}] console.error: ${msg.text().slice(0, 300)}`);
    }
  });
  page.on("requestfinished", async (req) => {
    if (req.url().includes("/api/live/")) {
      const res = await req.response();
      const timing = req.timing();
      // eslint-disable-next-line no-console
      console.log(`[${label}] /api/live -> ${res?.status()} in ${timing.responseEnd.toFixed(0)}ms`);
    }
  });
  page.on("requestfailed", (req) => {
    if (req.url().includes("/api/live/")) {
      // eslint-disable-next-line no-console
      console.log(`[${label}] /api/live FAILED: ${req.failure()?.errorText}`);
    }
  });
}

let competitionId = "";
let roomId = "";
let roomCode = "";

test.describe.serial("Encore full event lifecycle", () => {
  let hostContext: BrowserContext;
  let host: Page;
  // Participant contexts — created lazily in Phase 7 (not needed before then).
  // Mobile viewport doubles as the RESPONSIVE TEST's "participant: mobile size" check.
  let p1Context: BrowserContext;
  let p1: Page;
  let p2Context: BrowserContext;
  let p2: Page;

  test.beforeAll(async ({ browser }) => {
    await resetQaData();
    hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    host = await hostContext.newPage();
    watchForErrors(host, "host");
  });

  test.afterAll(async () => {
    await hostContext?.close();
    await p1Context?.close();
    await p2Context?.close();
    // eslint-disable-next-line no-console
    console.log("CAPTURED IDS:", JSON.stringify({ competitionId, roomId, roomCode }));
  });

  test("Phase 0: host can log in", async () => {
    await host.goto("/admin");
    await expect(host.getByText("Admin login", { exact: true })).toBeVisible();
    await host.getByLabel(/email or username/i).fill(QA_EMAIL);
    await host.getByLabel("Password").fill(QA_PASSWORD);
    await host.getByRole("button", { name: "Sign in" }).click();
    await expect(host).toHaveURL(/\/admin$/);
    await expect(host.getByText(/good (morning|afternoon|evening)/i)).toBeVisible({ timeout: 20_000 });
  });

  test("Phase 1a: create competition", async () => {
    await host.goto("/admin");
    await host.getByRole("button", { name: "Create Competition" }).first().click();
    await host.getByPlaceholder("Summer Camp 2026").fill(COMPETITION_TITLE);
    // Economy mode is only ever settable here (no post-creation edit UI) — needed
    // so the room actually grants starting coins and has a working Store later.
    await host.getByRole("button", { name: "Economy mode", exact: true }).click();
    await host.getByRole("button", { name: "Create", exact: true }).click();

    await expect(host).toHaveURL(/\/admin\/competitions\/[a-f0-9]+$/, { timeout: 30_000 });
    competitionId = host.url().split("/").pop()!;
    expect(competitionId).toMatch(/^[a-f0-9]{24}$/);
    await expect(host.getByRole("heading", { name: COMPETITION_TITLE })).toBeVisible();
  });

  test("Phase 1b: create room, verify room code", async () => {
    await host.goto(`/admin/competitions/${competitionId}`);
    await host.getByRole("button", { name: "Rooms" }).click();
    await host.getByRole("button", { name: "Create Room" }).first().click();

    const nameField = host.getByLabel("Room name");
    await nameField.fill("");
    await nameField.fill(ROOM_NAME);
    await host.getByRole("button", { name: "Save room" }).click();

    await expect(host.getByText(ROOM_NAME, { exact: true })).toBeVisible({ timeout: 20_000 });
    const codeEl = host.locator("span.font-mono", { hasText: /^[A-Z0-9]{4,8}$/ }).first();
    await expect(codeEl).toBeVisible();
    roomCode = (await codeEl.textContent())!.trim();
    expect(roomCode.length).toBeGreaterThan(3);

    await host.getByRole("link", { name: "Continue Setup" }).click();
    // First navigation to a not-yet-compiled dynamic route can take a while
    // under Turbopack dev (on-demand compile) — allow generous headroom here.
    await expect(host).toHaveURL(/\/admin\/rooms\/[a-f0-9]+$/, { timeout: 30_000 });
    roomId = host.url().split("/").pop()!;
    expect(roomId).toMatch(/^[a-f0-9]{24}$/);
  });

  // ── PHASE 2: Question Library ──────────────────────────────────────────
  const MCQ_QUESTION = "ગુજરાતના પ્રથમ તીર્થંકર કોણ?";
  const MCQ_OPTIONS = ["શ્રી આદિનાથ ભગવાન", "શ્રી અજિતનાથ ભગવાન", "શ્રી પાર્શ્વનાથ ભગવાન", "શ્રી મહાવીર સ્વામી"];
  const MCQ_ANSWER = MCQ_OPTIONS[0];
  const IMAGE_TEXT_QUESTION = "આ કયું જૈન તીર્થ છે?";
  const DRAWING_INSTRUCTION = "શંખનું ચિત્ર દોરો";
  const DUPLICATE_TARGET = MCQ_QUESTION;

  test("Phase 2a: create MCQ question with options + 2 hints", async () => {
    await host.goto("/admin/questions");
    await expect(host.getByText("Question Bank", { exact: true })).toBeVisible({ timeout: 15_000 });

    await host.getByRole("button", { name: "Create Question" }).first().click();
    await pickQuestionType(host, "Text");

    await host.getByLabel("Question text").fill(MCQ_QUESTION);
    await host.getByLabel(/Multiple choice \(MCQ\)/).check();

    // The editor starts with 2 blank option rows; add 2 more for A-D.
    await host.getByRole("button", { name: "Add option" }).click();
    await host.getByRole("button", { name: "Add option" }).click();
    const optionInputs = host.getByPlaceholder(/^Option \d$/);
    await expect(optionInputs).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await optionInputs.nth(i).fill(MCQ_OPTIONS[i]);
    }

    await host.getByLabel("Correct option").selectOption(MCQ_ANSWER);

    await host.getByRole("button", { name: "Add hint" }).click();
    await host.getByRole("button", { name: "Add hint" }).click();
    const hintInputs = host.getByPlaceholder(/^Hint \d$/);
    await expect(hintInputs).toHaveCount(2);
    await hintInputs.nth(0).fill("આ પ્રથમ તીર્થંકર છે.");
    await hintInputs.nth(1).fill("તેમનું બીજું નામ ઋષભદેવ છે.");

    await host.getByRole("button", { name: "Save Question" }).click();
    await expect(host.getByText("Create question", { exact: true })).toBeHidden({ timeout: 20_000 });
    await expect(host.getByText(MCQ_QUESTION)).toBeVisible();
    await expect(host.getByText("MCQ", { exact: true }).first()).toBeVisible();
  });

  test("Phase 2b: create TEXT_IMAGE question with media URL", async () => {
    await host.goto("/admin/questions");
    await host.getByRole("button", { name: "Create Question" }).first().click();
    await pickQuestionType(host, "Text + Image");

    await host.getByLabel("Question text").fill(IMAGE_TEXT_QUESTION);
    await host.getByLabel("Upload image / media URL").fill("https://example.com/tirthankar-temple.jpg");
    await host.getByLabel("Media name").fill("Temple reference");
    await host.getByLabel(/Correct answer/).fill("શ્રી શત્રુંજય તીર્થ");

    await host.getByRole("button", { name: "Save Question" }).click();
    await expect(host.getByText("Create question", { exact: true })).toBeHidden({ timeout: 20_000 });
    await expect(host.getByText(IMAGE_TEXT_QUESTION)).toBeVisible();
  });

  test("Phase 2c: create DRAWING question", async () => {
    await host.goto("/admin/questions");
    await host.getByRole("button", { name: "Create Question" }).first().click();
    await pickQuestionType(host, "Drawing");

    await host.getByLabel("Drawing instruction").fill(DRAWING_INSTRUCTION);
    await host.getByLabel(/Answer \/ reference/).fill("શંખ");

    await host.getByRole("button", { name: "Save Question" }).click();
    await expect(host.getByText("Create question", { exact: true })).toBeHidden({ timeout: 20_000 });
    await expect(host.getByText(DRAWING_INSTRUCTION)).toBeVisible();
  });

  test("Phase 2d: edit works", async () => {
    await host.goto("/admin/questions");
    const card = host.locator("div.rounded-2xl", { has: host.getByText(DRAWING_INSTRUCTION, { exact: true }) }).first();
    await card.getByRole("button", { name: "Edit" }).click();
    await expect(host.getByText("Edit question", { exact: true })).toBeVisible();
    await host.getByLabel(/Answer \/ reference/).fill("શંખ (પવિત્ર ચિહ્ન)");
    await host.getByRole("button", { name: "Save Question" }).click();
    await expect(host.getByText("Edit question", { exact: true })).toBeHidden({ timeout: 20_000 });
    await expect(host.getByText("Answer: શંખ (પવિત્ર ચિહ્ન)")).toBeVisible();
  });

  test("Phase 2e: duplicate works", async () => {
    await host.goto("/admin/questions");
    const card = host.locator("div.rounded-2xl", { has: host.getByText(DUPLICATE_TARGET, { exact: true }) }).first();
    await card.getByRole("button", { name: "Duplicate" }).click();
    // duplicateQuestion() appends " Copy" to the question text by design.
    await expect(host.getByText(`${DUPLICATE_TARGET} Copy`, { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("Phase 2f: search works", async () => {
    await host.goto("/admin/questions");
    await host.getByPlaceholder("Search").fill("શંખ");
    await expect(host.getByText(DRAWING_INSTRUCTION)).toBeVisible();
    await expect(host.getByText(MCQ_QUESTION)).toHaveCount(0);
    await host.getByPlaceholder("Search").fill("");
  });

  test("Phase 2g: filter works", async () => {
    await host.goto("/admin/questions");
    await host.locator("select").first().selectOption("DRAWING");
    await expect(host.getByText(DRAWING_INSTRUCTION)).toBeVisible();
    await expect(host.getByText(MCQ_QUESTION)).toHaveCount(0);
    await host.locator("select").first().selectOption("ALL");
  });

  test("Phase 2h: delete works", async () => {
    await host.goto("/admin/questions");
    const copyText = `${DUPLICATE_TARGET} Copy`;
    const disposable = host.locator("div.rounded-2xl", { has: host.getByText(copyText, { exact: true }) }).first();
    await disposable.getByRole("button", { name: "Delete" }).click();
    // Click once; the server round-trip + revalidation can be slow under load
    // — poll for the result rather than re-clicking (which risks a second
    // click landing on an already-detached/reflowed element).
    await expect(host.getByText(copyText, { exact: true })).toHaveCount(0, { timeout: 30_000 });
    // The original (non-copy) question must still be present.
    await expect(host.getByText(DUPLICATE_TARGET, { exact: true })).toBeVisible();
  });

  test("Phase 2i: data survives a hard refresh", async () => {
    await host.goto("/admin/questions");
    await host.reload();
    await expect(host.getByText(MCQ_QUESTION)).toBeVisible();
    await expect(host.getByText(IMAGE_TEXT_QUESTION)).toBeVisible();
    await expect(host.getByText(DRAWING_INSTRUCTION)).toBeVisible();
  });

  // ── PHASE 3: Power Cards ───────────────────────────────────────────────
  // seedDefaultPowerCards() auto-seeds Shield/Hint/Double Points(-ish)/Extra
  // Time/Freeze on first catalog visit — so those already exist by name (or
  // close variants). This phase creates the remaining named cards and proves
  // CRUD + the no-duplicate-name rule.
  const NEW_CARD_NAME = "Second Chance";

  test("Phase 3a: catalog auto-seeds the default seven+ cards", async () => {
    await host.goto("/admin/power-cards");
    await expect(host.getByRole("main").getByText("Power Cards", { exact: true })).toBeVisible({ timeout: 15_000 });
    for (const name of ["Hint", "Shield", "Double Points", "Extra Time", "Freeze"]) {
      await expect(host.getByText(name, { exact: true })).toBeVisible();
    }
  });

  test("Phase 3b: create a new power card", async () => {
    await host.goto("/admin/power-cards");
    await host.getByRole("button", { name: "Create Card" }).first().click();
    await host.getByPlaceholder("Card name — e.g. Shield").fill(NEW_CARD_NAME);
    await host.getByPlaceholder("What does it do?").fill("Allows a team to retry a wrong answer once.");
    await host.getByLabel("Price (coins)").fill("1300");
    await host.getByLabel("Uses per team").fill("2");
    await host.getByRole("button", { name: "Add card" }).click();
    await expect(host.getByText("New power card", { exact: true })).toBeHidden({ timeout: 20_000 });
    await expect(host.getByText(NEW_CARD_NAME, { exact: true })).toBeVisible();
    await expect(host.getByText(/1300 coins/)).toBeVisible();
    await expect(host.getByText(/2 uses/)).toBeVisible();
  });

  test("Phase 3c: no duplicate card names allowed", async () => {
    await host.goto("/admin/power-cards");
    await host.getByRole("button", { name: "Create Card" }).first().click();
    await host.getByPlaceholder("Card name — e.g. Shield").fill(NEW_CARD_NAME);
    await host.getByRole("button", { name: "Add card" }).click();
    await expect(host.getByText(`A power card named "${NEW_CARD_NAME}" already exists.`)).toBeVisible({
      timeout: 20_000,
    });
    // Modal must still be open — the create was rejected, not silently dropped.
    await expect(host.getByText("New power card", { exact: true })).toBeVisible();
    await host.getByRole("button", { name: "Cancel" }).click();
  });

  test("Phase 3d: edit works (price + usage limit)", async () => {
    await host.goto("/admin/power-cards");
    const card = host.locator(".rounded-2xl", { has: host.getByText(NEW_CARD_NAME, { exact: true }) }).first();
    await card.getByRole("button", { name: "Edit" }).click();
    await expect(host.getByText("Edit power card", { exact: true })).toBeVisible();
    await host.getByLabel("Price").fill("1750");
    await host.getByLabel("Uses per team").fill("3");
    await host.getByRole("button", { name: "Save card" }).click();
    await expect(host.getByText("Edit power card", { exact: true })).toBeHidden({ timeout: 20_000 });
    await expect(host.getByText(/1750 coins/)).toBeVisible();
    await expect(host.getByText(/3 uses/)).toBeVisible();
  });

  test("Phase 3e: renaming to an existing name is also blocked", async () => {
    await host.goto("/admin/power-cards");
    const card = host.locator(".rounded-2xl", { has: host.getByText(NEW_CARD_NAME, { exact: true }) }).first();
    await card.getByRole("button", { name: "Edit" }).click();
    // The name field has no label/placeholder — scope to the open modal
    // overlay so we don't accidentally hit the page's "Search cards" input.
    const nameInput = host.locator(".fixed.inset-0 input").first();
    await nameInput.fill("");
    await nameInput.fill("Shield");
    await host.getByRole("button", { name: "Save card" }).click();
    await expect(host.getByText('A power card named "Shield" already exists.')).toBeVisible({ timeout: 20_000 });
    await host.getByRole("button", { name: "Cancel" }).click();
  });

  test("Phase 3f: delete works", async () => {
    await host.goto("/admin/power-cards");
    const card = host.locator(".rounded-2xl", { has: host.getByText(NEW_CARD_NAME, { exact: true }) }).first();
    await card.getByRole("button", { name: "Delete" }).click();
    await expect(host.getByText(NEW_CARD_NAME, { exact: true })).toHaveCount(0, { timeout: 20_000 });
  });

  // ── PHASE 4: Round Builder ─────────────────────────────────────────────
  const ROUND_TITLE = "Round 1";
  let round1Id = "";

  test("Phase 4a: create round", async () => {
    await host.goto("/admin/rounds");
    await expect(host.getByRole("main").getByText("Round Builder", { exact: true })).toBeVisible({ timeout: 15_000 });
    await host.getByRole("button", { name: "Create Round" }).first().click();
    await host.getByLabel("Round name").fill(ROUND_TITLE);
    await host.getByRole("button", { name: "Create round", exact: true }).click();

    await expect(host).toHaveURL(/\/admin\/rounds\/[a-f0-9]+$/, { timeout: 30_000 });
    round1Id = host.url().split("/").pop()!;
    expect(round1Id).toMatch(/^[a-f0-9]{24}$/);
    await expect(host.getByRole("main").getByText(ROUND_TITLE, { exact: true }).first()).toBeVisible();
  });

  test("Phase 4b: add questions to the round", async () => {
    await host.goto(`/admin/rounds/${round1Id}`);
    await host.getByRole("button", { name: "Questions", exact: true }).click();
    await host.getByRole("button", { name: "Add Questions" }).first().click();

    for (const text of [MCQ_QUESTION, IMAGE_TEXT_QUESTION, DRAWING_INSTRUCTION]) {
      await host.locator("label", { has: host.getByText(text, { exact: true }) }).getByRole("checkbox").check();
    }
    await host.getByRole("button", { name: /^Add 3$/ }).click();
    await expect(host.getByText("Add questions", { exact: true })).toBeHidden({ timeout: 20_000 });

    // Default add order = selection order: MCQ, then Image+Text, then Drawing.
    const rows = host.locator("div.rounded-xl.p-3");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText(MCQ_QUESTION);
    await expect(rows.nth(1)).toContainText(IMAGE_TEXT_QUESTION);
    await expect(rows.nth(2)).toContainText(DRAWING_INSTRUCTION);
  });

  test("Phase 4c: question ordering (move down / up)", async () => {
    await host.goto(`/admin/rounds/${round1Id}`);
    await host.getByRole("button", { name: "Questions", exact: true }).click();

    const rows = host.locator("div.rounded-xl.p-3");
    // Move the first row (MCQ) down once -> order becomes Image, MCQ, Drawing.
    await rows.nth(0).getByRole("button", { name: "Down" }).click();
    await expect(async () => {
      await expect(rows.nth(0)).toContainText(IMAGE_TEXT_QUESTION);
      await expect(rows.nth(1)).toContainText(MCQ_QUESTION);
      await expect(rows.nth(2)).toContainText(DRAWING_INSTRUCTION);
    }).toPass({ timeout: 20_000 });

    // Move it back up -> restores original order.
    await rows.nth(1).getByRole("button", { name: "Up" }).click();
    await expect(async () => {
      await expect(rows.nth(0)).toContainText(MCQ_QUESTION);
      await expect(rows.nth(1)).toContainText(IMAGE_TEXT_QUESTION);
      await expect(rows.nth(2)).toContainText(DRAWING_INSTRUCTION);
    }).toPass({ timeout: 20_000 });
  });

  test("Phase 4d: enable Hint + Shield, disable Double Points", async () => {
    await host.goto(`/admin/rounds/${round1Id}`);
    await host.getByRole("button", { name: "Power Cards", exact: true }).click();

    const hintRow = host.locator("label", { has: host.getByText("Hint", { exact: true }) });
    const shieldRow = host.locator("label", { has: host.getByText("Shield", { exact: true }) });
    const doubleRow = host.locator("label", { has: host.getByText("Double Points", { exact: true }) });

    await expect(hintRow.getByRole("checkbox")).not.toBeChecked();
    await hintRow.getByRole("checkbox").click({ force: true });
    await expect(async () => expect(await hintRow.getByRole("checkbox").isChecked()).toBe(true)).toPass({ timeout: 20_000 });

    await shieldRow.getByRole("checkbox").click({ force: true });
    await expect(async () => expect(await shieldRow.getByRole("checkbox").isChecked()).toBe(true)).toPass({ timeout: 20_000 });

    // Double Points must stay unchecked (never toggled).
    await expect(doubleRow.getByRole("checkbox")).not.toBeChecked();
  });

  test("Phase 4e: power restrictions persist after reload", async () => {
    await host.goto(`/admin/rounds/${round1Id}`);
    await host.getByRole("button", { name: "Power Cards", exact: true }).click();
    const hintRow = host.locator("label", { has: host.getByText("Hint", { exact: true }) });
    const shieldRow = host.locator("label", { has: host.getByText("Shield", { exact: true }) });
    const doubleRow = host.locator("label", { has: host.getByText("Double Points", { exact: true }) });
    await expect(hintRow.getByRole("checkbox")).toBeChecked();
    await expect(shieldRow.getByRole("checkbox")).toBeChecked();
    await expect(doubleRow.getByRole("checkbox")).not.toBeChecked();
  });

  // ── PHASE 5: Room Setup — Teams, coins, initial power cards ────────────
  test("Phase 5a: create Team A with name-only members", async () => {
    await host.goto(`/admin/rooms/${roomId}`);
    await host.getByRole("button", { name: "Teams", exact: true }).click();
    await host.getByRole("button", { name: "Create Team" }).first().click();

    await host.getByPlaceholder("Team A").fill("Team A");
    await host.getByPlaceholder("Member 1").fill("Amit");
    await host.getByRole("button", { name: "Add member" }).click();
    await host.getByPlaceholder("Member 2").fill("Jay");
    await host.getByRole("button", { name: "Save team" }).click();

    await expect(host.getByText("Create team", { exact: true })).toBeHidden({ timeout: 20_000 });
    await expect(host.getByText("Team A", { exact: true }).first()).toBeVisible();
    // Member entry is a bare name field — no email/password inputs exist anywhere in this form.
    await expect(host.locator('input[type="email"]')).toHaveCount(0);
    await expect(host.locator('input[type="password"]')).toHaveCount(0);
  });

  test("Phase 5b: create Team B with name-only members", async () => {
    await host.goto(`/admin/rooms/${roomId}`);
    await host.getByRole("button", { name: "Teams", exact: true }).click();
    await host.getByRole("button", { name: "Create Team" }).first().click();

    await host.getByPlaceholder("Team A").fill("Team B");
    await host.getByPlaceholder("Member 1").fill("Rahul");
    await host.getByRole("button", { name: "Add member" }).click();
    await host.getByPlaceholder("Member 2").fill("Meet");
    await host.getByRole("button", { name: "Save team" }).click();

    await expect(host.getByText("Create team", { exact: true })).toBeHidden({ timeout: 20_000 });
    await expect(host.getByText("Team B", { exact: true }).first()).toBeVisible();
  });

  test("Phase 5c: starting coins = 5000 (Economy Mode)", async () => {
    await host.goto(`/admin/rooms/${roomId}`);
    await host.getByRole("button", { name: "Settings", exact: true }).click();
    const startingCoinsField = host.locator("label", { has: host.getByText("Starting coins", { exact: true }) }).locator("input");
    await expect(startingCoinsField).toHaveValue("5000");
  });

  test("Phase 5d: power card panel is reachable in room setup (previously orphaned)", async () => {
    await host.goto(`/admin/rooms/${roomId}`);
    await host.getByRole("button", { name: "Teams", exact: true }).click();
    await expect(host.getByText(/POWER CARDS/)).toBeVisible();
    // Economy Mode room -> read-only price/stock view, not the Simple-Mode assign button.
    await expect(host.getByText("Economy Mode", { exact: false })).toBeVisible();
  });

  test("Phase 5e: Simple Mode host can assign initial power cards to every team (fix verification)", async () => {
    // Dedicated throwaway Simple-Mode competition/room/team, since the main
    // suite competition runs Economy Mode. Proves assignPowerCardsToRoom's
    // UI (previously unreachable — see Phase 5d) actually works end-to-end.
    await host.goto("/admin");
    await host.getByRole("button", { name: "Create Competition" }).first().click();
    await host.getByPlaceholder("Summer Camp 2026").fill("Simple Mode Assign Check");
    await host.getByRole("button", { name: "Simple mode", exact: true }).click();
    await host.getByRole("button", { name: "Create", exact: true }).click();
    await expect(host).toHaveURL(/\/admin\/competitions\/[a-f0-9]+$/, { timeout: 30_000 });
    const simpleCompetitionId = host.url().split("/").pop()!;

    await host.getByRole("button", { name: "Rooms" }).click();
    await host.getByRole("button", { name: "Create Room" }).first().click();
    const nameField = host.getByLabel("Room name");
    await nameField.fill("");
    await nameField.fill("Simple Room");
    await host.getByRole("button", { name: "Save room" }).click();
    await host.getByRole("link", { name: "Continue Setup" }).click();
    await expect(host).toHaveURL(/\/admin\/rooms\/[a-f0-9]+$/, { timeout: 30_000 });
    const simpleRoomId = host.url().split("/").pop()!;

    await host.getByRole("button", { name: "Teams", exact: true }).click();
    await host.getByRole("button", { name: "Create Team" }).first().click();
    await host.getByPlaceholder("Team A").fill("Solo Team");
    await host.getByPlaceholder("Member 1").fill("Priya");
    await host.getByRole("button", { name: "Save team" }).click();
    await expect(host.getByText("Create team", { exact: true })).toBeHidden({ timeout: 20_000 });

    await expect(host.getByText("Simple Mode · host assigns", { exact: true })).toBeVisible();
    const hintCardPanel = host.locator(".flex.flex-col.gap-2.rounded-xl", { has: host.getByText("Hint", { exact: true }) }).first();
    await hintCardPanel.locator('input[type="number"]').fill("2");
    await host.getByRole("button", { name: "Assign to every team" }).click();
    await expect(host.getByText("Assign to every team", { exact: true })).toBeVisible({ timeout: 20_000 });

    // Confirm the grant actually landed in the team's inventory (read-only panel below).
    await expect(async () => {
      await host.reload();
      await host.getByRole("button", { name: "Teams", exact: true }).click();
      await expect(host.getByText("Hint", { exact: true }).last()).toBeVisible();
      await expect(host.getByText("AVAILABLE", { exact: true })).toBeVisible();
    }).toPass({ timeout: 15_000 });

    void simpleCompetitionId;
    void simpleRoomId;
  });

  // ── PHASE 6: Event Flow ─────────────────────────────────────────────────
  test("Phase 6a: select Round 1 into the room", async () => {
    await host.goto(`/admin/rooms/${roomId}`);
    await host.getByRole("button", { name: "Rounds", exact: true }).click();
    const roundCard = host.locator(".rounded-xl", { has: host.getByText(ROUND_TITLE, { exact: true }) }).first();
    await roundCard.getByRole("button", { name: "Add" }).click();
    // This specific mutation has shown intermittent extra latency (remote
    // Atlas round-trip variance) — give it generous room before re-polling.
    await expect(async () => {
      await host.reload();
      await host.getByRole("button", { name: "Rounds", exact: true }).click();
      await expect(host.getByRole("button", { name: "Remove" })).toBeVisible();
    }).toPass({ timeout: 45_000 });
  });

  test("Phase 6b: generate event flow — expected canonical sequence", async () => {
    await host.goto(`/admin/rooms/${roomId}`);
    await host.getByRole("button", { name: "Event Flow", exact: true }).click();
    await host.getByRole("button", { name: "Generate Event Flow" }).click();

    const steps = host.locator(".rounded-xl.border.p-3.flex.flex-col.gap-2");
    await expect(steps).toHaveCount(10, { timeout: 15_000 });
    const expectedTitles = [
      "Welcome",
      `${ROUND_TITLE} Intro`,
      MCQ_QUESTION,
      `Answer - ${MCQ_QUESTION}`,
      IMAGE_TEXT_QUESTION,
      `Answer - ${IMAGE_TEXT_QUESTION}`,
      DRAWING_INSTRUCTION,
      `Answer - ${DRAWING_INSTRUCTION}`,
      `${ROUND_TITLE} Leaderboard`,
      "Winner",
    ];
    for (let i = 0; i < expectedTitles.length; i++) {
      await expect(steps.nth(i)).toContainText(expectedTitles[i]);
    }
  });

  test("Phase 6c: reorder works (move step down then up)", async () => {
    await host.goto(`/admin/rooms/${roomId}`);
    await host.getByRole("button", { name: "Event Flow", exact: true }).click();
    const steps = host.locator(".rounded-xl.border.p-3.flex.flex-col.gap-2");

    // Move step 2 (Round Intro) down -> swaps with step 3 (MCQ question).
    await steps.nth(1).getByRole("button", { name: "Down" }).click();
    await expect(async () => {
      await expect(steps.nth(1)).toContainText(MCQ_QUESTION);
      await expect(steps.nth(2)).toContainText(`${ROUND_TITLE} Intro`);
    }).toPass({ timeout: 20_000 });

    await steps.nth(2).getByRole("button", { name: "Up" }).click();
    await expect(async () => {
      await expect(steps.nth(1)).toContainText(`${ROUND_TITLE} Intro`);
      await expect(steps.nth(2)).toContainText(MCQ_QUESTION);
    }).toPass({ timeout: 20_000 });
  });

  test("Phase 6d: regenerate restores the canonical order", async () => {
    await host.goto(`/admin/rooms/${roomId}`);
    await host.getByRole("button", { name: "Event Flow", exact: true }).click();
    await host.getByRole("button", { name: "Regenerate" }).click();

    const steps = host.locator(".rounded-xl.border.p-3.flex.flex-col.gap-2");
    await expect(steps).toHaveCount(10, { timeout: 15_000 });
    await expect(steps.nth(0)).toContainText("Welcome");
    await expect(steps.nth(1)).toContainText(`${ROUND_TITLE} Intro`);
    await expect(steps.nth(9)).toContainText("Winner");
  });

  test("Phase 6e: preview panel works", async () => {
    await host.goto(`/admin/rooms/${roomId}`);
    await host.getByRole("button", { name: "Event Flow", exact: true }).click();
    const steps = host.locator(".rounded-xl.border.p-3.flex.flex-col.gap-2");
    await steps.nth(2).click(); // MCQ question step
    await expect(host.getByText("EVENT FLOW PREVIEW")).toBeVisible();
    await expect(host.getByText(MCQ_QUESTION).first()).toBeVisible();
  });

  // ── PHASE 7-9: Live event — host + 2 participants ───────────────────────
  test("Phase 7a: open host console", async () => {
    await host.goto(`/host/${roomId}`);
    await expect(host.getByText(ROOM_NAME, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(host.getByText(/CODE:\s*\d+/)).toBeVisible();
  });

  test("Phase 7b: open two participant contexts (mobile viewport)", async ({ browser }) => {
    p1Context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    p1 = await p1Context.newPage();
    watchForErrors(p1, "participant1");

    p2Context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    p2 = await p2Context.newPage();
    watchForErrors(p2, "participant2");

    await p1.goto(`/play/${roomCode}`);
    await p2.goto(`/play/${roomCode}`);
    await expect(p1.getByText("Your name", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(p2.getByText("Your name", { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("Phase 8a: participant 1 joins as Amit on Team A", async () => {
    await p1.getByPlaceholder("Moksh").fill("Amit");
    await p1.locator("button", { hasText: "Team A" }).click();
    await p1.getByRole("button", { name: "Join room" }).click();
    await expect(p1.getByText("You're in, Amit!", { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("Phase 8b: participant 2 joins as Rahul on Team B", async () => {
    await p2.getByPlaceholder("Moksh").fill("Rahul");
    await p2.locator("button", { hasText: "Team B" }).click();
    await p2.getByRole("button", { name: "Join room" }).click();
    await expect(p2.getByText("You're in, Rahul!", { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("Phase 8c: host sees connected participants; participants see waiting state", async () => {
    // First live-poll response can be slow (see requestfinished logging) — give it room.
    await expect(p1.getByText(/Waiting for the host to start/)).toBeVisible({ timeout: 100_000 });
    await expect(p2.getByText(/Waiting for the host to start/)).toBeVisible({ timeout: 100_000 });

    await host.reload();
    // Host top bar shows "N Connected" — poll since it's driven by the same 1s live-state cycle.
    await expect(async () => {
      await expect(host.getByText(/2\s*Connected/)).toBeVisible();
    }).toPass({ timeout: 20_000 });
  });

  test("Phase 9: host starts event — both participants move WAITING -> WELCOME with no manual refresh", async () => {
    await host.getByRole("button", { name: "Start Event" }).click();

    // No .reload() on the participant pages — this proves the live poll (not a
    // page refresh) is what carries the scene change to connected phones.
    await expect(p1.getByText("Welcome", { exact: true })).toBeVisible({ timeout: 100_000 });
    await expect(p2.getByText("Welcome", { exact: true })).toBeVisible({ timeout: 100_000 });
    await expect(p1.getByText(/Waiting for the host to start/)).toHaveCount(0);
    await expect(p2.getByText(/Waiting for the host to start/)).toHaveCount(0);
  });
});
