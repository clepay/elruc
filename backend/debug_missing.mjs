const loginResp = await fetch("http://127.0.0.1:3002/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "clepay", password: "0021071980gC" })
});
const cookies = loginResp.headers.get("set-cookie");
const t = cookies?.match(/admin_token=([^;]+)/)?.[1];
if (t) {
  const opts = { headers: { "Cookie": "admin_token=" + t } };
  const r = await fetch("http://127.0.0.1:3002/api/admin/debug/compare/missing?page=1&limit=5", opts);
  const text = await r.text();
  console.log("Status:", r.status);
  console.log("Response:", text);
}
