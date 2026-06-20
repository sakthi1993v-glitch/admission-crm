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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const port = Number(process.env.PORT || 3000);
const root = process.env.CRM_DATA_DIR || (process.pkg ? path.dirname(process.execPath) : __dirname);
const dbPath = path.join(root, "data.json");
const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"));

function defaultConfig() {
  return {
    managerPassword: "admin123",
    staffList: [
      { name: "Priya", pin: "1234" },
      { name: "Rahul", pin: "1234" },
      { name: "Karthik", pin: "1234" }
    ]
  };
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
      return sendJson(res, config.staffList.map((s) => s.name));
    }

    if (url.pathname === "/api/login" && req.method === "POST") {
      const body = await readJsonBody(req);
      const db = readDb();
      const config = db.config || defaultConfig();

      if (body.role === "manager") {
        const ok = body.password === config.managerPassword;
        return sendJson(res, { ok }, ok ? 200 : 401);
      }

      if (body.role === "staff") {
        const staffEntry = config.staffList.find((s) => s.name === body.name);
        const ok = Boolean(staffEntry && staffEntry.pin === body.pin);
        return sendJson(res, { ok }, ok ? 200 : 401);
      }

      return sendJson(res, { ok: false }, 400);
    }

    if (url.pathname === "/api/config" && req.method === "GET") {
      const db = readDb();
      return sendJson(res, db.config || defaultConfig());
    }

    if (url.pathname === "/api/config" && req.method === "PUT") {
      const body = await readJsonBody(req);
      const db = readDb();
      db.config = body;
      writeDb(db);
      return sendJson(res, db.config);
    }

    if (url.pathname === "/api/leads" && req.method === "GET") {
      return sendJson(res, readDb().leads);
    }

    if (url.pathname === "/api/leads" && req.method === "POST") {
      const lead = await readJsonBody(req);
      const db = readDb();
      const id = db.leads.length ? Math.max(...db.leads.map((item) => Number(item.id) || 0)) + 1 : 1;
      const nextLead = normalizeLead({ ...lead, id });
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

Return ONLY a JSON array like:
[{"name":"...","phone":"...","area":"...","group":"...","community":"...","firstGraduate":"...","course":"...","college":"...","callResult":"...","category":"...","notes":"..."}]

If a field is not mentioned, use empty string "". Extract ALL students visible in the notes.`;

      try {
        const result = await callGemini(imageBase64, mimeType, prompt);
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return sendJson(res, { error: "Could not parse response", raw: result }, 500);
        const leads = JSON.parse(jsonMatch[0]);
        return sendJson(res, { leads });
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
      if (body.length > 5_000_000) req.destroy();
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

function callGemini(imageBase64, mimeType, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]
      }]
    });

    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    };

    const req = https.request(options, (r) => {
      let data = "";
      r.on("data", (chunk) => { data += chunk; });
      r.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
          resolve(text);
        } catch (e) { reject(new Error("Gemini parse error: " + data)); }
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
