const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "modules", "services", "redmine.js"),
  "utf8"
);

function createExtractor() {
  const context = vm.createContext({
    console,
    normalizeLoose: (value) =>
      String(value ?? "")
        .normalize("NFKC")
        .replace(/\s+/g, "")
        .toLowerCase(),
    globalThis: {},
  });

  vm.runInContext(
    `${source}
this.pickBestRedmineSearchResult = pickBestRedmineSearchResult;
this.hasStrongRedmineTextMatch = hasStrongRedmineTextMatch;
this.extractJapaneseTitlePart = extractJapaneseTitlePart;
this.normalizeLoose = normalizeLoose;`,
    context
  );

  return context;
}

test("time-entry reads consume every page before returning data to report workflows", async () => {
  const calls = [];
  const context = vm.createContext({ URLSearchParams });
  vm.runInContext(source, context);
  context.redmineAuthorizedFetch = async (_domain, _key, requestPath) => {
    calls.push(requestPath);
    const offset = Number(
      new URL(requestPath, "https://redmine.example.test").searchParams.get("offset")
    );
    return {
      ok: true,
      json: async () => ({
        time_entries: offset === 0 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }],
        total_count: 3,
      }),
    };
  };
  const entries = await context.findTimeEntries("https://redmine.example.test", "", {
    user_id: 7,
    limit: 2,
  });
  assert.deepEqual(
    Array.from(entries, (entry) => entry.id),
    [1, 2, 3]
  );
  assert.equal(calls.length, 2);
  assert.match(calls[1], /offset=2/);
  assert.match(calls[1], /user_id=7/);
});

test("time-entry reads reject incomplete or repeated pages instead of returning a partial list", async () => {
  for (const secondPage of [[], [{ id: 1 }]]) {
    const context = vm.createContext({ URLSearchParams });
    vm.runInContext(source, context);
    let requests = 0;
    context.redmineAuthorizedFetch = async () => ({
      ok: true,
      json: async () => ({
        time_entries: requests++ === 0 ? [{ id: 1 }] : secondPage,
        total_count: 2,
      }),
    });
    await assert.rejects(
      context.findTimeEntries("https://redmine.example.test", "", { limit: 1 }),
      /incomplete|pagination/
    );
  }
});

test("attachment transfer failures prevent sending a note with missing files", async () => {
  let posted = false;
  const context = vm.createContext({
    console: { log() {}, error() {} },
    getSettings: async () => ({ backlogDomain: "https://demo.backlog.com" }),
    downloadBacklogFile: async () => {
      throw new Error("Download failed");
    },
    fetch: async () => {
      posted = true;
    },
  });
  vm.runInContext(source, context);
  await assert.rejects(
    context.handleSendToRedmine({
      redmineIssueId: "1",
      notes: "[[TB_FILE:5:demo.txt]]",
      backlogIssueKey: "DEMO-1",
    }),
    /could not be transferred/
  );
  assert.equal(posted, false);
});

test("failed note submissions do not commit uploaded attachments to the migration cache", async () => {
  const context = vm.createContext({
    getSettings: async () => ({ redmineDomain: "https://redmine.example.test" }),
    buildRedmineUrl: (domain, target) => new URL(target, domain).href,
    safeReadJson: async () => null,
    readErrorMessage: async () => "Request failed",
    sanitizeErrorMessage: (text) => text,
    TB: { MESSAGES: { REDMINE: { SEARCH_PAGE_ERROR: "Failed" }, TOAST: { SEND_SUCCESS: "Sent" } } },
  });
  vm.runInContext(source, context);
  context.processNotesAttachments = async (_notes, _domain, _settings, _key, cache) => {
    cache.set("5", "attachment:demo.txt");
    return { updatedNotes: "attachment:demo.txt", uploads: [{ token: "demo-token" }] };
  };
  const cache = new Map();
  const message = { redmineIssueId: "1", notes: "demo", processedAttachments: cache };
  context.fetch = async () => ({ ok: false, status: 500 });
  await assert.rejects(context.handleSendToRedmine(message), /Failed/);
  assert.equal(cache.size, 0);
  context.fetch = async () => ({ ok: true });
  await context.handleSendToRedmine(message);
  assert.equal(cache.get("5"), "attachment:demo.txt");
});

