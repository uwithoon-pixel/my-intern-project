# คู่มือติดตั้ง — ระบบแบบสอบถามความพึงพอใจ (เชื่อม Google Sheets)

## โครงสร้างไฟล์
```
deploy/
├── index.html          ← หน้าแอปหลัก (เหมือนเดิมทุกอย่าง แค่เปลี่ยนวิธีเก็บข้อมูล)
├── package.json        ← ประกาศ dependency (google-auth-library)
└── api/
    ├── submit.js        ← รับคำตอบจากนักศึกษา → เขียนลง Google Sheet
    └── results.js       ← อ่านข้อมูลทั้งหมด → ส่งให้แดชบอร์ด (ต้องมี PIN ถูกต้อง)
```

## ขั้นตอนติดตั้งบน Vercel

### 1. Push ไฟล์ทั้งหมดขึ้น GitHub repo ที่ต่อกับ Vercel อยู่แล้ว
เอาไฟล์ทั้ง 4 ไฟล์ (`index.html`, `package.json`, `api/submit.js`, `api/results.js`) ไปแทนที่ของเดิมใน repo `my-intern-project` (หรือชื่อ repo ที่ใช้อยู่) แล้ว push ขึ้น GitHub — Vercel จะ deploy อัตโนมัติ

### 2. ตั้งค่า Environment Variables ใน Vercel
ไปที่ Vercel Dashboard → เลือกโปรเจกต์ → Settings → Environment Variables แล้วเพิ่ม 3 ตัวนี้:

| ชื่อตัวแปร | ค่าที่ใส่ |
|---|---|
| `GOOGLE_SHEET_ID` | `1N7gPsUjqJF8dxB5p4qu21jL9zfXyja_eG-xsN1BJVUs` |
| `GOOGLE_SERVICE_ACCOUNT` | เนื้อหาทั้งหมดของไฟล์ `.json` ที่ดาวน์โหลดมา (paste ทั้งไฟล์เป็น string เดียว) |
| `DASH_PIN` | `1817` (ไม่ใส่ก็ได้ ระบบจะใช้ 1817 เป็นค่าเริ่มต้นอัตโนมัติ) |

**วิธี copy เนื้อหาไฟล์ JSON:**
- เปิดไฟล์ `.json` ด้วย text editor (Notepad, VS Code ก็ได้)
- Select All → Copy
- Paste ลงในช่องค่า (value) ของตัวแปร `GOOGLE_SERVICE_ACCOUNT` ใน Vercel ตรงๆ ทั้งก้อน (หน้าตาจะเริ่มด้วย `{"type": "service_account", ...}`)

**สำคัญ:** เลือก scope เป็น **Production, Preview, Development** ทั้ง 3 อัน (หรืออย่างน้อย Production) เพื่อให้ใช้งานได้ตอน deploy จริง

### 3. Redeploy
หลังตั้งค่า environment variables เสร็จ ต้องกด **Redeploy** ที่ Vercel อีกครั้ง (ตัวแปรใหม่จะไม่มีผลกับ deployment เก่าที่ build ไปแล้ว) — ไปที่แท็บ Deployments → คลิก "..." ที่ deployment ล่าสุด → Redeploy

### 4. ทดสอบ
- เปิด `https://my-intern-project-eight.vercel.app/` → ควรเห็น QR code เหมือนเดิม
- สแกน QR ด้วยมือถือ (เครื่องอื่น หรือ 4G ก็ได้ ไม่ต้องใช้ WiFi เดียวกัน) → กรอกแบบสอบถาม → กดส่ง
- กลับมาที่เครื่องอาจารย์ → แท็บ "สถิติ" → ใส่ PIN `1817` → ควรเห็นคำตอบที่เพิ่งส่งไปแล้ว

ถ้าคำตอบไม่ขึ้น ลองกดปุ่ม "🔄 รีเฟรชข้อมูลล่าสุด" ที่มุมขวาบนของแดชบอร์ด (ข้อมูลไม่ auto-refresh เอง ต้องกดรีเฟรชหรือเข้าใหม่)

## Troubleshooting

| อาการ | สาเหตุที่เป็นไปได้ |
|---|---|
| ส่งแบบสอบถามแล้วขึ้น "ส่งไม่สำเร็จ" | เช็ค `GOOGLE_SERVICE_ACCOUNT` ว่า paste ครบทั้งไฟล์ JSON ไม่ขาด/ไม่เกิน หรือเช็คว่าแชร์สิทธิ์ Editor ให้อีเมล Service Account ใน Sheet แล้วจริง |
| ใส่ PIN ถูกแล้วขึ้น "เกิดข้อผิดพลาด" | เช็คชื่อแท็บใน Sheet ต้องเป็น `submissions` ตัวพิมพ์เล็กทั้งหมดเป๊ะๆ |
| ใส่ PIN ถูกแล้วไม่มีข้อมูลขึ้นเลย (แต่ไม่ error) | ปกติถ้ายังไม่มีใครส่งแบบสอบถามเลย ลองส่งแบบทดสอบเองดูก่อน |
| หน้าเว็บพังไปเลย | เช็ค `package.json` ถูก push ขึ้นไปด้วยหรือไม่ — Vercel ต้องเห็นไฟล์นี้ถึงจะติดตั้ง `google-auth-library` ให้ |

## หมายเหตุด้านความปลอดภัย
- ไฟล์ `.json` คีย์ของ Service Account **ห้าม commit ขึ้น GitHub** เด็ดขาด (ใส่แค่ใน Vercel Environment Variables เท่านั้น) — ถ้า repo เป็น public ยิ่งต้องระวัง
- ถ้าพลาด commit ไฟล์ JSON ขึ้น GitHub ไปแล้ว ให้รีบไปที่ Google Cloud Console → Service Account → ลบคีย์เก่าทิ้งแล้วสร้างใหม่ทันที
