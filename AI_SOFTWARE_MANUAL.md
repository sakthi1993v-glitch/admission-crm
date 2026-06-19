# Admission Follow-up CRM - AI Handoff Manual

This manual explains the current software so another AI/developer can understand, maintain, and extend it.

## 1. Software Purpose

This is a small office CRM for an education/admission consulting workflow.

The office setup is:
- One manager has a laptop.
- Around 10 staff members use mobile phones.
- Manager uploads/adds student lead data.
- Staff call students and update follow-up status from mobile.
- Manager checks daily performance, missed follow-ups, visit expected students, and admission count.

The manager laptop acts as both:
- Web server
- Local database host

Staff mobiles connect to the manager laptop through the same Wi-Fi network.

## 2. Current Tech Stack

No external npm packages are used.

Files:
- `server.js` - Node.js HTTP server and API.
- `index.html` - Full frontend UI, CSS, and browser JavaScript.
- `data.json` - Local JSON database.
- `package.json` - npm start script.
- `start-crm.bat` - Windows launcher for manager laptop.
- `stop-crm.bat` - Stops server running on port 3000.
- `install-mobile-app.html` - Simple mobile install instructions.

Runtime:
- Node.js
- Browser on manager laptop
- Mobile Chrome/browser for staff

## 3. How To Run

From the project folder:

```powershell
cd "C:\Users\sakth\Documents\auto bot"
npm start
```

Recommended manager workflow:

1. Double click `start-crm.bat`.
2. Keep the black command window open.
3. Manager opens `http://localhost:3000`.
4. Staff mobiles open the LAN URL shown in the command window, for example `http://192.168.1.4:3000`.
5. All devices must be on the same Wi-Fi network.

To stop:

```powershell
stop-crm.bat
```

## 4. User Roles

The frontend has a role selector:

### Manager
Manager can:
- Add student lead.
- Import CSV.
- Export CSV.
- Reset demo data.
- View all staff leads.
- View staff-wise report.

### Staff
Staff can:
- Select their staff name.
- See only their assigned students.
- Call student.
- Open WhatsApp chat.
- Update call result and next follow-up.

There is no password login yet. Current role selection is only a UI filter.

## 5. Main Screens

Tabs in `index.html`:

- `Today Calls` - students whose `nextDate` is today.
- `Call Later` - students marked as `Call Later`.
- `Visit Expected` - students marked as `Coming to College` or `Visited`.
- `Hot Leads` - students with `interestLevel` as `Hot`.
- `Missed` - students whose `nextDate` is older than today and not admitted.
- `Manager` - staff-wise report.

## 6. Student Data Schema

Each student lead in `data.json` has this structure:

```json
{
  "id": 1,
  "student": "Arun Kumar",
  "phone": "919876543210",
  "area": "Salem",
  "group": "Bio Maths",
  "cutoff": 186.5,
  "community": "MBC",
  "firstGraduate": "Yes",
  "course": "B.Tech CSE",
  "college": "ABC Engineering College",
  "staff": "Priya",
  "callResult": "Call Later",
  "interestLevel": "Hot",
  "lastCall": "2026-06-19",
  "nextDate": "2026-06-19",
  "nextTime": "18:00",
  "visitDate": "",
  "admissionDoneDate": "",
  "callsDone": 3,
  "notes": "Parent wants fee details."
}
```

Important fields:
- `staff` controls staff assignment.
- `callResult` controls workflow status.
- `nextDate` and `nextTime` control follow-up list.
- `admissionDoneDate` controls admission reporting.
- `interestLevel` controls hot lead list.

## 7. Call Result Options

Current frontend options:
- `New Lead`
- `Interested`
- `Call Later`
- `No Response`
- `Not Interested`
- `Parent Need to Speak`
- `Coming to College`
- `Visited`
- `Admission Done`

Behavior:
- `Call Later` sets next date/time for follow-up.
- `Coming to College` marks the lead as a visit expected lead.
- `Admission Done` sets `admissionDoneDate`.

