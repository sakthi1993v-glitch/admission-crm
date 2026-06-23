const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");

// Load .env if present
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  });
}

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

const port = Number(process.env.PORT || 3000);
const root = process.env.CRM_DATA_DIR || (process.pkg ? path.dirname(process.execPath) : __dirname);
const dbPath = path.join(root, "data.json");

// Copy seed data.json to volume if missing or FORCE_SEED=1
if (process.env.CRM_DATA_DIR && (!fs.existsSync(dbPath) || process.env.FORCE_SEED === "1")) {
  const seedPath = path.join(__dirname, "data.json");
  if (fs.existsSync(seedPath)) {
    try {
      if (!fs.existsSync(process.env.CRM_DATA_DIR)) fs.mkdirSync(process.env.CRM_DATA_DIR, { recursive: true });
      fs.copyFileSync(seedPath, dbPath);
      console.log("Seeded data.json to volume.");
    } catch (e) {
      console.error("Seed failed:", e.message);
    }
  }
}

const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"));

function defaultConfig() {
  return {
    managerUsername: process.env.MANAGER_USERNAME || "abirami",
    managerPassword: process.env.MANAGER_PASSWORD || "",
    branchId: "mannargudi",
    branchName: "Mannargudi Branch",
    staffList: [],
    callResultOptions: ["New Lead","Interested","Call Later","No Response","Not Interested","Parent Need to Speak","Coming to College","Visited","Admission Done"],
    branch2: {
      branchId: "trichy",
      branchName: "Trichy Branch",
      managerUsername: process.env.BRANCH2_MANAGER_USERNAME || "sneka",
      managerPassword: process.env.BRANCH2_MANAGER_PASSWORD || "",
      staffList: [],
      callResultOptions: ["New Lead","Interested","Call Later","No Response","Not Interested","Parent Need to Speak","Coming to College","Visited","Admission Done"]
    }
  };
}

function getBranchConfig(config, branchId) {
  if (branchId === "trichy") {
    const b2 = config.branch2 || {};
    return {
      branchId: "trichy",
      branchName: b2.branchName || "Trichy Branch",
      managerUsername: b2.managerUsername || "sneka",
      managerPassword: b2.managerPassword || "6107",
      staffList: b2.staffList || [],
      callResultOptions: b2.callResultOptions || config.callResultOptions || [],
      theme: b2.theme || config.theme || "A",
      globalNotice: b2.globalNotice || null,
      annaMessage: b2.annaMessage || null,
      annaMessageReplies: b2.annaMessageReplies || {},
      staffNotes: b2.staffNotes || {},
      managerWidgets: b2.managerWidgets || null
    };
  }
  const { branch2, ...main } = config;
  return main;
}

const seedLeads = [
  {
    id: 1,
    student: "Arun Kumar",
    phone: "919876543210",
    area: "Salem",
    group: "Bio Maths",
    cutoff: 186.5,
    community: "MBC",
    firstGraduate: "Yes",
    course: "B.Tech CSE",
    college: "ABC Engineering College",
    staff: "Priya",
    callResult: "Call Later",
    interestLevel: "Hot",
    lastCall: "",
    nextDate: todayIso(),
    nextTime: "18:00",
    visitDate: "",
    admissionDoneDate: "",
    callsDone: 3,
    notes: "Parent wants fee details. Evening call requested."
  },
  {
    id: 2,
    student: "Meena S",
    phone: "919812345678",
    area: "Namakkal",
    group: "Computer Science",
    cutoff: 174,
    community: "BC",
    firstGraduate: "No",
    course: "B.Sc Computer Science",
    college: "City Arts College",
    staff: "Rahul",
    callResult: "Coming to College",
    interestLevel: "Hot",
    lastCall: todayIso(),
    nextDate: todayIso(),
    nextTime: "11:30",
    visitDate: todayIso(),
    admissionDoneDate: "",
    callsDone: 2,
    notes: "Student and father coming today."
  }
];

