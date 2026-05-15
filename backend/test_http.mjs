const loginResp = await fetch("http://127.0.0.1:3002/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "clepay", password: "0021071980gC" })
});
const cookies = loginResp.headers.get("set-cookie");
console.log("Login status:", loginResp.status);
const t = cookies?.match(/admin_token=([^;]+)/)?.[1];
console.log("Token:", t ? "OK" : "FAIL");

if (t) {
  const opts = { headers: { "Cookie": "admin_token=" + t } };

  const r1 = await fetch("http://127.0.0.1:3002/api/admin/debug/compare/missing?page=1&limit=5", opts);
  const j1 = await r1.json();
  console.log("\n/missing:", r1.status, "total:", j1.total, "records:", j1.missing?.length);

  const r2 = await fetch("http://127.0.0.1:3002/api/admin/debug/compare/diff?page=1&limit=5", opts);
  const j2 = await r2.json();
  console.log("/diff:", r2.status, "diffs:", j2.differences?.length);

  const r3 = await fetch("http://127.0.0.1:3002/api/admin/debug/compare/all?page=1&limit=5&filter=all", opts);
  const j3 = await r3.json();
  console.log("/all:", r3.status, "records:", j3.records?.length, "summary:", JSON.stringify(j3.summary));
}
