const loginResp = await fetch("http://127.0.0.1:3002/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "clepay", password: "0021071980gC" })
});
const cookies = loginResp.headers.get("set-cookie");
const t = cookies?.match(/admin_token=([^;]+)/)?.[1];
console.log("Login:", loginResp.status, "Token:", t ? "OK" : "FAIL");

if (t) {
  const opts = { headers: { "Cookie": "admin_token=" + t } };

  // 1. /compare/missing
  console.time("missing");
  const r1 = await fetch("http://127.0.0.1:3002/api/admin/debug/compare/missing?page=1&limit=5", opts);
  const j1 = await r1.json();
  console.timeEnd("missing");
  console.log("/missing:", r1.status, "total:", j1.total, "page:", j1.page, "records:", j1.missing?.length, JSON.stringify(j1.missing?.[0] || {}));

  // 2. /compare/diff
  console.time("diff");
  const r2 = await fetch("http://127.0.0.1:3002/api/admin/debug/compare/diff?page=1&limit=5", opts);
  const j2 = await r2.json();
  console.timeEnd("diff");
  console.log("/diff:", r2.status, "diffs:", j2.differences?.length, "page:", j2.page, JSON.stringify(j2.differences?.[0] || {}));

  // 3. /compare/all
  console.time("all");
  const r3 = await fetch("http://127.0.0.1:3002/api/admin/debug/compare/all?page=1&limit=5&filter=all", opts);
  const j3 = await r3.json();
  console.timeEnd("all");
  console.log("/all:", r3.status, "records:", j3.records?.length, "total:", j3.total, "summary:", JSON.stringify(j3.summary), JSON.stringify(j3.records?.[0] || {}));
}