ensureDb();

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/info" && req.method === "GET") {
      return sendJson(res, { addresses: localAddresses(), port });
    }

    if (url.pathname === "/api/staff-list" && req.method === "GET") {
      const db = readDb();
      const config = db.config || defaultConfig();
      const branchId = url.searchParams.get("branch") || "mannargudi";
      const bc = getBranchConfig(config, branchId);
      return sendJson(res, bc.staffList.map((s) => s.name));
    }

    if (url.pathname === "/api/login" && req.method === "POST") {
      const body = await readJsonBody(req);
      const db = readDb();
      const config = db.config || defaultConfig();
      const branchId = body.branch || "mannargudi";
      const bc = getBranchConfig(config, branchId);

      if (body.role === "manager") {
        const ok = body.password === bc.managerPassword && body.username === bc.managerUsername;
        return sendJson(res, { ok, branch: branchId, branchName: bc.branchName }, ok ? 200 : 401);
      }

      if (body.role === "staff") {
        const staffEntry = bc.staffList.find((s) => s.name === body.name);
        const ok = Boolean(staffEntry && staffEntry.pin === body.pin);
        return sendJson(res, { ok, branch: branchId, branchName: bc.branchName }, ok ? 200 : 401);
      }

      return sendJson(res, { ok: false }, 400);
    }

    if (url.pathname === "/api/config" && req.method === "GET") {
      const db = readDb();
      const config = db.config || defaultConfig();
      const branchId = url.searchParams.get("branch") || "mannargudi";
      return sendJson(res, getBranchConfig(config, branchId));
    }

    if (url.pathname === "/api/config" && req.method === "PUT") {
      const body = await readJsonBody(req);
      const branchId = url.searchParams.get("branch") || "mannargudi";
      const db = readDb();
      if (!db.config) db.config = defaultConfig();

      // --- Branch isolation guards (prevent one branch overwriting another's config) ---
      // 1. If body carries a branchId for a different branch, reject.
      if (body.branchId && body.branchId !== branchId) {
        return sendJson(res, { error: `branch mismatch: body branchId "${body.branchId}" != "${branchId}"` }, 400);
      }
      // 2. If body's branchName clearly belongs to the OTHER branch, reject.
      const otherName = branchId === "trichy" ? "Mannargudi Branch" : "Trichy Branch";
      if (body.branchName && body.branchName.trim() === otherName) {
        return sendJson(res, { error: `branch mismatch: refusing to write "${otherName}" config into "${branchId}"` }, 400);
      }
      // 3. Empty/missing staffList must NOT wipe an existing non-empty staffList.
      const existing = branchId === "trichy" ? (db.config.branch2 || {}) : db.config;
      const safeBody = { ...body };
      if ((!Array.isArray(safeBody.staffList) || safeBody.staffList.length === 0)
          && Array.isArray(existing.staffList) && existing.staffList.length > 0) {
        delete safeBody.staffList; // keep existing staff
      }

      // --- Merge (never wholesale-replace) so unspecified keys survive ---
      if (branchId === "trichy") {
        db.config.branch2 = { ...db.config.branch2, ...safeBody };
      } else {
        const branch2 = db.config.branch2;
        db.config = { ...db.config, ...safeBody, branch2 };
      }
      writeDb(db);
      return sendJson(res, getBranchConfig(db.config, branchId));
    }

    if (url.pathname === "/api/reassign-leads" && req.method === "POST") {
      const { from, to } = await readJsonBody(req);
      if (!from || !to) return sendJson(res, { error: "from/to required" }, 400);
      const db = readDb();
      let count = 0;
      db.leads.forEach((lead) => { if (lead.staff === from) { lead.staff = to; count++; } });
      writeDb(db);
      return sendJson(res, { reassigned: count });
    }

    if (url.pathname === "/api/notice" && req.method === "PUT") {
      const body = await readJsonBody(req);
      const branchId = url.searchParams.get("branch") || "mannargudi";
      const db = readDb();
      if (!db.config) db.config = defaultConfig();
      if (branchId === "trichy") {
        if (!db.config.branch2) db.config.branch2 = {};
        if (body.text && body.text.trim()) {
          db.config.branch2.globalNotice = { text: body.text.trim(), publishedAt: new Date().toISOString() };
        } else {
          delete db.config.branch2.globalNotice;
        }
      } else {
        if (body.text && body.text.trim()) {
          db.config.globalNotice = { text: body.text.trim(), publishedAt: new Date().toISOString() };
        } else {
          delete db.config.globalNotice;
        }
      }
      writeDb(db);
      return sendJson(res, { ok: true });
    }

    if (url.pathname.startsWith("/api/staff-note/") && req.method === "PUT") {
      const name = decodeURIComponent(url.pathname.slice("/api/staff-note/".length));
      const body = await readJsonBody(req);
      const db = readDb();
      if (!db.config) db.config = defaultConfig();
      if (!db.config.staffNotes) db.config.staffNotes = {};
      if (body.text && body.text.trim()) {
        db.config.staffNotes[name] = { text: body.text.trim(), sentAt: new Date().toISOString() };
      } else {
        delete db.config.staffNotes[name];
      }
      writeDb(db);
      return sendJson(res, { ok: true });
    }

    // Daily Tasks
    if (url.pathname === "/api/tasks" && req.method === "GET") {
      const db = readDb();
      return sendJson(res, db.dailyTasks || {});
    }

    if (url.pathname.startsWith("/api/tasks/") && req.method === "GET") {
      const parts = url.pathname.split("/").filter(Boolean); // ['api','tasks',staff,date]
      const staff = decodeURIComponent(parts[2] || "");
      const date  = parts[3] || "";
      const db = readDb();
      const tasks = (db.dailyTasks && db.dailyTasks[staff] && db.dailyTasks[staff][date]) || [];
      return sendJson(res, tasks);
    }

    if (url.pathname.startsWith("/api/tasks/") && req.method === "PUT") {
      const parts = url.pathname.split("/").filter(Boolean);
      const staff = decodeURIComponent(parts[2] || "");
      const date  = parts[3] || "";
      const body  = await readJsonBody(req);
      const db = readDb();
      if (!db.dailyTasks) db.dailyTasks = {};
      if (!db.dailyTasks[staff]) db.dailyTasks[staff] = {};
      db.dailyTasks[staff][date] = (body.tasks || []).map((t, i) => ({
        id: t.id ?? i + 1, text: t.text || "", done: !!t.done
      }));
      writeDb(db);
      return sendJson(res, db.dailyTasks[staff][date]);
    }

    if (url.pathname.startsWith("/api/tasks/") && req.method === "PATCH") {
      const parts = url.pathname.split("/").filter(Boolean); // ['api','tasks',staff,date,id]
      const staff  = decodeURIComponent(parts[2] || "");
      const date   = parts[3] || "";
      const taskId = Number(parts[4]);
      const body   = await readJsonBody(req);
      const db = readDb();
      const list = db.dailyTasks && db.dailyTasks[staff] && db.dailyTasks[staff][date];
      if (!list) return sendJson(res, { error: "Not found" }, 404);
      const task = list.find(t => t.id === taskId);
      if (!task) return sendJson(res, { error: "Task not found" }, 404);
      task.done = !!body.done;
      writeDb(db);
      return sendJson(res, task);
    }

    if (url.pathname === "/api/leads" && req.method === "GET") {
      const db = readDb();
      const branchId = url.searchParams.get("branch");
      if (branchId) {
        return sendJson(res, db.leads.filter(l => (l.branch || "mannargudi") === branchId));
      }
      return sendJson(res, db.leads);
    }

    if (url.pathname === "/api/leads" && req.method === "POST") {
      const lead = await readJsonBody(req);
      const db = readDb();
      const id = db.leads.length ? Math.max(...db.leads.map((item) => Number(item.id) || 0)) + 1 : 1;
      const nextLead = normalizeLead({ ...lead, id, branch: lead.branch || "mannargudi" });
      db.leads.unshift(nextLead);
      writeDb(db);
      return sendJson(res, nextLead, 201);
    }

    if (url.pathname.startsWith("/api/leads/") && req.method === "PUT") {
      const id = Number(url.pathname.split("/").pop());
      const patch = await readJsonBody(req);
      const db = readDb();
      const index = db.leads.findIndex((lead) => Number(lead.id) === id);

      if (index === -1) return sendJson(res, { error: "Lead not found" }, 404);

      db.leads[index] = normalizeLead({ ...db.leads[index], ...patch, id });
      writeDb(db);
      return sendJson(res, db.leads[index]);
    }

    if (url.pathname.startsWith("/api/leads/") && req.method === "DELETE") {
      const id = Number(url.pathname.split("/").pop());
      const db = readDb();
      const index = db.leads.findIndex((lead) => Number(lead.id) === id);
      if (index === -1) return sendJson(res, { error: "Lead not found" }, 404);
      db.leads.splice(index, 1);
      writeDb(db);
      return sendJson(res, { ok: true });
    }

    if (url.pathname === "/api/import" && req.method === "POST") {
      const body = await readJsonBody(req);
      const db = readDb();
      const imported = Array.isArray(body.leads) ? body.leads : [];
      let nextId = db.leads.length ? Math.max(...db.leads.map((item) => Number(item.id) || 0)) + 1 : 1;
      const mapped = imported
        .map((lead) => normalizeLead({ ...lead, id: nextId++ }))
        .filter((lead) => lead.student && lead.phone);
      db.leads = mapped.concat(db.leads);
      writeDb(db);
      return sendJson(res, { imported: mapped.length });
    }

    if (url.pathname === "/api/ai" && req.method === "POST") {
      const body = await readJsonBody(req);
      const { prompt } = body;
      if (!prompt) return sendJson(res, { error: "No prompt" }, 400);
      if (!GROQ_API_KEY) return sendJson(res, { error: "AI not configured" }, 503);
      try {
        const text = await callGroqText(prompt);
        return sendJson(res, { text });
      } catch (e) {
        return sendJson(res, { error: e.message }, 500);
      }
    }

    if (url.pathname === "/api/tts" && req.method === "GET") {
      const text = url.searchParams.get("text") || "";
      const lang = url.searchParams.get("lang") || "en-in";
      if (!text) return sendJson(res, { error: "No text" }, 400);
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 200))}&tl=${lang}&client=tw-ob`;
      const ttsReq = https.get(ttsUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, (ttsRes) => {
        res.writeHead(200, {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*"
        });
        ttsRes.pipe(res);
      });
      ttsReq.on("error", () => sendJson(res, { error: "TTS failed" }, 500));
      return;
    }

    if (url.pathname === "/api/scan-photo" && req.method === "POST") {
      const body = await readJsonBody(req);
      const { imageBase64, mimeType = "image/jpeg" } = body;
      if (!imageBase64) return sendJson(res, { error: "No image" }, 400);

      const prompt = `This is a handwritten notes page from a college admission staff member in India.
