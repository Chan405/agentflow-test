const http = require("http");
const { fakeAgent } = require("./fake-agent");

const PORT = 3001;

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/agent") {
    sendJson(res, 404, { error: "Unsupported route" });
    return;
  }

  let parsed;

  try {
    parsed = JSON.parse(await readBody(req));
  } catch (error) {
    sendJson(res, 400, { error: "Invalid JSON" });
    return;
  }

  const result = await fakeAgent(parsed && parsed.message);
  sendJson(res, 200, result);
});

server.listen(PORT, () => {
  console.log(`Mock agent server listening on http://localhost:${PORT}`);
});
