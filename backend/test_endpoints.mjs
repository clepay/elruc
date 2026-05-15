const resp = await fetch("http://127.0.0.1:3002/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "admin" })
});
const cookies = resp.headers.get("set-cookie");
console.log("Login status:", resp.status);
console.log("Set-Cookie:", cookies);

const tokenMatch = cookies?.match(/admin_token=([^;]+)/);
if (tokenMatch) {
  const token = tokenMatch[1];
  
  // Test /compare/missing
  console.log("\n--- Testing /compare/missing ---");
  const r1 = await fetch("http://127.0.0.1:3002/api/admin/debug/compare/missing?page=1&limit=5", {
    headers: { "Cookie": `admin_token=${token}` }
  });
  const j1 = await r1.json();
  console.log("Status:", r1.status, "Total missing:", j1.total, "Page:", j1.page, "Records:", j1.missing?.length);

  // Test /compare/diff
  console.log("\n--- Testing /compare/diff ---");
  const r2 = await fetch("http://127.0.0.1:3002/api/admin/debug/compare/diff?page=1&limit=5", {
    headers: { "Cookie": `admin_token=${token}` }
  });
  const j2 = await r2.json();
  console.log("Status:", r2.status, "Diffs:", j2.differences?.length, "Page:", j2.page);

  // Test /compare/all
  console.log("\n--- Testing /compare/all ---");
  const r3 = await fetch("http://127.0.0.1:3002/api/admin/debug/compare/all?page=1&limit=5&filter=all", {
    headers: { "Cookie": `admin_token=${token}` }
  });
  const j3 = await r3.json();
  console.log("Status:", r3.status, "Records:", j3.records?.length, "Total:", j3.total, "Summary:", JSON.stringify(j3.summary));
} else {
  console.log("No token found in response");
}
