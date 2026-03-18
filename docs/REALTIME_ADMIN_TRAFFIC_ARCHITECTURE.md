# Realtime Admin Traffic Architecture

เอกสารนี้สรุปแนวทางทำหน้า “พื้นที่/ทราฟฟิก” ให้ใกล้เคียง realtime โดยไม่ทำให้ Firestore อ่านหนักและค่าใช้จ่ายพุ่ง

## ข้อสรุปสั้น

แนวทางที่เหมาะที่สุดสำหรับโปรเจ็กต์นี้คือ `hybrid`

- ใช้ `Cloud Function summary` สำหรับสรุปก้อนใหญ่ เช่น งานตามจังหวัด, พยาบาลตามจังหวัด, งานตามช่วงเวลา, งานตามวัน
- ใช้ `Firestore listener` เฉพาะเอกสารสรุปจำนวนน้อย เช่น `adminAnalytics/liveSummary/current`
- ใช้ `on-demand query` ตอนผู้ดูแลกดดูต่อเป็นรายจังหวัดหรือรายช่วงเวลา

ไม่แนะนำให้เปิด listener ตรงกับ collection งานหรือผู้ใช้ทั้งก้อนในหน้า admin เพราะอ่านหนัก, แพง, และโตไม่สวยเมื่อข้อมูลเพิ่ม

## ทำไมไม่ควรฟังสดทุก collection

ถ้า listener ไปที่ `jobs`, `users`, `notifications`, `applications` ตรง ๆ

- ทุกครั้งที่ข้อมูลขยับ หน้า admin จะต้องรับ event จำนวนมาก
- ผู้ดูแลเปิดหน้าค้างไว้หลายคนจะเพิ่ม read ซ้ำ
- หน้า dashboard จะเริ่มช้าเมื่อมีเอกสารหลักพันถึงหลักหมื่น
- logic รวมผลตามจังหวัด/ช่วงเวลาจะย้ายไปทำบนมือถือ ซึ่งไม่คุ้ม

## แบบที่แนะนำ

### 1. Aggregate collection

สร้างเอกสารสรุป เช่น

- `adminAnalytics/liveSummary/current`
- `adminAnalytics/provinceDemand/current`
- `adminAnalytics/timeBuckets/current`
- `adminAnalytics/weekdayBuckets/current`

ในแต่ละเอกสารเก็บข้อมูลที่หน้า admin ต้องใช้ทันที เช่น

- top provinces by nurses
- top provinces by jobs
- demand pressure per province
- jobs by hour bucket
- jobs by weekday
- updatedAt

### 2. Cloud Functions เป็นคนอัปเดต summary

ให้ Cloud Functions ทำงานเมื่อมี event สำคัญ เช่น

- สร้างงานใหม่
- ปิดงาน
- สมัครบัญชีใหม่
- เปลี่ยนจังหวัดผู้ใช้
- ยืนยันพยาบาลสำเร็จ

มี 2 รูปแบบให้เลือก

- Incremental update: อัปเดต summary เฉพาะ field ที่เปลี่ยน เร็วและประหยัดกว่า
- Scheduled rebuild: รันทุก 5-15 นาทีเพื่อซ่อมความคลาดเคลื่อนและตรวจความถูกต้อง

แนะนำให้ใช้ทั้งคู่ร่วมกัน

- event-driven update สำหรับความเร็ว
- scheduled rebuild สำหรับความนิ่ง

### 3. Listener แค่ summary document

หน้า admin ควร subscribe แค่เอกสารสรุปจำนวนน้อย เช่น 1-4 docs

ข้อดี

- ได้ความรู้สึก realtime ทันที
- read ต่ำมากเมื่อเทียบกับการฟัง collection ดิบ
- หน้าแอดมินเบาและเร็ว

### 4. Drill-down query เมื่อกดดูต่อ

เมื่อผู้ใช้กดจังหวัด เช่น “เชียงใหม่”

- ค่อย query `jobs where province == 'เชียงใหม่'`
- หรือค่อย query `users where role == 'nurse' and province == 'เชียงใหม่'`

แบบนี้ทำให้ query หนักเกิดเฉพาะตอนที่มีคนต้องการดูจริง

## โครงสร้างข้อมูลที่ควรมี

ตัวอย่าง `adminAnalytics/liveSummary/current`

```json
{
  "updatedAt": "2026-03-13T12:30:00.000Z",
  "topNurseProvinces": [
    { "province": "กรุงเทพมหานคร", "count": 320 },
    { "province": "เชียงใหม่", "count": 118 }
  ],
  "topJobProvinces": [
    { "province": "กรุงเทพมหานคร", "count": 210 },
    { "province": "ชลบุรี", "count": 84 }
  ],
  "timeBuckets": [
    { "label": "เช้า 06:00-11:59", "count": 120 },
    { "label": "บ่าย 12:00-17:59", "count": 98 }
  ],
  "weekdayBuckets": [
    { "label": "จ.", "count": 72 },
    { "label": "อ.", "count": 64 }
  ],
  "regionSummaries": [
    { "region": "ภาคกลาง", "nurses": 420, "jobs": 300 }
  ]
}
```

## ลำดับทำงานที่แนะนำ

### เฟส 1: ใกล้ realtime แบบคุ้มที่สุด

- สร้าง aggregate docs 3-4 ตัว
- ทำ scheduled rebuild ทุก 10 นาที
- หน้า admin subscribe summary docs

ผลลัพธ์

- ผู้ดูแลเห็นข้อมูลอัปเดตเรื่อย ๆ
- ค่าใช้จ่ายยังต่ำ
- complexity ยังไม่สูงเกินไป

### เฟส 2: เร็วขึ้นสำหรับ metric สำคัญ

- เพิ่ม Cloud Function แบบ event-driven ตอนมี job create / user verify / user register
- update summary ทันทีบาง metric

ผลลัพธ์

- ตัวเลขสำคัญขยับเกือบทันที
- ยังไม่ต้อง listener raw collection

### เฟส 3: ลึกขึ้นเมื่อทีมเริ่มใช้จริง

- เก็บ historical snapshots รายวันหรือรายชั่วโมง
- ทำ trend 7 วัน, 30 วัน, เทียบจังหวัด, heatmap เวลา
- ถ้าข้อมูลเริ่มเยอะมากค่อยพิจารณาส่งเข้า BigQuery

## สิ่งที่ไม่ควรทำตอนนี้

- ไม่ควรให้มือถือรวมข้อมูล analytics เองจาก collection ใหญ่
- ไม่ควรเปิด listener หลาย collection ใหญ่พร้อมกันบนหน้า admin
- ไม่ควรคำนวณ heavy aggregation ทุกครั้งที่ผู้ดูแลเปิดหน้า

## Recommendation สุดท้าย

เริ่มจาก `Cloud Function summary + summary doc listener + drill-down query`

เหตุผล

- ได้ความรู้สึก realtime พอสำหรับงาน admin
- คุม read และค่าใช้จ่ายได้ดี
- ซ่อมและขยายต่อได้ง่าย
- ไม่ทำให้หน้า dashboard หนักขึ้นเรื่อย ๆ ตามจำนวนข้อมูล