Extract ALL student leads from this image. For each student, identify:
- name (student name)
- phone (mobile number, 10 digits)
- area (city/town/village)
- group (12th standard group: Bio Maths, Computer Science, Commerce, Arts, Pure Science, Vocational)
- community (OC/BC/BCM/MBC/SC/SCA/ST)
- firstGraduate (Yes/No/Not Sure)
- course (interested course: B.Tech, MBBS, B.Sc, BCA, B.Com, BA, etc.)
- college (interested college name if mentioned)
- callResult (based on feedback: "Interested", "Not Interested", "Call Later", "Coming to College", "Admission Done")
- category (one of: Interested, Not Interested, Engineering, Medical, Arts, Counselling, Joined)
- notes (any other feedback or remarks)

Category rules:
- "Interested" or follow up needed → category: Interested
- "Not interested", "not coming" → category: Not Interested
- Engineering college joined or interested → category: Engineering
- Medical/MBBS/Nursing → category: Medical
- Arts/BA/B.Com → category: Arts
- "Counselling pakkanum", "doubt iruku", "decide pannala" → category: Counselling
- Already joined somewhere → category: Joined

IMPORTANT: Return ONLY a raw JSON array. No explanation, no markdown, no code blocks. Start your response with [ and end with ].
Example: [{"name":"Arun","phone":"9876543210","area":"Salem","group":"Bio Maths","community":"MBC","firstGraduate":"Yes","course":"B.Tech","college":"","callResult":"Interested","category":"Interested","notes":""}]