## 8. API Endpoints

Defined in `server.js`.

### GET `/api/leads`
Returns all student leads.

### POST `/api/leads`
Creates a new lead.

Body example:

```json
{
  "student": "New Student",
  "phone": "9876543210",
  "area": "Salem",
  "staff": "Priya",
  "group": "Computer Science",
  "cutoff": 170,
  "community": "BC",
  "firstGraduate": "Yes",
  "course": "BCA",
  "college": "City College",
  "notes": "Interested"
}
```

### PUT `/api/leads/:id`
Updates an existing lead.

### POST `/api/import`
Imports multiple leads.

Body:

```json
{
  "leads": [
    {
      "student": "Arun",
      "phone": "9876543210",
      "staff": "Priya"
    }
  ]
}
```

### POST `/api/reset`
Resets `data.json` to demo seed data.

## 9. CSV Import Format

Recommended CSV columns:

```csv
student,phone,area,staff,group,cutoff,community,firstGraduate,course,college,notes
Arun Kumar,9876543210,Salem,Priya,Bio Maths,186.5,MBC,Yes,B.Tech CSE,ABC College,Evening call
```

The import also accepts fallback names such as:
- `name` for `student`
- `mobile` for `phone`
- `district` for `area`
- `assignedStaff` for `staff`
- `cutoffMark` for `cutoff`
- `interestedCourse` for `course`
- `interestedCollege` for `college`

## 10. Networking Model

The server listens on:

```js
server.listen(port, "0.0.0.0")
```

This allows other devices on the same Wi-Fi to connect.

Manager laptop:

```text
http://localhost:3000
```

Staff mobile:

```text
http://<manager-laptop-ip>:3000
```

If mobile cannot connect:
- Make sure laptop and mobile are on same Wi-Fi.
- Make sure `start-crm.bat` window is open.
- Allow Node.js in Windows Firewall for private networks.
- Check whether laptop IP changed.

## 11. Current Limitations

This is a practical local-office version, not a full cloud product.

Limitations:
- No password authentication yet.
- No separate database engine; data is stored in `data.json`.
- No multi-office/cloud access.
- No automatic WhatsApp sending.
- No user activity audit log.
- No backup automation yet.
- If manager laptop is off, staff cannot access the system.
- If command window is closed, the app stops.

## 12. Suggested Next Improvements

Priority order:

1. Add real login:
   - Manager username/password.
   - Staff username/password.
   - Staff can see only assigned leads.

2. Add daily backup:
   - Auto-copy `data.json` to `backups/YYYY-MM-DD-data.json`.

3. Add lead assignment tools:
   - Bulk assign to staff.
   - Round-robin assignment.
   - Reassign lead.

4. Add reports:
   - Daily staff report.
   - Admission report.
   - Missed follow-up report.
   - CSV/PDF export.

5. Improve database:
   - Move from JSON file to SQLite.

6. Create desktop app:
   - Electron/Tauri wrapper for manager laptop.

7. Create mobile app:
   - PWA first.
   - Later Android APK if required.

8. Add WhatsApp Business integration:
   - Only through official WhatsApp Business API.
   - Consent and templates required.

## 13. Important Development Notes

- Keep the UI mobile-first because staff use phones.
- Manager tools should stay visible only in Manager mode.
- Avoid large tables for staff mobile; use cards.
- Keep update form short because staff update after every call.
- Do not use unofficial WhatsApp automation.
- Preserve `data.json` before changing schema.

## 14. Quick Mental Model For Another AI

Think of this app as:

```text
Manager Laptop = Local Server + Database + Manager Dashboard
Staff Mobile = Browser client connected through Wi-Fi
data.json = Shared local database
index.html = Complete CRM frontend
server.js = API + static file server
```

The core business goal is:

```text
Make sure staff call assigned students, update call result, set next follow-up, bring students to college, and let manager track missed work and admission conversion.
```
