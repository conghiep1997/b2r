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

test("API lookup includes later pages and rejects a tied match on a later page", async () => {
  const context = createExtractor();
  context.URLSearchParams = URLSearchParams;
  context.buildRedmineUrl = (domain, pathname) => new URL(pathname, domain).href;
  context.safeReadJson = (response) => response.json();
  const offsets = [];
  let tied = false;
  context.timeoutFetch = async (url) => {
    const offset = Number(new URL(url).searchParams.get("offset"));
    offsets.push(offset);
    const issues =
      offset === 0
        ? Array.from({ length: 25 }, (_, index) => ({
            id: index + 1,
            subject: tied && index === 0 ? "DEMO-1 Match" : "Unrelated",
          }))
        : [{ id: 26, subject: "DEMO-1 Match" }];
    return { ok: true, json: async () => ({ issues, total_count: 26 }) };
  };
  const lookup = () =>
    context.findRedmineIssueViaApi("https://redmine.example", "fixture", "DEMO-1");
  assert.equal((await lookup()).id, "26");
  assert.deepEqual(offsets, [0, 25]);
  tied = true;
  assert.equal(await lookup(), null);
});

test("API lookup refuses repeated pages rather than selecting from incomplete results", async () => {
  const context = createExtractor();
  context.URLSearchParams = URLSearchParams;
  context.buildRedmineUrl = (domain, pathname) => new URL(pathname, domain).href;
  context.safeReadJson = (response) => response.json();
  context.timeoutFetch = async () => ({
    ok: true,
    json: async () => ({ issues: [{ id: 1, subject: "DEMO-1 Match" }], total_count: 2 }),
  });
  await assert.rejects(
    context.fetchIssuesBySubjectQuery("https://redmine.example", "fixture", "DEMO-1"),
    /pagination did not advance/
  );
});
test("lookup never accepts an HTML hit without paginated ambiguity checks", async () => {
  const context = createExtractor();
  context.URLSearchParams = URLSearchParams;
  context.buildRedmineUrl = (domain, pathname) => new URL(pathname, domain).href;
  context.safeReadJson = (response) => response.json();
  context.fetchRedmineSearchHtml = async () => {
    throw new Error("HTML must not be used");
  };
  context.timeoutFetch = async (url) => {
    const offset = Number(new URL(url).searchParams.get("offset"));
    return {
      ok: true,
      json: async () => ({ issues: [{ id: offset + 1, subject: "DEMO-1 Match" }], total_count: 2 }),
    };
  };
  assert.equal(
    await context.findRedmineIssue("https://redmine.example", "fixture", "DEMO-1"),
    null
  );
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

test("pickBestRedmineSearchResult rejects unrelated tracker matches when text is too weak", () => {
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

  assert.equal(picked, null);
});

test("lookup compares complete issue keys and refuses tied candidates", () => {
  const { pickBestRedmineSearchResult: pick, normalizeLoose } = createExtractor();
  const key = normalizeLoose("HIPE_B2R-1");
  assert.equal(
    pick([{ id: 10, subject: "HIPE_B2R-10 Same title" }], key, normalizeLoose("Same title")),
    null
  );
  assert.equal(
    pick(
      [
        { id: 1, subject: "[HIPE_B2R-1] First" },
        { id: 10, subject: "HIPE_B2R-10 Other" },
      ],
      key,
      ""
    ).id,
    1
  );
  assert.equal(
    pick(
      [
        { id: 1, subject: "HIPE_B2R-1 First" },
        { id: 2, subject: "HIPE_B2R-1 Second" },
      ],
      key,
      ""
    ),
    null
  );
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