If a field is not mentioned, use empty string "". Extract ALL students visible in the notes.`;

      try {
        const result = await callGemini(imageBase64, mimeType, prompt);
        console.log("[scan] AI raw response:", result.slice(0, 500));
        // Try direct JSON parse first
        const trimmed = result.trim();
        if (trimmed.startsWith("[")) {
          try { return sendJson(res, { leads: JSON.parse(trimmed) }); } catch (e) { /* fall through */ }
        }
        // Greedy match — find outermost [...] (last ] in response)
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const leads = JSON.parse(jsonMatch[0]);
            return sendJson(res, { leads });
          } catch (e) { /* fall through */ }
        }
        // Try extracting JSON from code blocks
        const codeBlock = result.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlock) {
          const inner = codeBlock[1].trim();
          const arr = inner.startsWith("[") ? inner : `[${inner}]`;
          try {
            const leads = JSON.parse(arr);
            return sendJson(res, { leads });
          } catch (e) { /* fall through */ }
        }
        console.error("[scan] Parse failed. Full response:", result);
        return sendJson(res, { error: "AI response parse panla. Again try பண்ணுங்க.", raw: result.slice(0, 500) }, 500);
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    if (url.pathname === "/api/reset" && req.method === "POST") {
      const db = readDb();
      writeDb({ leads: seedLeads, config: db.config || defaultConfig() });
      return sendJson(res, { reset: true });
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    sendJson(res, { error: "Server error" }, 500);
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use.`);
    return;
  }
  console.error(error);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Admission CRM running on http://localhost:${port}`);
  for (const address of localAddresses()) {
    console.log(`Mobile access: http://${address}:${port}`);
  }
});