test("pickBestRedmineSearchResult returns a strong match even when tracker differs", () => {
  const { pickBestRedmineSearchResult, normalizeLoose } = createExtractor();

  const results = [
    {
      id: 3557,
      subject:
        "Bug #3557 (New): COUIX_PJ-3557 【アンケート】コンテンツ一覧の表示設定_表示条件(URL)機能修正と追加",
      tracker: "Bug",
    },
    {
      id: 9999,
      subject: "Bug #9999 (New): something else",
      tracker: "Bug",
    },
  ];

  const picked = pickBestRedmineSearchResult(
    results,
    normalizeLoose("COUIX_PJ-3557"),
    normalizeLoose("【アンケート】コンテンツ一覧の表示設定_表示条件(URL)機能修正と追加"),
    ["task"]
  );

  assert.equal(picked?.id, 3557);
});

test("pickBestRedmineSearchResult prefers tracker when summary match is too weak", () => {
  const { pickBestRedmineSearchResult, normalizeLoose } = createExtractor();

  const results = [
    {
      id: 100,
      subject: "Bug #100 (New): fix bug",
      tracker: "Bug",
    },
    {
      id: 200,
      subject: "Task #200 (New): unrelated task",
      tracker: "Task",
    },
  ];

  const picked = pickBestRedmineSearchResult(
    results,
    normalizeLoose(""),
    normalizeLoose("fix bug"),
    ["task"]
  );

  assert.equal(picked?.id, 200);
});

test("hasStrongRedmineTextMatch requires issue key or long summary", () => {
  const { hasStrongRedmineTextMatch, normalizeLoose } = createExtractor();

  assert.equal(
    hasStrongRedmineTextMatch(
      "Bug #1 COUIX_PJ-3557 title",
      normalizeLoose("COUIX_PJ-3557"),
      normalizeLoose("short")
    ),
    true
  );
  assert.equal(
    hasStrongRedmineTextMatch(
      "Bug #1 long japanese title here",
      normalizeLoose(""),
      normalizeLoose("long japanese title here")
    ),
    true
  );
  assert.equal(
    hasStrongRedmineTextMatch("Bug #1 fix bug", normalizeLoose(""), normalizeLoose("fix bug")),
    false
  );
});

test("extractJapaneseTitlePart keeps JP and drops VN translation segment", () => {
  const { extractJapaneseTitlePart } = createExtractor();

  assert.equal(
    extractJapaneseTitlePart(
      "【調査】デザインテーマが適用されているサイトで、ページ遷移時に、テーマの取得に時間がかかる / ([Điều tra] Tại các trang web có áp dụng Design theme, hệ thống mất nhiều thời gian để lấy dữ liệu theme khi chuyển trang)"
    ),
    "【調査】デザインテーマが適用されているサイトで、ページ遷移時に、テーマの取得に時間がかかる"
  );
});

test("pickBestRedmineSearchResult matches JP-only when Redmine subject has VN translation", () => {
  const { pickBestRedmineSearchResult, normalizeLoose, extractJapaneseTitlePart } =
    createExtractor();

  const backlogJp =
    "【調査】デザインテーマが適用されているサイトで、ページ遷移時に、テーマの取得に時間がかかる";
  const redmineSubject = `${backlogJp} / ([Điều tra] Bản dịch VN khác hoàn toàn so với bản khác)`;

  const picked = pickBestRedmineSearchResult(
    [
      {
        id: 3587,
        subject: `Task #3587 (New): ${redmineSubject}`,
        tracker: "Task",
      },
    ],
    normalizeLoose("COUIX_PJ-3587"),
    normalizeLoose(extractJapaneseTitlePart(backlogJp)),
    ["task"]
  );

  assert.equal(picked?.id, 3587);
});