function serveStatic(pathname, res) {
  if (pathname === "/" || pathname === "/index.html") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache"
    });
    res.end(indexHtml);
    return;
  }
  res.writeHead(404);
  res.end("Not found");
}

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    writeDb({ leads: seedLeads, config: defaultConfig() });
    return;
  }
  const db = readDb();
  if (!db.config) {
    db.config = defaultConfig();
    writeDb(db);
  }
}

function readDb() {
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function normalizeLead(lead) {
  return {
    id: Number(lead.id),
    student: String(lead.student || lead.name || "").trim(),
    phone: normalizePhone(lead.phone || lead.mobile || ""),
    area: String(lead.area || lead.district || "").trim(),
    group: String(lead.group || lead.twelfthGroup || "Computer Science").trim(),
    cutoff: Number(lead.cutoff || lead.cutoffMark || 0),
    community: String(lead.community || "BC").trim(),
    firstGraduate: String(lead.firstGraduate || "Not Sure").trim(),
    course: String(lead.course || lead.interestedCourse || "").trim(),
    college: String(lead.college || lead.interestedCollege || "Not decided").trim(),
    staff: String(lead.staff || lead.assignedStaff || "Unassigned").trim(),
    callResult: String(lead.callResult || "New Lead").trim(),
    interestLevel: String(lead.interestLevel || "Warm").trim(),
    lastCall: String(lead.lastCall || "").trim(),
    nextDate: String(lead.nextDate || todayIso()).trim(),
    nextTime: String(lead.nextTime || "10:00").trim(),
    visitDate: String(lead.visitDate || "").trim(),
    admissionDoneDate: String(lead.admissionDoneDate || "").trim(),
    callsDone: Number(lead.callsDone || 0),
    notes: String(lead.notes || "").trim(),
    totalFee: Number(lead.totalFee || 0),
    feePaid: Number(lead.feePaid || 0),
    feeStatus: String(lead.feeStatus || "Pending").trim(),
    paymentDate: String(lead.paymentDate || "").trim()
  };
}

function normalizePhone(value) {
  const digits = String(value).replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 15_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, value, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function callGroqText(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024
    });
    const options = {
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Length": Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (r) => {
      let data = "";
      r.on("data", (chunk) => { data += chunk; });
      r.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { reject(new Error(parsed.error.message)); return; }
          resolve(parsed.choices?.[0]?.message?.content || "");
        } catch (e) { reject(new Error("Parse error")); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function callGemini(imageBase64, mimeType, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
        ]
      }],
      max_tokens: 4096
    });

    const options = {
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Length": Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (r) => {
      let data = "";
      r.on("data", (chunk) => { data += chunk; });
      r.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { reject(new Error(parsed.error.message)); return; }
          const text = parsed.choices?.[0]?.message?.content || "";
          resolve(text);
        } catch (e) { reject(new Error("Groq parse error: " + data)); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}
