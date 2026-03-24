#!/usr/bin/env python3
"""
Pass 3: Fix ALL remaining Thai strings across all 16 migrated screens.
- Adds new dictionary keys to th.ts and en.ts
- Replaces hardcoded Thai in screen files with t() calls
"""
import re
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ============================================================
# NEW DICTIONARY ENTRIES (keyed by section)
# ============================================================

NEW_TH_KEYS = {
    'chat': {
        'reset': 'รีเซ็ต',
        'imageViewerHint': 'ใช้ 2 นิ้วซูม/ลาก หรือกดปุ่มซูมและดาวน์โหลดด้านบน',
    },
    'reviews': {
        'reviewCount': '{count} รีวิว',
        'reviewHint': 'รีวิวได้เมื่อคุณมีงานที่ยืนยันแล้วและจบงานกับโปรไฟล์นี้',
        'wouldRecommend': 'คุณจะแนะนำให้ผู้อื่นหรือไม่?',
    },
    'chooseRole': {
        'staffTypeQuestion': 'คุณเป็นบุคลากรประเภทไหน?',
        'orgTypeQuestion': 'ประเภทองค์กรของคุณ?',
    },
    'terms': {
        'lastUpdatedLabel': 'อัปเดตล่าสุด:',
        'introText': 'กรุณาอ่านข้อกำหนดการใช้งานฉบับนี้อย่างละเอียดก่อนสมัครสมาชิกหรือใช้บริการ เนื้อหาฉบับนี้ออกแบบให้สอดคล้องกับสถานะการให้บริการของ NurseGo ในปัจจุบันและจะมีการปรับปรุงเมื่อมีการเปลี่ยนแปลงสาระสำคัญ',
    },
    'privacy': {
        'emailSubject': 'คำถามเกี่ยวกับข้อมูลส่วนบุคคล',
        'lastUpdatedLabel': 'อัปเดตล่าสุด:',
        'introText': 'NurseGo มุ่งมั่นปกป้องข้อมูลส่วนบุคคลของคุณ นโยบายฉบับนี้อธิบายว่าเราเก็บ ใช้ เปิดเผย และดูแลข้อมูลอย่างไรตามกรอบกฎหมายที่ใช้บังคับและตามข้อเท็จจริงของบริการในปัจจุบัน',
        'futureServicesNote': 'หากในอนาคตมีเว็บไซต์หรือบริการใหม่เพิ่มเติม อาจมีประกาศข้อมูลส่วนบุคคลเฉพาะช่องทางนั้นเพิ่มเติม',
    },
    'feedback': {
        'historyTitle': 'ประวัติ Feedback ของคุณ',
        'alreadySentToday': 'คุณส่ง feedback ไปแล้ววันนี้\nกรุณารอพรุ่งนี้',
        'thankYouLine1': 'Feedback ของคุณจะช่วยให้เราพัฒนาแอพให้ดียิ่งขึ้น',
        'thankYouLine2': 'ทีมงานจะอ่านทุกข้อความ 💙',
    },
    'verification': {
        'pendingReviewText': 'คำขอยืนยันตัวตนของคุณอยู่ระหว่างการตรวจสอบ ทีมงานจะตรวจสอบภายใน 1-3 วันทำการ',
        'tagFromRoleSurvey': 'Tag จาก role / survey',
        'declarationHint': 'เช่น เขียนกำกับบนเอกสารว่า ใช้ยืนยันตัวตนกับ NurseGo พร้อมลายเซ็น',
        'privacyNotice': 'เอกสารทั้งหมดใช้เพื่อการตรวจสอบตัวตนและความน่าเชื่อถือของผู้โพสต์งานเท่านั้น',
        'pickFromGallery': 'เลือกจากคลังรูปภาพ',
        'takePhoto': 'ถ่ายรูป',
    },
    'documents': {
        'confirmCancelRequest': 'ต้องการยกเลิกคำขอสำหรับ "{name}" หรือไม่?',
        'confirmDelete': 'ต้องการลบ "{name}" หรือไม่?',
        'subtitle': 'อัพโหลด Resume, ใบประกอบวิชาชีพ และเอกสารอื่นๆ',
        'rejectionReason': 'เหตุผล: {reason}',
        'selectDocType': 'เลือกประเภทเอกสาร',
        'statusLabel': 'สถานะ: {status}',
        'rejectionReasonDetail': 'เหตุผลที่ไม่ผ่าน: {reason}',
    },
    'myPosts': {
        'confirmClosePost': 'คุณต้องการปิดประกาศนี้หรือไม่?\nผู้คนจะไม่เห็นประกาศนี้อีก',
        'urgentMarkedSuccess': 'ทำเครื่องหมายด่วนให้ประกาศนี้เรียบร้อยแล้ว',
        'premiumUrgentPrompt': 'บัญชีนี้มีสิทธิ์ใช้ป้ายด่วนฟรี 1 ครั้งจาก Premium\nเพื่อช่วยให้ประกาศถูกมองเห็นได้เร็วขึ้น\n\nต้องการใช้ตอนนี้หรือไม่?',
        'urgentMarkedDone': 'ทำเครื่องหมายด่วนเรียบร้อยแล้ว!',
        'visibilityHelp': 'ช่วยให้ประกาศ "{title}" ถูกมองเห็นได้เร็วขึ้นเมื่อเปิดระบบชำระเงินในอนาคต',
        'confirmDeletePost': 'คุณต้องการลบประกาศนี้ถาวรหรือไม่?\nการดำเนินการนี้ไม่สามารถย้อนกลับได้',
        'extendPostMessage': 'ต่ออายุประกาศ "{title}" เพิ่มอีก 1 วัน',
        'perDay': 'วัน',
        'perMonth': 'เดือน',
        'perShift': 'เวร',
        'postedPrefix': 'โพสต์ ',
        'daysRemaining': 'เหลือ {days} วัน',
        'bahtPerUnit': 'บาท/',
    },
    'help': {
        'faqAnswer1': 'NurseGo เป็นแพลตฟอร์มหางานสำหรับพยาบาลและบุคลากรทางการแพทย์ ที่ช่วยเชื่อมต่อระหว่างพยาบาลที่กำลังหางานกับโรงพยาบาลและสถานพยาบาลที่ต้องการบุคลากร',
        'faqAnswer2': 'ตอนนี้ NurseGo เปิดให้ใช้งานฟรีในช่วงทดลองใช้ฟรี โดยระบบจะดูแลสิทธิ์ของแต่ละบัญชีให้อัตโนมัติ และจะประกาศให้ทราบอีกครั้งเมื่อเปิดระบบชำระเงินอย่างเป็นทางการ',
        'faqAnswer3': 'แอป NurseGo รองรับทั้ง iOS และ Android รวมถึงสามารถใช้งานผ่านเว็บบราวเซอร์ได้ด้วย',
        'faqAnswer4': 'คุณสามารถสมัครสมาชิกได้โดยใช้อีเมล หรือเข้าสู่ระบบด้วย Google / Apple ID เพียงกดปุ่ม "สมัครสมาชิก" และทำตามขั้นตอน',
        'faqAnswer5': 'กดปุ่ม "ลืมรหัสผ่าน" ที่หน้าเข้าสู่ระบบ แล้วกรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณ',
        'faqAnswer6': 'ไปที่หน้า "โปรไฟล์" แล้วกด "แก้ไขโปรไฟล์" คุณสามารถแก้ไขชื่อ, รูปภาพ, ประวัติการศึกษา, ประสบการณ์ทำงาน และข้อมูลอื่นๆ ได้',
        'faqAnswer7': 'ไปที่ ตั้งค่า > บัญชี > ลบบัญชี การลบบัญชีจะเป็นการลบข้อมูลทั้งหมดของคุณอย่างถาวร รวมถึงประวัติการสมัครงานและการแชท',
        'faqAnswer8': 'ใช้ฟังก์ชันค้นหาและตัวกรองที่หน้าค้นหางาน คุณสามารถกรองตามประเภทงาน, เงินเดือน, ตำแหน่งที่ตั้ง, และอื่นๆ เพื่อหางานที่ตรงใจ',
        'faqAnswer9': 'กดไอคอนหัวใจ (❤️) ที่การ์ดงานหรือหน้ารายละเอียดงาน งานที่บันทึกจะแสดงในหน้า "รายการโปรด" ของคุณ',
        'faqAnswer10': 'งานทั้งหมดลงประกาศโดยโรงพยาบาลและสถานพยาบาลที่ผ่านการยืนยันตัวตนกับ NurseGo เรามีทีมงานตรวจสอบความถูกต้องของข้อมูลอยู่เสมอ',
        'faqAnswer11': 'เข้าดูรายละเอียดงานที่สนใจ แล้วกดปุ่ม "สมัครงาน" คุณสามารถใส่ข้อความแนะนำตัวเพิ่มเติมได้ โรงพยาบาลจะได้รับการแจ้งเตือนและสามารถดูโปรไฟล์ของคุณได้',
        'faqAnswer12': 'ไปที่หน้า "ใบสมัคร" คุณจะเห็นรายการงานที่สมัครทั้งหมด พร้อมสถานะการสมัคร เช่น รอดำเนินการ, กำลังพิจารณา, ผ่านการคัดเลือก เป็นต้น',
        'faqAnswer13': 'ได้ คุณสามารถยกเลิกการสมัครได้ที่หน้ารายละเอียดใบสมัคร กดปุ่ม "ยกเลิกการสมัคร" การยกเลิกจะไม่สามารถกู้คืนได้',
        'faqAnswer14': 'เอกสารที่แนะนำให้อัปโหลด ได้แก่ Resume, ใบอนุญาตประกอบวิชาชีพ, ประกาศนียบัตร, หลักฐานการศึกษา และบัตรประจำตัวประชาชน เอกสารเหล่านี้จะช่วยเพิ่มโอกาสในการได้รับการพิจารณา',
        'faqAnswer15': 'สมัครสมาชิกในฐานะโรงพยาบาล ยืนยันตัวตนกับเอกสารที่จำเป็น จากนั้นไปที่ "ลงประกาศงาน" กรอกรายละเอียดงานและกด "เผยแพร่"',
        'faqAnswer16': 'ไปที่ "จัดการผู้สมัคร" คุณจะเห็นรายการผู้สมัครทั้งหมดของงานที่ลงประกาศ สามารถดูโปรไฟล์, อัปเดตสถานะ, และแชทกับผู้สมัครได้',
        'faqAnswer17': 'รีวิวช่วยให้ผู้หางานเข้าใจวัฒนธรรมและสภาพแวดล้อมการทำงานของโรงพยาบาล รีวิวดีจะช่วยดึงดูดผู้สมัครคุณภาพ โรงพยาบาลสามารถตอบกลับรีวิวได้',
        'faqAnswer18': 'ในช่วงทดลองใช้ฟรี ระบบยังไม่เรียกเก็บเงินจริง โรงพยาบาลและผู้ใช้งานจะได้รับสิทธิ์ตามสถานะบัญชีและการใช้งานที่ระบบเปิดให้ก่อน เมื่อเปิดระบบชำระเงินอย่างเป็นทางการ เราจะแจ้งแพ็กเกจและเงื่อนไขอีกครั้ง',
        'faqAnswer19': 'ขณะนี้ยังไม่มีการเปิดรับชำระเงินจริงในแอป เมื่อเปิดระบบชำระเงินแล้ว เราจะแจ้งช่องทางที่รองรับให้ทราบอีกครั้ง',
        'faqAnswer20': 'ในช่วงที่ยังไม่เปิดเก็บเงินจริง ระบบจะยังไม่มีใบเสร็จหรือประวัติการชำระเงิน เมื่อเปิดใช้งานจริงแล้ว เราจะแจ้งขั้นตอนการรับเอกสารให้ทราบอีกครั้ง',
        'emailSubject': 'ขอความช่วยเหลือ',
        'allTab': 'ทั้งหมด',
    },
    'map': {
        'staffTypeRN': 'พยาบาลวิชาชีพ',
        'staffTypeLPN': 'ผู้ช่วยพยาบาล',
        'staffTypeCG': 'ผู้ดูแลผู้ป่วย',
        'staffTypeSitter': 'เฝ้าไข้',
        'staffTypeAnes': 'ผู้ช่วยวิสัญญี / วิสัญญีพยาบาล',
        'staffTypeOther': 'อื่นๆ',
        'jobsOnMap': '{count} งานบนแผนที่',
        'searchPrefix': 'ค้นหา: {term}',
        'legendHigh': '≥฿1,500',
        'legendMid': '≥฿700',
        'legendLow': '< ฿700',
        'showResults': 'แสดง{count} รายการ',
    },
    'shop': {
        'audienceFree': 'เหมาะกับคนที่เพิ่งเริ่มใช้งานและยังลงประกาศไม่บ่อย',
        'audiencePremium': 'คุ้มกับผู้ใช้ทั่วไปที่ต้องการสิทธิ์ใช้งานมากขึ้นโดยไม่ผูกกับสายงานพยาบาลโดยตรง',
        'audienceNursePro': 'คุ้มกับพยาบาลที่ลงเวรหรือหางานต่อเนื่องทุกสัปดาห์',
        'audienceHospitalStarter': 'คุ้มกับองค์กรที่ลงประกาศเป็นรอบและยังไม่ต้องดันหลายตำแหน่งพร้อมกัน',
        'audienceHospitalPro': 'คุ้มกับองค์กรที่เปิดรับหลายตำแหน่งต่อเนื่องและต้องการความคล่องตัวมากขึ้น',
        'audienceHospitalEnterprise': 'คุ้มกับองค์กรที่ต้องดันประกาศหลายชิ้นพร้อมกันตลอดเดือน',
        'billingUnavailable': '{subject} จะเปิดให้ใช้งานแบบชำระเงินจริงได้อีกครั้งเมื่อระบบชำระเงินพร้อมใช้งาน ตอนนี้บัญชีใช้งานแบบโควตารายเดือนโดยไม่มีการตัดเงิน',
        'packageNotCharged': 'แพ็กเกจ {name} ยังไม่เปิดเก็บเงินจริง ตอนนี้บัญชีใช้ฟีเจอร์ได้ตามโควตารายเดือนของช่วงเปิดตัว',
        'addonNotCharged': 'บริการเสริมนี้ยังไม่เปิดเก็บเงินจริง ตอนนี้ใช้งานได้ตามโควตารายเดือนของบัญชี',
        'referralCopied': 'โค้ด {code} ถูกคัดลอกแล้ว',
        'launchNotice1': 'บัญชีนี้ใช้งานฟีเจอร์หลักและบริการเสริมได้ในช่วงเปิดตัว แต่แต่ละรายการจะมีโควตารายเดือนตามประเภทบัญชี',
        'launchNotice2': 'รายละเอียดที่เห็นอาจแตกต่างกันตามประเภทบัญชีและจำนวนสิทธิ์ที่ใช้ไปแล้วในเดือนนี้',
        'hospitalFeature1': 'ลงประกาศและติดตามผู้สนใจได้ภายในโควตารายเดือนขององค์กร',
        'hospitalFeature2': 'ใช้ป้ายด่วน ต่ออายุ และดันโพสต์ได้ตามสิทธิ์ที่เหลือ',
        'hospitalFeature3': 'คุยต่อผ่านแชทและจัดการผู้สมัครได้ภายใต้โควตาการใช้งานของบัญชี',
        'defaultFeature1': 'ใช้งานฟีเจอร์หลักได้ทันทีภายในโควตารายเดือนของบัญชี',
        'defaultFeature2': 'บริการเสริมบางรายการพร้อมใช้ตามสิทธิ์ที่ระบบจัดสรรให้',
        'defaultFeature3': 'ระบบจะรีเซ็ตโควตาใหม่ทุกเดือนเพื่อให้ใช้งานต่อได้อย่างต่อเนื่อง',
        'freePlan': '🆓 ฟรี',
        'usedWith': 'ใช้กับ {label}',
        'fromPrice': 'จาก ฿{original} เหลือ ฿{final}',
        'freeAccessAddonsTitle': 'บริการเสริมที่พร้อมใช้ในบัญชีนี้',
        'extraPostDesc': 'ใช้สำหรับเพิ่มความยืดหยุ่นเมื่อโควตาโพสต์ประจำเดือนใกล้เต็ม',
        'viewQuota': 'ดูโควตาในบัญชี',
        'extendPostDesc': 'ขยายเวลาให้ประกาศยังมองเห็นต่อได้ภายในโควตาบริการเสริมของเดือนนี้',
        'urgentPostDesc': 'ช่วยให้ประกาศสำคัญถูกมองเห็นได้เร็วขึ้นตามโควตาบริการเสริมที่เหลือ',
        'referralBenefit': 'เพื่อนสมัครและอัปเกรด คุณและเพื่อนได้รับสิทธิ์พรีเมียมฟรี 1 เดือนตามประเภทบัญชี',
        'perYear': 'ปี',
        'perMonth': 'เดือน',
        'savedPercent': 'ประหยัด {pct}%',
    },
    'onboarding': {
        'step1Subtitle': 'สรุปให้ว่าบทบาทของคุณทำอะไรได้บ้าง และเริ่มตรงไหนถึงจะเร็วและง่ายที่สุด',
        'step2Subtitle': 'ดูทางลัดของแอปก่อนเริ่มใช้งานจริง เพื่อไปถึงหน้าสำคัญได้ไวขึ้น',
        'step3Subtitle': 'เลือกข้อมูลพื้นฐานเพื่อให้ระบบแนะนำงานหรือผู้ดูแลได้ตรงและปลอดภัยยิ่งขึ้น',
        'nurseHeroSubtitle': 'NurseGo จะช่วยเรียงงานที่เหมาะกับความถนัด พื้นที่ และเวลาที่คุณต้องการ พร้อมขั้นตอนคุยงานที่ต่อเนื่องและเข้าใจง่าย',
        'nurseHighlightDesc1': 'ดูงานล่าสุด กรองตามจังหวัด แผนก หรือเปิดโหมดงานใกล้คุณได้ทันที',
        'nurseHighlightDesc2': 'เริ่มแชทจากหน้าโพสต์และติดตามรายละเอียดงานต่อได้สะดวกในแท็บข้อความ',
        'nurseHighlightDesc3': 'ยืนยันตัวตนและเติมโปรไฟล์ให้ครบ เพื่อให้ผู้จ้างตัดสินใจได้ง่ายและมั่นใจขึ้น',
        'nurseFeatureDesc1': 'รวมงานใหม่ ฟิลเตอร์ และโหมดงานใกล้คุณไว้ในที่เดียว',
        'nurseFeatureDesc2': 'สำหรับพยาบาล แท็บนี้จะพาไปยังหน้าประกาศหาคนช่วยขึ้นเวรแทนได้ทันที',
        'nurseFeatureDesc3': 'รวมทุกห้องแชทเรื่องงานไว้ในที่เดียว เพื่อคุยต่อได้เร็วและไม่หลุดบริบท',
        'nurseFeatureDesc4': 'ดูรีวิว ยืนยันตัวตน และจัดการข้อมูลที่ช่วยเพิ่มความน่าเชื่อถือ',
        'nurseSetupSubtitle': 'ข้อมูลนี้ช่วยให้แอปกรองงานได้แม่นขึ้นตั้งแต่ครั้งแรก และช่วยให้เจองานได้เร็วขึ้น',
        'hospitalHeroSubtitle': 'บทบาทองค์กรจะโฟกัสที่การลงประกาศอย่างเป็นระบบ ดูรายชื่อผู้สนใจ และติดตามต่อได้รวดเร็ว',
        'hospitalHighlightTitle1': 'ลงประกาศรับสมัครได้เร็ว',
        'hospitalHighlightDesc1': 'สร้างประกาศงานพร้อมเงินเดือน สวัสดิการ และช่องทางคุยที่จัดการได้ง่าย',
        'hospitalHighlightTitle2': 'ดูผู้สนใจเป็นระเบียบ',
        'hospitalHighlightDesc2': 'ติดตามคนที่สนใจจากหน้า Applicants และแยกตามประกาศได้ชัดเจน',
        'hospitalHighlightTitle3': 'คุยต่อได้ทันที',
        'hospitalHighlightDesc3': 'เปิดแชทกับผู้สมัครต่อในแอปได้เลย เพื่อให้ข้อมูลครบและติดตามง่าย',
        'hospitalFeatureDesc1': 'ดูบอร์ดงานและคำแนะนำต่าง ๆ แต่จุดหลักของคุณคือการโพสต์และจัดการผู้สนใจ',
        'hospitalFeatureDesc2': 'แท็บนี้จะเปิดหน้าสำหรับลงประกาศรับสมัครบุคลากรให้เหมาะกับการใช้งานขององค์กรโดยอัตโนมัติ',
        'hospitalFeatureDesc3': 'ใช้คุยกับผู้สมัครต่อได้อย่างรวดเร็วโดยไม่ต้องสลับแอป',
        'hospitalFeatureDesc4': 'เข้าถึงประกาศ Applicants และข้อมูลองค์กรเพื่อบริหารงานต่อได้ง่าย',
        'hospitalSetupSubtitle': 'ระบุจังหวัดและระดับความเร่งด่วน เพื่อให้การโพสต์และจัดการผู้สนใจลื่นไหลขึ้น',
        'userHeroTitle': 'ค้นหาผู้ดูแลที่เหมาะสม ติดต่ออย่างเป็นส่วนตัว และตัดสินใจได้มั่นใจ',
        'userHeroSubtitle': 'แอปจะช่วยให้คุณหาผู้ดูแลที่ตรงประเภทงานและพื้นที่ พร้อมดูโปรไฟล์ รีวิว และคุยต่อได้อย่างสะดวก',
        'userHighlightTitle1': 'ดูประกาศที่ตรงความต้องการ',
        'userHighlightDesc1': 'ใช้ตัวกรองเพื่อหาผู้ดูแลที่เหมาะกับงานและพื้นที่ได้เร็วขึ้น',
        'userHighlightTitle2': 'ดูโปรไฟล์ก่อนตัดสินใจ',
        'userHighlightDesc2': 'เช็กประสบการณ์ รีวิว และสถานะการยืนยันตัวตนเพื่อเพิ่มความมั่นใจ',
        'userHighlightTitle3': 'คุยได้ตามช่องทางที่สะดวก',
        'userHighlightDesc3': 'เลือกโทร, LINE หรือแชทในแอปตามช่องทางที่ผู้โพสต์เปิดไว้',
        'userFeatureDesc1': 'ค้นหาโพสต์ดูแลผู้ป่วยและใช้ตัวกรองเพื่อเจอคนที่เหมาะได้เร็วขึ้น',
        'userFeatureDesc2': 'ถ้าต้องการหาผู้ดูแลเอง แท็บนี้จะเปิดหน้ากรอกข้อมูลแบบเป็นขั้นตอนให้ทันที',
        'userFeatureDesc3': 'ติดตามการพูดคุยกับผู้ดูแลที่คุณสนใจได้ต่อเนื่องในที่เดียว',
        'userFeatureDesc4': 'จัดการข้อมูลส่วนตัว รายการโปรด และการตั้งค่าความเป็นส่วนตัวต่าง ๆ',
        'userSetupSubtitle': 'ข้อมูลพื้นฐานนี้ช่วยให้แอปแนะนำผู้ดูแลได้ตรงกับความต้องการมากขึ้น และช่วยให้เลือกได้ง่ายขึ้น',
        'selectedTypesCount': '{count} ประเภทวิชาชีพ',
        'selectedOptionsCount': '{count} ตัวเลือกที่สนใจ',
        'skipNotice': 'ทุกขั้นตอนข้ามได้ และกลับมาดูใหม่ได้จากหน้า Settings',
        'quickActionsTitle': 'เริ่มจาก 3 อย่างนี้ จะใช้งานได้คล่องขึ้นทันที',
        'nurseQuickAction1': '1. เปิดงานใกล้คุณ เพื่อรู้ไวเมื่อมีเวรใหม่ในพื้นที่ที่สนใจ',
        'nurseQuickAction2': '2. ยืนยันตัวตน เพื่อให้ผู้จ้างมั่นใจและตัดสินใจได้เร็วขึ้น',
        'nurseQuickAction3': '3. เติมโปรไฟล์และรีวิวให้ครบ เพื่อให้โอกาสงานเข้าหาคุณง่ายขึ้น',
        'hospitalQuickAction1': '1. เติมข้อมูลองค์กรในโปรไฟล์',
        'hospitalQuickAction2': '2. สร้างประกาศแรกจากแท็บโพสต์',
        'hospitalQuickAction3': '3. ติดตามผู้สมัครจาก Applicants และแชท',
        'userQuickAction1': '1. ค้นหาผู้ดูแลจากหน้าแรกก่อน',
        'userQuickAction2': '2. ดูโปรไฟล์และรีวิวก่อนติดต่อ',
        'userQuickAction3': '3. บันทึกประกาศที่สนใจไว้เปรียบเทียบ',
        'multipleTypesHint': 'เลือกได้หลายประเภท หากคุณทำงานได้มากกว่าหนึ่งสาย',
        'locationHint': 'ใช้สำหรับตั้งต้นการค้นหาและช่วยให้ผลลัพธ์ตรงพื้นที่มากขึ้น',
        'interestHint': 'เลือกเฉพาะที่เกี่ยวกับคุณจริง ๆ เพื่อให้คำแนะนำที่แม่นขึ้น',
    },
}

NEW_EN_KEYS = {
    'chat': {
        'reset': 'Reset',
        'imageViewerHint': 'Use 2 fingers to zoom/drag or use the zoom and download buttons above',
    },
    'reviews': {
        'reviewCount': '{count} reviews',
        'reviewHint': 'You can write a review when you have a confirmed and completed job with this profile',
        'wouldRecommend': 'Would you recommend to others?',
    },
    'chooseRole': {
        'staffTypeQuestion': 'What type of staff are you?',
        'orgTypeQuestion': 'What type of organization?',
    },
    'terms': {
        'lastUpdatedLabel': 'Last updated:',
        'introText': 'Please read these terms of service carefully before registering or using our services. This content is designed to align with the current state of NurseGo services and will be updated when significant changes occur.',
    },
    'privacy': {
        'emailSubject': 'Personal data inquiry',
        'lastUpdatedLabel': 'Last updated:',
        'introText': 'NurseGo is committed to protecting your personal data. This policy explains how we collect, use, disclose, and safeguard your data in accordance with applicable laws and the current state of our services.',
        'futureServicesNote': 'If additional websites or services are added in the future, separate privacy notices may be issued for those channels.',
    },
    'feedback': {
        'historyTitle': 'Your Feedback History',
        'alreadySentToday': "You've already sent feedback today\nPlease try again tomorrow",
        'thankYouLine1': 'Your feedback helps us improve the app',
        'thankYouLine2': 'Our team reads every message 💙',
    },
    'verification': {
        'pendingReviewText': 'Your verification request is under review. Our team will review it within 1-3 business days.',
        'tagFromRoleSurvey': 'Tags from role / survey',
        'declarationHint': 'e.g. Write on the document: For NurseGo identity verification, with signature',
        'privacyNotice': 'All documents are used solely for identity verification and credibility of job posters.',
        'pickFromGallery': 'Choose from gallery',
        'takePhoto': 'Take photo',
    },
    'documents': {
        'confirmCancelRequest': 'Cancel request for "{name}"?',
        'confirmDelete': 'Delete "{name}"?',
        'subtitle': 'Upload resume, professional license, and other documents',
        'rejectionReason': 'Reason: {reason}',
        'selectDocType': 'Select document type',
        'statusLabel': 'Status: {status}',
        'rejectionReasonDetail': 'Rejection reason: {reason}',
    },
    'myPosts': {
        'confirmClosePost': 'Do you want to close this post?\nPeople will no longer see this post.',
        'urgentMarkedSuccess': 'Marked as urgent successfully',
        'premiumUrgentPrompt': 'This account has 1 free urgent badge from Premium\nTo help your post be seen faster\n\nUse it now?',
        'urgentMarkedDone': 'Marked as urgent!',
        'visibilityHelp': 'Help post "{title}" be seen faster when payment system launches',
        'confirmDeletePost': 'Permanently delete this post?\nThis action cannot be undone.',
        'extendPostMessage': 'Extend post "{title}" by 1 more day',
        'perDay': 'day',
        'perMonth': 'month',
        'perShift': 'shift',
        'postedPrefix': 'Posted ',
        'daysRemaining': '{days} days left',
        'bahtPerUnit': 'THB/',
    },
    'help': {
        'faqAnswer1': 'NurseGo is a job platform for nurses and medical professionals, connecting job-seeking nurses with hospitals and healthcare facilities that need staff.',
        'faqAnswer2': 'NurseGo is currently free during the trial period. The system manages account privileges automatically and will announce when the payment system officially launches.',
        'faqAnswer3': 'NurseGo supports both iOS and Android, and can also be used through a web browser.',
        'faqAnswer4': 'You can register using email, or sign in with Google / Apple ID. Just tap "Register" and follow the steps.',
        'faqAnswer5': 'Tap "Forgot Password" on the login screen and enter your registered email. The system will send a password reset link to your email.',
        'faqAnswer6': 'Go to "Profile" and tap "Edit Profile". You can edit your name, photo, education history, work experience, and other information.',
        'faqAnswer7': 'Go to Settings > Account > Delete Account. Deleting your account permanently removes all your data, including job application history and chats.',
        'faqAnswer8': 'Use the search and filter functions on the job search page. You can filter by job type, salary, location, and more to find the right job.',
        'faqAnswer9': 'Tap the heart icon (❤️) on the job card or job detail page. Saved jobs will appear in your "Favorites" page.',
        'faqAnswer10': 'All jobs are posted by hospitals and healthcare facilities verified with NurseGo. Our team constantly checks data accuracy.',
        'faqAnswer11': 'View the job details and tap "Apply". You can add an introduction message. The hospital will be notified and can view your profile.',
        'faqAnswer12': 'Go to "Applications". You\'ll see all applied jobs with their status such as pending, under review, selected, etc.',
        'faqAnswer13': 'Yes, you can cancel your application on the application detail page. Tap "Cancel Application". Cancellation cannot be undone.',
        'faqAnswer14': 'Recommended documents include Resume, professional license, certificates, educational credentials, and ID card. These documents increase your chances of being considered.',
        'faqAnswer15': 'Register as a hospital, verify identity with required documents, then go to "Post Job", fill in details, and tap "Publish".',
        'faqAnswer16': 'Go to "Manage Applicants" to see all applicants for your posted jobs. You can view profiles, update status, and chat with applicants.',
        'faqAnswer17': 'Reviews help job seekers understand hospital culture and work environment. Good reviews attract quality applicants. Hospitals can reply to reviews.',
        'faqAnswer18': 'During the free trial, no actual charges are made. Hospitals and users receive privileges based on account status. When the payment system officially launches, we will announce packages and terms.',
        'faqAnswer19': 'No actual payment is currently accepted in the app. When the payment system launches, we will announce supported payment methods.',
        'faqAnswer20': 'During the pre-payment period, there are no receipts or payment history. When the system is live, we will announce the process for receiving documents.',
        'emailSubject': 'Help request',
        'allTab': 'All',
    },
    'map': {
        'staffTypeRN': 'Registered Nurse',
        'staffTypeLPN': 'Licensed Practical Nurse',
        'staffTypeCG': 'Caregiver',
        'staffTypeSitter': 'Patient Sitter',
        'staffTypeAnes': 'Anesthesia Assistant / Nurse Anesthetist',
        'staffTypeOther': 'Other',
        'jobsOnMap': '{count} jobs on map',
        'searchPrefix': 'Search: {term}',
        'legendHigh': '≥฿1,500',
        'legendMid': '≥฿700',
        'legendLow': '< ฿700',
        'showResults': 'Show {count} results',
    },
    'shop': {
        'audienceFree': 'Great for new users who don\'t post frequently',
        'audiencePremium': 'Great for general users who want more features without being tied to nursing specifically',
        'audienceNursePro': 'Great for nurses who take shifts or search for jobs weekly',
        'audienceHospitalStarter': 'Great for organizations that post periodically without needing to boost multiple positions at once',
        'audienceHospitalPro': 'Great for organizations accepting multiple positions continuously and needing more flexibility',
        'audienceHospitalEnterprise': 'Great for organizations that need to boost multiple posts simultaneously all month',
        'billingUnavailable': '{subject} will be available for paid use again when the payment system is ready. Currently the account uses monthly quota without charges.',
        'packageNotCharged': 'Package {name} is not yet charging. Currently the account can use features within the launch period monthly quota.',
        'addonNotCharged': 'This add-on is not yet charging. Currently usable within your account\'s monthly quota.',
        'referralCopied': 'Code {code} copied',
        'launchNotice1': 'This account can use core features and add-ons during launch, but each item has a monthly quota based on account type.',
        'launchNotice2': 'Details shown may vary by account type and remaining quota used this month.',
        'hospitalFeature1': 'Post jobs and track interested candidates within your organization\'s monthly quota',
        'hospitalFeature2': 'Use urgent badges, extensions, and boosts within remaining quota',
        'hospitalFeature3': 'Chat and manage applicants within your account\'s usage quota',
        'defaultFeature1': 'Use core features immediately within your account\'s monthly quota',
        'defaultFeature2': 'Some add-on services are available based on system-allocated quota',
        'defaultFeature3': 'Quota resets monthly so you can continue using the service',
        'freePlan': '🆓 Free',
        'usedWith': 'Use with {label}',
        'fromPrice': 'From ฿{original} to ฿{final}',
        'freeAccessAddonsTitle': 'Add-on services available in this account',
        'extraPostDesc': 'Use to add flexibility when your monthly post quota is nearly full',
        'viewQuota': 'View account quota',
        'extendPostDesc': 'Extend post visibility within this month\'s add-on service quota',
        'urgentPostDesc': 'Help important posts be seen faster within remaining add-on quota',
        'referralBenefit': 'When friends sign up and upgrade, you and your friend get 1 month premium based on account type',
        'perYear': 'year',
        'perMonth': 'month',
        'savedPercent': 'Save {pct}%',
    },
    'onboarding': {
        'step1Subtitle': 'A summary of what your role can do, and where to start for the fastest experience',
        'step2Subtitle': 'See app shortcuts before getting started to reach important pages faster',
        'step3Subtitle': 'Select basic info so the system can recommend jobs or caregivers more accurately and safely',
        'nurseHeroSubtitle': 'NurseGo will sort jobs matching your skills, location, and schedule, with a smooth communication flow',
        'nurseHighlightDesc1': 'See latest jobs, filter by province, department, or enable nearby jobs mode instantly',
        'nurseHighlightDesc2': 'Start chatting from job posts and follow up on details in the messages tab',
        'nurseHighlightDesc3': 'Verify identity and complete your profile so employers can decide easily and confidently',
        'nurseFeatureDesc1': 'New jobs, filters, and nearby jobs mode all in one place',
        'nurseFeatureDesc2': 'For nurses, this tab takes you to post and find shift replacements instantly',
        'nurseFeatureDesc3': 'All work-related chats in one place for quick follow-up without losing context',
        'nurseFeatureDesc4': 'View reviews, verify identity, and manage info that builds credibility',
        'nurseSetupSubtitle': 'This info helps the app filter jobs more accurately from the start and find jobs faster',
        'hospitalHeroSubtitle': 'The organization role focuses on systematic posting, viewing interested candidates, and quick follow-up',
        'hospitalHighlightTitle1': 'Post job listings quickly',
        'hospitalHighlightDesc1': 'Create job posts with salary, benefits, and easy-to-manage communication channels',
        'hospitalHighlightTitle2': 'View candidates organized',
        'hospitalHighlightDesc2': 'Track interested candidates from Applicants page, sorted by posting',
        'hospitalHighlightTitle3': 'Chat right away',
        'hospitalHighlightDesc3': 'Open chat with applicants right in the app for complete info and easy tracking',
        'hospitalFeatureDesc1': 'View job board and recommendations, but your main focus is posting and managing candidates',
        'hospitalFeatureDesc2': 'This tab opens the job posting page automatically suited for organization use',
        'hospitalFeatureDesc3': 'Chat with applicants quickly without switching apps',
        'hospitalFeatureDesc4': 'Access posts, Applicants, and organization info for easy job management',
        'hospitalSetupSubtitle': 'Specify province and urgency level to make posting and candidate management smoother',
        'userHeroTitle': 'Find the right caregiver, contact privately, and decide with confidence',
        'userHeroSubtitle': 'The app helps you find caregivers matching job type and location, view profiles, reviews, and chat conveniently',
        'userHighlightTitle1': 'See posts matching your needs',
        'userHighlightDesc1': 'Use filters to find caregivers suited to your job and area faster',
        'userHighlightTitle2': 'View profiles before deciding',
        'userHighlightDesc2': 'Check experience, reviews, and verification status for more confidence',
        'userHighlightTitle3': 'Chat via your preferred channel',
        'userHighlightDesc3': 'Choose call, LINE, or in-app chat based on channels the poster has enabled',
        'userFeatureDesc1': 'Search caregiver posts and use filters to find the right match faster',
        'userFeatureDesc2': 'If you want to find a caregiver yourself, this tab opens a step-by-step form instantly',
        'userFeatureDesc3': 'Follow up on conversations with caregivers you\'re interested in, all in one place',
        'userFeatureDesc4': 'Manage personal info, favorites, and privacy settings',
        'userSetupSubtitle': 'Basic info helps the app recommend caregivers more accurately and makes choosing easier',
        'selectedTypesCount': '{count} professional types',
        'selectedOptionsCount': '{count} selected options',
        'skipNotice': 'All steps can be skipped, and you can review them later from Settings',
        'quickActionsTitle': 'Start with these 3 things to get up to speed quickly',
        'nurseQuickAction1': '1. Enable nearby jobs to know quickly when new shifts appear in your area',
        'nurseQuickAction2': '2. Verify identity so employers feel confident and decide faster',
        'nurseQuickAction3': '3. Complete profile and reviews so job opportunities come to you more easily',
        'hospitalQuickAction1': '1. Fill in organization info in your profile',
        'hospitalQuickAction2': '2. Create your first post from the Post tab',
        'hospitalQuickAction3': '3. Track applicants from Applicants and chat',
        'userQuickAction1': '1. Search for caregivers from the home page first',
        'userQuickAction2': '2. View profiles and reviews before contacting',
        'userQuickAction3': '3. Save posts you like for comparison',
        'multipleTypesHint': 'You can select multiple types if you work in more than one field',
        'locationHint': 'Used as a starting point for search to help results match your area better',
        'interestHint': 'Select only what really applies to you for more accurate recommendations',
    },
}


def add_dict_keys(dict_file, new_keys, is_th=True):
    """Add new keys to existing sections in dictionary file."""
    with open(os.path.join(BASE, dict_file), 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    keys_to_add = new_keys
    total_added = 0
    
    for section, keys in keys_to_add.items():
        # Find the closing of this section: line starting with "  }," after the section header
        # We'll find "  section: {" and then find its closing "  },"
        pattern = rf'(  {section}: \{{[^}}]*?)(\n  \}},)'
        match = re.search(pattern, content, re.DOTALL)
        if not match:
            print(f"  ⚠️ Section '{section}' not found in {dict_file}")
            continue
        
        existing_block = match.group(1)
        section_added = 0
        
        for key, value in keys.items():
            # Check if key already exists
            if f"    {key}:" in existing_block or f"    {key} :" in existing_block:
                continue
            
            # Escape single quotes in value for the dictionary
            escaped_value = value.replace("'", "\\'")
            new_line = f"\n    {key}: '{escaped_value}',"
            existing_block += new_line
            section_added += 1
            total_added += 1
        
        if section_added > 0:
            content = content[:match.start()] + existing_block + match.group(2) + content[match.end():]
    
    if content != original:
        with open(os.path.join(BASE, dict_file), 'w', encoding='utf-8') as f:
            f.write(content)
    
    return total_added


def fix_screen(rel_path, replacements):
    """Apply a list of (old, new) replacements to a screen file."""
    path = os.path.join(BASE, rel_path)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    count = 0
    
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new, 1)
            count += 1
        else:
            # Try stripping to handle whitespace differences
            pass
    
    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return count


# ============================================================
# MAIN
# ============================================================

print("=" * 60)
print("PASS 3: Final Thai string migration")
print("=" * 60)

# Step 1: Add dictionary keys
print("\n📖 Adding dictionary keys...")
th_added = add_dict_keys('src/i18n/dictionaries/th.ts', NEW_TH_KEYS, is_th=True)
print(f"  th.ts: {th_added} keys added")
en_added = add_dict_keys('src/i18n/dictionaries/en.ts', NEW_EN_KEYS, is_th=False)
print(f"  en.ts: {en_added} keys added")

# Step 2: Fix screen files
print("\n🔧 Fixing screen files...")

# --- ChatScreens.tsx ---
print("\n  ChatScreens.tsx:")
n = fix_screen('src/screens/chat/ChatScreens.tsx', [
    ("<Text style={styles.imageControlText}>รีเซ็ต</Text>",
     "<Text style={styles.imageControlText}>{t('chat.reset')}</Text>"),
    ("<Text style={styles.imageViewerHint}>ใช้ 2 นิ้วซูม/ลาก หรือกดปุ่มซูมและดาวน์โหลดด้านบน</Text>",
     "<Text style={styles.imageViewerHint}>{t('chat.imageViewerHint')}</Text>"),
])
print(f"    {n} replacements")

# --- ReviewsScreen.tsx ---
print("\n  ReviewsScreen.tsx:")
n = fix_screen('src/screens/reviews/ReviewsScreen.tsx', [
    ("{ratingData.totalReviews} รีวิว",
     "{t('reviews.reviewCount').replace('{count}', String(ratingData.totalReviews))}"),
    ("<Text style={styles.reviewHintText}>รีวิวได้เมื่อคุณมีงานที่ยืนยันแล้วและจบงานกับโปรไฟล์นี้</Text>",
     "<Text style={styles.reviewHintText}>{t('reviews.reviewHint')}</Text>"),
    ("<Text style={styles.formLabel}>คุณจะแนะนำให้ผู้อื่นหรือไม่?</Text>",
     "<Text style={styles.formLabel}>{t('reviews.wouldRecommend')}</Text>"),
])
print(f"    {n} replacements")

# --- ChooseRoleScreen.tsx ---
print("\n  ChooseRoleScreen.tsx:")
n = fix_screen('src/screens/auth/ChooseRoleScreen.tsx', [
    ("คุณเป็นบุคลากรประเภทไหน? <Text",
     "{t('chooseRole.staffTypeQuestion')} <Text"),
    ("ประเภทองค์กรของคุณ? <Text",
     "{t('chooseRole.orgTypeQuestion')} <Text"),
])
print(f"    {n} replacements")

# --- TermsScreen.tsx ---
print("\n  TermsScreen.tsx:")
path = os.path.join(BASE, 'src/screens/legal/TermsScreen.tsx')
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
original = content
content = content.replace(
    "อัปเดตล่าสุด: {LEGAL_LAST_UPDATED}",
    "{t('terms.lastUpdatedLabel')} {LEGAL_LAST_UPDATED}"
)
# Handle the multi-line intro text
content = re.sub(
    r'กรุณาอ่านข้อกำหนดการใช้งานฉบับนี้อย่างละเอียดก่อนสมัครสมาชิกหรือใช้บริการ\n\s*เนื้อหาฉบับนี้ออกแบบให้สอดคล้องกับสถานะการให้บริการของ NurseGo ในปัจจุบันและจะมีการปรับปรุงเมื่อมีการเปลี่ยนแปลงสาระสำคัญ',
    "{t('terms.introText')}",
    content
)
if content != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"    Fixed")
else:
    print(f"    No changes")

# --- PrivacyScreen.tsx ---
print("\n  PrivacyScreen.tsx:")
path = os.path.join(BASE, 'src/screens/legal/PrivacyScreen.tsx')
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
original = content
content = content.replace(
    "คำถามเกี่ยวกับข้อมูลส่วนบุคคล",
    "${t('privacy.emailSubject')}"
)
content = content.replace(
    "อัปเดตล่าสุด: {LEGAL_LAST_UPDATED}",
    "{t('privacy.lastUpdatedLabel')} {LEGAL_LAST_UPDATED}"
)
content = re.sub(
    r'NurseGo มุ่งมั่นปกป้องข้อมูลส่วนบุคคลของคุณ นโยบายฉบับนี้อธิบายว่าเราเก็บ ใช้ เปิดเผย\n\s*และดูแลข้อมูลอย่างไรตามกรอบกฎหมายที่ใช้บังคับและตามข้อเท็จจริงของบริการในปัจจุบัน',
    "{t('privacy.introText')}",
    content
)
content = content.replace(
    "หากในอนาคตมีเว็บไซต์หรือบริการใหม่เพิ่มเติม อาจมีประกาศข้อมูลส่วนบุคคลเฉพาะช่องทางนั้นเพิ่มเติม",
    "{t('privacy.futureServicesNote')}"
)
if content != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"    Fixed")
else:
    print(f"    No changes")

# --- FeedbackScreen.tsx ---
print("\n  FeedbackScreen.tsx:")
n = fix_screen('src/screens/feedback/FeedbackScreen.tsx', [
    ("<Text style={styles.sectionTitle}>ประวัติ Feedback ของคุณ</Text>",
     "<Text style={styles.sectionTitle}>{t('feedback.historyTitle')}</Text>"),
    ("คุณส่ง feedback ไปแล้ววันนี้{'\\n'}กรุณารอพรุ่งนี้",
     "{t('feedback.alreadySentToday')}"),
    ("Feedback ของคุณจะช่วยให้เราพัฒนาแอพให้ดียิ่งขึ้น",
     "{t('feedback.thankYouLine1')}"),
    ("ทีมงานจะอ่านทุกข้อความ 💙",
     "{t('feedback.thankYouLine2')}"),
])
print(f"    {n} replacements")

# --- VerificationScreen.tsx ---
print("\n  VerificationScreen.tsx:")
path = os.path.join(BASE, 'src/screens/verification/VerificationScreen.tsx')
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
original = content
content = content.replace(
    "คำขอยืนยันตัวตนของคุณอยู่ระหว่างการตรวจสอบ ทีมงานจะตรวจสอบภายใน 1-3 วันทำการ",
    "{t('verification.pendingReviewText')}"
)
content = content.replace(
    "Tag จาก role / survey",
    "{t('verification.tagFromRoleSurvey')}"
)
content = content.replace(
    "'เช่น เขียนกำกับบนเอกสารว่า ใช้ยืนยันตัวตนกับ NurseGo พร้อมลายเซ็น'",
    "t('verification.declarationHint')"
)
content = content.replace(
    "เอกสารทั้งหมดใช้เพื่อการตรวจสอบตัวตนและความน่าเชื่อถือของผู้โพสต์งานเท่านั้น",
    "{t('verification.privacyNotice')}"
)
content = content.replace(
    "<Text style={styles.modalItemText}>เลือกจากคลังรูปภาพ</Text>",
    "<Text style={styles.modalItemText}>{t('verification.pickFromGallery')}</Text>"
)
content = content.replace(
    "<Text style={styles.modalItemText}>ถ่ายรูป</Text>",
    "<Text style={styles.modalItemText}>{t('verification.takePhoto')}</Text>"
)
if content != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"    Fixed ({len(original) - len(content)} chars changed)")
else:
    print(f"    No changes")

# --- DocumentsScreen.tsx ---
print("\n  DocumentsScreen.tsx:")
path = os.path.join(BASE, 'src/screens/documents/DocumentsScreen.tsx')
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
original = content
content = content.replace(
    '`ต้องการยกเลิกคำขอสำหรับ "${doc.name}" หรือไม่?`',
    "t('documents.confirmCancelRequest').replace('{name}', doc.name)"
)
content = content.replace(
    '`ต้องการลบ "${doc.name}" หรือไม่?`',
    "t('documents.confirmDelete').replace('{name}', doc.name)"
)
content = content.replace(
    'subtitle="อัพโหลด Resume, ใบประกอบวิชาชีพ และเอกสารอื่นๆ"',
    "subtitle={t('documents.subtitle')}"
)
content = content.replace(
    "<Text style={styles.rejectionText} numberOfLines={2}>เหตุผล: {item.rejectionReason}</Text>",
    "<Text style={styles.rejectionText} numberOfLines={2}>{t('documents.rejectionReason').replace('{reason}', item.rejectionReason)}</Text>"
)
content = content.replace(
    "<Text style={styles.modalTitle}>เลือกประเภทเอกสาร</Text>",
    "<Text style={styles.modalTitle}>{t('documents.selectDocType')}</Text>"
)
content = content.replace(
    "สถานะ: {getStatusMeta(previewDocument).text}",
    "{t('documents.statusLabel').replace('{status}', getStatusMeta(previewDocument).text)}"
)
content = content.replace(
    "<Text style={styles.previewRejectText}>เหตุผลที่ไม่ผ่าน: {previewDocument.rejectionReason}</Text>",
    "<Text style={styles.previewRejectText}>{t('documents.rejectionReasonDetail').replace('{reason}', previewDocument.rejectionReason)}</Text>"
)
if content != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    count = sum(1 for a, b in zip(original.split('\n'), content.split('\n')) if a != b)
    print(f"    Fixed")
else:
    print(f"    No changes")

# --- MyPostsScreen.tsx ---
print("\n  MyPostsScreen.tsx:")
path = os.path.join(BASE, 'src/screens/myposts/MyPostsScreen.tsx')
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
original = content
content = content.replace(
    "'คุณต้องการปิดประกาศนี้หรือไม่?\\nผู้คนจะไม่เห็นประกาศนี้อีก'",
    "t('myPosts.confirmClosePost')"
)
content = content.replace(
    "'ทำเครื่องหมายด่วนให้ประกาศนี้เรียบร้อยแล้ว'",
    "t('myPosts.urgentMarkedSuccess')"
)
content = content.replace(
    "'บัญชีนี้มีสิทธิ์ใช้ป้ายด่วนฟรี 1 ครั้งจาก Premium\\nเพื่อช่วยให้ประกาศถูกมองเห็นได้เร็วขึ้น\\n\\nต้องการใช้ตอนนี้หรือไม่?'",
    "t('myPosts.premiumUrgentPrompt')"
)
content = content.replace(
    "'ทำเครื่องหมายด่วนเรียบร้อยแล้ว!'",
    "t('myPosts.urgentMarkedDone')"
)
content = content.replace(
    '`ช่วยให้ประกาศ "${selectedPost.title}" ถูกมองเห็นได้เร็วขึ้นเมื่อเปิดระบบชำระเงินในอนาคต`',
    "t('myPosts.visibilityHelp').replace('{title}', selectedPost.title)"
)
content = content.replace(
    "'คุณต้องการลบประกาศนี้ถาวรหรือไม่?\\nการดำเนินการนี้ไม่สามารถย้อนกลับได้'",
    "t('myPosts.confirmDeletePost')"
)
content = content.replace(
    '`ต่ออายุประกาศ "${selectedPost.title}" เพิ่มอีก 1 วัน`',
    "t('myPosts.extendPostMessage').replace('{title}', selectedPost.title)"
)
# Rate type units: 'วัน' : 'เดือน' : 'เวร'
content = re.sub(
    r"item\.rateType === 'day' \? 'วัน' : item\.rateType === 'month' \? 'เดือน' : 'เวร'",
    "item.rateType === 'day' ? t('myPosts.perDay') : item.rateType === 'month' ? t('myPosts.perMonth') : t('myPosts.perShift')",
    content
)
# "โพสต์ " prefix
content = content.replace(
    "โพสต์ {formatRelativeTime(item.createdAt)}",
    "{t('myPosts.postedPrefix')}{formatRelativeTime(item.createdAt)}"
)
# "เหลือ X วัน"
content = re.sub(
    r'>เหลือ \{daysLeft\} วัน<',
    ">{t('myPosts.daysRemaining').replace('{days}', String(daysLeft))}<",
    content
)
# "บาท/"
content = content.replace(
    "💰 {item.shiftRate?.toLocaleString()} บาท/",
    "💰 {item.shiftRate?.toLocaleString()} {t('myPosts.bahtPerUnit')}"
)
if content != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"    Fixed")
else:
    print(f"    No changes")

# --- HelpScreen.tsx ---
print("\n  HelpScreen.tsx:")
path = os.path.join(BASE, 'src/screens/help/HelpScreen.tsx')
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
original = content

# FAQ answers 1-20
faq_answers_th = {
    1: 'NurseGo เป็นแพลตฟอร์มหางานสำหรับพยาบาลและบุคลากรทางการแพทย์ ที่ช่วยเชื่อมต่อระหว่างพยาบาลที่กำลังหางานกับโรงพยาบาลและสถานพยาบาลที่ต้องการบุคลากร',
    2: 'ตอนนี้ NurseGo เปิดให้ใช้งานฟรีในช่วงทดลองใช้ฟรี โดยระบบจะดูแลสิทธิ์ของแต่ละบัญชีให้อัตโนมัติ และจะประกาศให้ทราบอีกครั้งเมื่อเปิดระบบชำระเงินอย่างเป็นทางการ',
    3: 'แอป NurseGo รองรับทั้ง iOS และ Android รวมถึงสามารถใช้งานผ่านเว็บบราวเซอร์ได้ด้วย',
    4: 'คุณสามารถสมัครสมาชิกได้โดยใช้อีเมล หรือเข้าสู่ระบบด้วย Google / Apple ID เพียงกดปุ่ม "สมัครสมาชิก" และทำตามขั้นตอน',
    5: 'กดปุ่ม "ลืมรหัสผ่าน" ที่หน้าเข้าสู่ระบบ แล้วกรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณ',
    6: 'ไปที่หน้า "โปรไฟล์" แล้วกด "แก้ไขโปรไฟล์" คุณสามารถแก้ไขชื่อ, รูปภาพ, ประวัติการศึกษา, ประสบการณ์ทำงาน และข้อมูลอื่นๆ ได้',
    7: 'ไปที่ ตั้งค่า > บัญชี > ลบบัญชี การลบบัญชีจะเป็นการลบข้อมูลทั้งหมดของคุณอย่างถาวร รวมถึงประวัติการสมัครงานและการแชท',
    8: 'ใช้ฟังก์ชันค้นหาและตัวกรองที่หน้าค้นหางาน คุณสามารถกรองตามประเภทงาน, เงินเดือน, ตำแหน่งที่ตั้ง, และอื่นๆ เพื่อหางานที่ตรงใจ',
    9: 'กดไอคอนหัวใจ (❤️) ที่การ์ดงานหรือหน้ารายละเอียดงาน งานที่บันทึกจะแสดงในหน้า "รายการโปรด" ของคุณ',
    10: 'งานทั้งหมดลงประกาศโดยโรงพยาบาลและสถานพยาบาลที่ผ่านการยืนยันตัวตนกับ NurseGo เรามีทีมงานตรวจสอบความถูกต้องของข้อมูลอยู่เสมอ',
    11: 'เข้าดูรายละเอียดงานที่สนใจ แล้วกดปุ่ม "สมัครงาน" คุณสามารถใส่ข้อความแนะนำตัวเพิ่มเติมได้ โรงพยาบาลจะได้รับการแจ้งเตือนและสามารถดูโปรไฟล์ของคุณได้',
    12: 'ไปที่หน้า "ใบสมัคร" คุณจะเห็นรายการงานที่สมัครทั้งหมด พร้อมสถานะการสมัคร เช่น รอดำเนินการ, กำลังพิจารณา, ผ่านการคัดเลือก เป็นต้น',
    13: 'ได้ คุณสามารถยกเลิกการสมัครได้ที่หน้ารายละเอียดใบสมัคร กดปุ่ม "ยกเลิกการสมัคร" การยกเลิกจะไม่สามารถกู้คืนได้',
    14: 'เอกสารที่แนะนำให้อัปโหลด ได้แก่ Resume, ใบอนุญาตประกอบวิชาชีพ, ประกาศนียบัตร, หลักฐานการศึกษา และบัตรประจำตัวประชาชน เอกสารเหล่านี้จะช่วยเพิ่มโอกาสในการได้รับการพิจารณา',
    15: 'สมัครสมาชิกในฐานะโรงพยาบาล ยืนยันตัวตนกับเอกสารที่จำเป็น จากนั้นไปที่ "ลงประกาศงาน" กรอกรายละเอียดงานและกด "เผยแพร่"',
    16: 'ไปที่ "จัดการผู้สมัคร" คุณจะเห็นรายการผู้สมัครทั้งหมดของงานที่ลงประกาศ สามารถดูโปรไฟล์, อัปเดตสถานะ, และแชทกับผู้สมัครได้',
    17: 'รีวิวช่วยให้ผู้หางานเข้าใจวัฒนธรรมและสภาพแวดล้อมการทำงานของโรงพยาบาล รีวิวดีจะช่วยดึงดูดผู้สมัครคุณภาพ โรงพยาบาลสามารถตอบกลับรีวิวได้',
    18: 'ในช่วงทดลองใช้ฟรี ระบบยังไม่เรียกเก็บเงินจริง โรงพยาบาลและผู้ใช้งานจะได้รับสิทธิ์ตามสถานะบัญชีและการใช้งานที่ระบบเปิดให้ก่อน เมื่อเปิดระบบชำระเงินอย่างเป็นทางการ เราจะแจ้งแพ็กเกจและเงื่อนไขอีกครั้ง',
    19: 'ขณะนี้ยังไม่มีการเปิดรับชำระเงินจริงในแอป เมื่อเปิดระบบชำระเงินแล้ว เราจะแจ้งช่องทางที่รองรับให้ทราบอีกครั้ง',
    20: 'ในช่วงที่ยังไม่เปิดเก็บเงินจริง ระบบจะยังไม่มีใบเสร็จหรือประวัติการชำระเงิน เมื่อเปิดใช้งานจริงแล้ว เราจะแจ้งขั้นตอนการรับเอกสารให้ทราบอีกครั้ง',
}
for i, th_text in faq_answers_th.items():
    old = f"answer: '{th_text}'"
    new = f"answer: t('help.faqAnswer{i}')"
    if old in content:
        content = content.replace(old, new, 1)
    else:
        # Try without quotes (might be multiline)
        if th_text in content:
            content = content.replace(f"'{th_text}'", f"t('help.faqAnswer{i}')", 1)

# Email subject
content = content.replace(
    "subject=ขอความช่วยเหลือ",
    "subject=${t('help.emailSubject')}"
)
# "ทั้งหมด" tab
content = re.sub(
    r'>\s*ทั้งหมด\s*<',
    ">{t('help.allTab')}<",
    content
)
if content != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"    Fixed")
else:
    print(f"    No changes")

# --- MapJobsScreen.tsx ---
print("\n  MapJobsScreen.tsx:")
path = os.path.join(BASE, 'src/screens/map/MapJobsScreen.tsx')
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
original = content

# Staff type labels - replace the values in the object
staff_replacements = [
    ("rn: 'พยาบาลวิชาชีพ'", "rn: t('map.staffTypeRN')"),
    ("RN: 'พยาบาลวิชาชีพ'", "RN: t('map.staffTypeRN')"),
    ("lpn: 'ผู้ช่วยพยาบาล'", "lpn: t('map.staffTypeLPN')"),
    ("LPN: 'ผู้ช่วยพยาบาล'", "LPN: t('map.staffTypeLPN')"),
    ("PN: 'ผู้ช่วยพยาบาล'", "PN: t('map.staffTypeLPN')"),
    ("NA: 'ผู้ช่วยพยาบาล'", "NA: t('map.staffTypeLPN')"),
    ("nurse_aide: 'ผู้ช่วยพยาบาล'", "nurse_aide: t('map.staffTypeLPN')"),
    ("CG: 'ผู้ดูแลผู้ป่วย'", "CG: t('map.staffTypeCG')"),
    ("caregiver: 'ผู้ดูแลผู้ป่วย'", "caregiver: t('map.staffTypeCG')"),
    ("SITTER: 'เฝ้าไข้'", "SITTER: t('map.staffTypeSitter')"),
    ("ANES: 'ผู้ช่วยวิสัญญี / วิสัญญีพยาบาล'", "ANES: t('map.staffTypeAnes')"),
    ("OTHER: 'อื่นๆ'", "OTHER: t('map.staffTypeOther')"),
    ("other: 'อื่นๆ'", "other: t('map.staffTypeOther')"),
]
for old, new in staff_replacements:
    content = content.replace(old, new, 1)

# Template literals and other Thai strings
content = re.sub(
    r"`\$\{jobs\.length\} งานบนแผนที่`",
    "t('map.jobsOnMap').replace('{count}', String(jobs.length))",
    content
)
content = re.sub(
    r'<FilterChip label=\{`ค้นหา: \$\{filter\.searchTerm\}`\}',
    "<FilterChip label={t('map.searchPrefix').replace('{term}', filter.searchTerm)}",
    content
)
content = content.replace(
    '<LegendDot color="#0EA5E9" label="≥฿1,500" />',
    '<LegendDot color="#0EA5E9" label={t(\'map.legendHigh\')} />'
)
content = content.replace(
    '<LegendDot color="#10B981" label="≥฿700" />',
    '<LegendDot color="#10B981" label={t(\'map.legendMid\')} />'
)
content = content.replace(
    '<LegendDot color="#F59E0B" label="< ฿700" />',
    '<LegendDot color="#F59E0B" label={t(\'map.legendLow\')} />'
)
content = re.sub(
    r'>แสดง\{draftCount\} รายการ<',
    ">{t('map.showResults').replace('{count}', String(draftCount))}<",
    content
)
if content != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"    Fixed")
else:
    print(f"    No changes")

# --- ShopScreen.tsx ---
print("\n  ShopScreen.tsx:")
path = os.path.join(BASE, 'src/screens/shop/ShopScreen.tsx')
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
original = content

# Audience descriptions
audience_map = {
    'free': 'เหมาะกับคนที่เพิ่งเริ่มใช้งานและยังลงประกาศไม่บ่อย',
    'premium': 'คุ้มกับผู้ใช้ทั่วไปที่ต้องการสิทธิ์ใช้งานมากขึ้นโดยไม่ผูกกับสายงานพยาบาลโดยตรง',
    'nurse_pro': 'คุ้มกับพยาบาลที่ลงเวรหรือหางานต่อเนื่องทุกสัปดาห์',
    'hospital_starter': 'คุ้มกับองค์กรที่ลงประกาศเป็นรอบและยังไม่ต้องดันหลายตำแหน่งพร้อมกัน',
    'hospital_pro': 'คุ้มกับองค์กรที่เปิดรับหลายตำแหน่งต่อเนื่องและต้องการความคล่องตัวมากขึ้น',
    'hospital_enterprise': 'คุ้มกับองค์กรที่ต้องดันประกาศหลายชิ้นพร้อมกันตลอดเดือน',
}
for key, th_text in audience_map.items():
    en_key = {
        'free': 'audienceFree',
        'premium': 'audiencePremium',
        'nurse_pro': 'audienceNursePro',
        'hospital_starter': 'audienceHospitalStarter',
        'hospital_pro': 'audienceHospitalPro',
        'hospital_enterprise': 'audienceHospitalEnterprise',
    }[key]
    content = content.replace(f"  {key}: '{th_text}'", f"  {key}: t('shop.{en_key}')")

# Billing unavailable alerts
content = re.sub(
    r'`\$\{subject\} จะเปิดให้ใช้งานแบบชำระเงินจริงได้อีกครั้งเมื่อระบบชำระเงินพร้อมใช้งาน ตอนนี้บัญชีใช้งานแบบโควตารายเดือนโดยไม่มีการตัดเงิน`',
    "t('shop.billingUnavailable').replace('{subject}', subject)",
    content
)
content = re.sub(
    r"`แพ็กเกจ \$\{SUBSCRIPTION_PLANS\[plan\]\.name\} ยังไม่เปิดเก็บเงินจริง ตอนนี้บัญชีใช้ฟีเจอร์ได้ตามโควตารายเดือนของช่วงเปิดตัว`",
    "t('shop.packageNotCharged').replace('{name}', SUBSCRIPTION_PLANS[plan].name)",
    content
)
content = re.sub(
    r"showBillingUnavailableAlert\(`แพ็กเกจ \$\{SUBSCRIPTION_PLANS\[plan\]\.name\}`\)",
    "showBillingUnavailableAlert(t('shop.packageNotCharged').replace('{name}', SUBSCRIPTION_PLANS[plan].name))",
    content
)
content = content.replace(
    "'บริการเสริมนี้ยังไม่เปิดเก็บเงินจริง ตอนนี้ใช้งานได้ตามโควตารายเดือนของบัญชี'",
    "t('shop.addonNotCharged')"
)
content = content.replace(
    '`โค้ด ${referralInfo.referralCode} ถูกคัดลอกแล้ว`',
    "t('shop.referralCopied').replace('{code}', referralInfo.referralCode)"
)
# Launch notice
content = content.replace(
    "บัญชีนี้ใช้งานฟีเจอร์หลักและบริการเสริมได้ในช่วงเปิดตัว แต่แต่ละรายการจะมีโควตารายเดือนตามประเภทบัญชี",
    "{t('shop.launchNotice1')}"
)
content = content.replace(
    "รายละเอียดที่เห็นอาจแตกต่างกันตามประเภทบัญชีและจำนวนสิทธิ์ที่ใช้ไปแล้วในเดือนนี้",
    "{t('shop.launchNotice2')}"
)
# Hospital features
hospital_features = [
    ('ลงประกาศและติดตามผู้สนใจได้ภายในโควตารายเดือนขององค์กร', 'hospitalFeature1'),
    ('ใช้ป้ายด่วน ต่ออายุ และดันโพสต์ได้ตามสิทธิ์ที่เหลือ', 'hospitalFeature2'),
    ('คุยต่อผ่านแชทและจัดการผู้สมัครได้ภายใต้โควตาการใช้งานของบัญชี', 'hospitalFeature3'),
]
for th_text, key in hospital_features:
    content = content.replace(f"'{th_text}'", f"t('shop.{key}')")
# Default features
default_features = [
    ('ใช้งานฟีเจอร์หลักได้ทันทีภายในโควตารายเดือนของบัญชี', 'defaultFeature1'),
    ('บริการเสริมบางรายการพร้อมใช้ตามสิทธิ์ที่ระบบจัดสรรให้', 'defaultFeature2'),
    ('ระบบจะรีเซ็ตโควตาใหม่ทุกเดือนเพื่อให้ใช้งานต่อได้อย่างต่อเนื่อง', 'defaultFeature3'),
]
for th_text, key in default_features:
    content = content.replace(f"'{th_text}'", f"t('shop.{key}')")
# Free plan
content = content.replace("'🆓 ฟรี'", "t('shop.freePlan')")
content = content.replace("'🆓 ฟรี'", "t('shop.freePlan')")  # might be multiple
# "ใช้กับ"
content = re.sub(
    r"ใช้กับ \{getCampaignPackageDisplayLabel",
    "{t('shop.usedWith').replace('{label}', getCampaignPackageDisplayLabel",
    content
)
# From/to price
content = re.sub(
    r"` • จาก ฿\$\{pendingCampaignCode\.originalAmount\.toLocaleString\(\)\} เหลือ ฿\$\{pendingCampaignCode\.finalAmount\.toLocaleString\(\)\}`",
    "` • ${t('shop.fromPrice').replace('{original}', pendingCampaignCode.originalAmount.toLocaleString()).replace('{final}', pendingCampaignCode.finalAmount.toLocaleString())}`",
    content
)
# Free access addons title
content = content.replace(
    "'บริการเสริมที่พร้อมใช้ในบัญชีนี้'",
    "t('shop.freeAccessAddonsTitle')"
)
# Add-on descriptions
content = content.replace(
    ">ใช้สำหรับเพิ่มความยืดหยุ่นเมื่อโควตาโพสต์ประจำเดือนใกล้เต็ม<",
    ">{t('shop.extraPostDesc')}<"
)
content = content.replace(
    "'ดูโควตาในบัญชี'",
    "t('shop.viewQuota')"
)
content = content.replace(
    "ขยายเวลาให้ประกาศยังมองเห็นต่อได้ภายในโควตาบริการเสริมของเดือนนี้",
    "{t('shop.extendPostDesc')}"
)
content = content.replace(
    ">ช่วยให้ประกาศสำคัญถูกมองเห็นได้เร็วขึ้นตามโควตาบริการเสริมที่เหลือ<",
    ">{t('shop.urgentPostDesc')}<"
)
# Referral benefit
content = content.replace(
    "เพื่อนสมัครและอัปเกรด คุณและเพื่อนได้รับสิทธิ์พรีเมียมฟรี 1 เดือนตามประเภทบัญชี",
    "{t('shop.referralBenefit')}"
)
# Billing cycle
content = re.sub(r"'ปี'", "t('shop.perYear')", content)
content = re.sub(r"'เดือน'", "t('shop.perMonth')", content)
# Savings
content = re.sub(
    r'>ประหยัด \{savings\}%<',
    ">{t('shop.savedPercent').replace('{pct}', String(savings))}<",
    content
)

if content != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"    Fixed")
else:
    print(f"    No changes")

# --- OnboardingSurveyScreen.tsx ---
print("\n  OnboardingSurveyScreen.tsx:")
path = os.path.join(BASE, 'src/screens/auth/OnboardingSurveyScreen.tsx')
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
original = content

# Step subtitles
content = content.replace(
    "subtitle: 'สรุปให้ว่าบทบาทของคุณทำอะไรได้บ้าง และเริ่มตรงไหนถึงจะเร็วและง่ายที่สุด'",
    "subtitle: t('onboarding.step1Subtitle')"
)
content = content.replace(
    "subtitle: 'ดูทางลัดของแอปก่อนเริ่มใช้งานจริง เพื่อไปถึงหน้าสำคัญได้ไวขึ้น'",
    "subtitle: t('onboarding.step2Subtitle')"
)
content = content.replace(
    "subtitle: 'เลือกข้อมูลพื้นฐานเพื่อให้ระบบแนะนำงานหรือผู้ดูแลได้ตรงและปลอดภัยยิ่งขึ้น'",
    "subtitle: t('onboarding.step3Subtitle')"
)

# Nurse hero subtitle
content = content.replace(
    "heroSubtitle: 'NurseGo จะช่วยเรียงงานที่เหมาะกับความถนัด พื้นที่ และเวลาที่คุณต้องการ พร้อมขั้นตอนคุยงานที่ต่อเนื่องและเข้าใจง่าย'",
    "heroSubtitle: t('onboarding.nurseHeroSubtitle')"
)
# Nurse highlight descriptions
content = content.replace(
    "description: 'ดูงานล่าสุด กรองตามจังหวัด แผนก หรือเปิดโหมดงานใกล้คุณได้ทันที'",
    "description: t('onboarding.nurseHighlightDesc1')"
)
content = content.replace(
    "description: 'เริ่มแชทจากหน้าโพสต์และติดตามรายละเอียดงานต่อได้สะดวกในแท็บข้อความ'",
    "description: t('onboarding.nurseHighlightDesc2')"
)
content = content.replace(
    "description: 'ยืนยันตัวตนและเติมโปรไฟล์ให้ครบ เพื่อให้ผู้จ้างตัดสินใจได้ง่ายและมั่นใจขึ้น'",
    "description: t('onboarding.nurseHighlightDesc3')"
)
# Nurse feature descriptions
content = content.replace(
    "description: 'รวมงานใหม่ ฟิลเตอร์ และโหมดงานใกล้คุณไว้ในที่เดียว'",
    "description: t('onboarding.nurseFeatureDesc1')"
)
content = content.replace(
    "description: 'สำหรับพยาบาล แท็บนี้จะพาไปยังหน้าประกาศหาคนช่วยขึ้นเวรแทนได้ทันที'",
    "description: t('onboarding.nurseFeatureDesc2')"
)
content = content.replace(
    "description: 'รวมทุกห้องแชทเรื่องงานไว้ในที่เดียว เพื่อคุยต่อได้เร็วและไม่หลุดบริบท'",
    "description: t('onboarding.nurseFeatureDesc3')"
)
content = content.replace(
    "description: 'ดูรีวิว ยืนยันตัวตน และจัดการข้อมูลที่ช่วยเพิ่มความน่าเชื่อถือ'",
    "description: t('onboarding.nurseFeatureDesc4')"
)
# Nurse setup subtitle
content = content.replace(
    "setupSubtitle: 'ข้อมูลนี้ช่วยให้แอปกรองงานได้แม่นขึ้นตั้งแต่ครั้งแรก และช่วยให้เจองานได้เร็วขึ้น'",
    "setupSubtitle: t('onboarding.nurseSetupSubtitle')"
)
# Hospital hero subtitle
content = content.replace(
    "heroSubtitle: 'บทบาทองค์กรจะโฟกัสที่การลงประกาศอย่างเป็นระบบ ดูรายชื่อผู้สนใจ และติดตามต่อได้รวดเร็ว'",
    "heroSubtitle: t('onboarding.hospitalHeroSubtitle')"
)
# Hospital highlights
content = content.replace(
    "title: 'ลงประกาศรับสมัครได้เร็ว'",
    "title: t('onboarding.hospitalHighlightTitle1')"
)
content = content.replace(
    "description: 'สร้างประกาศงานพร้อมเงินเดือน สวัสดิการ และช่องทางคุยที่จัดการได้ง่าย'",
    "description: t('onboarding.hospitalHighlightDesc1')"
)
content = content.replace(
    "title: 'ดูผู้สนใจเป็นระเบียบ'",
    "title: t('onboarding.hospitalHighlightTitle2')"
)
content = content.replace(
    "description: 'ติดตามคนที่สนใจจากหน้า Applicants และแยกตามประกาศได้ชัดเจน'",
    "description: t('onboarding.hospitalHighlightDesc2')"
)
content = content.replace(
    "title: 'คุยต่อได้ทันที'",
    "title: t('onboarding.hospitalHighlightTitle3')"
)
content = content.replace(
    "description: 'เปิดแชทกับผู้สมัครต่อในแอปได้เลย เพื่อให้ข้อมูลครบและติดตามง่าย'",
    "description: t('onboarding.hospitalHighlightDesc3')"
)
# Hospital feature descriptions
content = content.replace(
    "description: 'ดูบอร์ดงานและคำแนะนำต่าง ๆ แต่จุดหลักของคุณคือการโพสต์และจัดการผู้สนใจ'",
    "description: t('onboarding.hospitalFeatureDesc1')"
)
content = content.replace(
    "description: 'แท็บนี้จะเปิดหน้าสำหรับลงประกาศรับสมัครบุคลากรให้เหมาะกับการใช้งานขององค์กรโดยอัตโนมัติ'",
    "description: t('onboarding.hospitalFeatureDesc2')"
)
content = content.replace(
    "description: 'ใช้คุยกับผู้สมัครต่อได้อย่างรวดเร็วโดยไม่ต้องสลับแอป'",
    "description: t('onboarding.hospitalFeatureDesc3')"
)
content = content.replace(
    "description: 'เข้าถึงประกาศ Applicants และข้อมูลองค์กรเพื่อบริหารงานต่อได้ง่าย'",
    "description: t('onboarding.hospitalFeatureDesc4')"
)
# Hospital setup subtitle
content = content.replace(
    "setupSubtitle: 'ระบุจังหวัดและระดับความเร่งด่วน เพื่อให้การโพสต์และจัดการผู้สนใจลื่นไหลขึ้น'",
    "setupSubtitle: t('onboarding.hospitalSetupSubtitle')"
)
# User hero
content = content.replace(
    "heroTitle: 'ค้นหาผู้ดูแลที่เหมาะสม ติดต่ออย่างเป็นส่วนตัว และตัดสินใจได้มั่นใจ'",
    "heroTitle: t('onboarding.userHeroTitle')"
)
content = content.replace(
    "heroSubtitle: 'แอปจะช่วยให้คุณหาผู้ดูแลที่ตรงประเภทงานและพื้นที่ พร้อมดูโปรไฟล์ รีวิว และคุยต่อได้อย่างสะดวก'",
    "heroSubtitle: t('onboarding.userHeroSubtitle')"
)
# User highlights
content = content.replace(
    "title: 'ดูประกาศที่ตรงความต้องการ'",
    "title: t('onboarding.userHighlightTitle1')"
)
content = content.replace(
    "description: 'ใช้ตัวกรองเพื่อหาผู้ดูแลที่เหมาะกับงานและพื้นที่ได้เร็วขึ้น'",
    "description: t('onboarding.userHighlightDesc1')"
)
content = content.replace(
    "title: 'ดูโปรไฟล์ก่อนตัดสินใจ'",
    "title: t('onboarding.userHighlightTitle2')"
)
content = content.replace(
    "description: 'เช็กประสบการณ์ รีวิว และสถานะการยืนยันตัวตนเพื่อเพิ่มความมั่นใจ'",
    "description: t('onboarding.userHighlightDesc2')"
)
content = content.replace(
    "title: 'คุยได้ตามช่องทางที่สะดวก'",
    "title: t('onboarding.userHighlightTitle3')"
)
content = content.replace(
    "description: 'เลือกโทร, LINE หรือแชทในแอปตามช่องทางที่ผู้โพสต์เปิดไว้'",
    "description: t('onboarding.userHighlightDesc3')"
)
# User feature descriptions
content = content.replace(
    "description: 'ค้นหาโพสต์ดูแลผู้ป่วยและใช้ตัวกรองเพื่อเจอคนที่เหมาะได้เร็วขึ้น'",
    "description: t('onboarding.userFeatureDesc1')"
)
content = content.replace(
    "description: 'ถ้าต้องการหาผู้ดูแลเอง แท็บนี้จะเปิดหน้ากรอกข้อมูลแบบเป็นขั้นตอนให้ทันที'",
    "description: t('onboarding.userFeatureDesc2')"
)
content = content.replace(
    "description: 'ติดตามการพูดคุยกับผู้ดูแลที่คุณสนใจได้ต่อเนื่องในที่เดียว'",
    "description: t('onboarding.userFeatureDesc3')"
)
content = content.replace(
    "description: 'จัดการข้อมูลส่วนตัว รายการโปรด และการตั้งค่าความเป็นส่วนตัวต่าง ๆ'",
    "description: t('onboarding.userFeatureDesc4')"
)
# User setup subtitle
content = content.replace(
    "setupSubtitle: 'ข้อมูลพื้นฐานนี้ช่วยให้แอปแนะนำผู้ดูแลได้ตรงกับความต้องการมากขึ้น และช่วยให้เลือกได้ง่ายขึ้น'",
    "setupSubtitle: t('onboarding.userSetupSubtitle')"
)

# Dynamic strings
content = re.sub(
    r"`\$\{selectedTypes\.length\} ประเภทวิชาชีพ`",
    "t('onboarding.selectedTypesCount').replace('{count}', String(selectedTypes.length))",
    content
)
content = re.sub(
    r"`\$\{selectedStep3\.length\} ตัวเลือกที่สนใจ`",
    "t('onboarding.selectedOptionsCount').replace('{count}', String(selectedStep3.length))",
    content
)
content = content.replace(
    ">ทุกขั้นตอนข้ามได้ และกลับมาดูใหม่ได้จากหน้า Settings<",
    ">{t('onboarding.skipNotice')}<"
)
content = content.replace(
    ">เริ่มจาก 3 อย่างนี้ จะใช้งานได้คล่องขึ้นทันที<",
    ">{t('onboarding.quickActionsTitle')}<"
)

# Nurse quick actions
content = content.replace(
    ">1. เปิดงานใกล้คุณ เพื่อรู้ไวเมื่อมีเวรใหม่ในพื้นที่ที่สนใจ<",
    ">{t('onboarding.nurseQuickAction1')}<"
)
content = content.replace(
    ">2. ยืนยันตัวตน เพื่อให้ผู้จ้างมั่นใจและตัดสินใจได้เร็วขึ้น<",
    ">{t('onboarding.nurseQuickAction2')}<"
)
content = content.replace(
    ">3. เติมโปรไฟล์และรีวิวให้ครบ เพื่อให้โอกาสงานเข้าหาคุณง่ายขึ้น<",
    ">{t('onboarding.nurseQuickAction3')}<"
)
# Hospital quick actions
content = content.replace(
    ">1. เติมข้อมูลองค์กรในโปรไฟล์<",
    ">{t('onboarding.hospitalQuickAction1')}<"
)
content = content.replace(
    ">2. สร้างประกาศแรกจากแท็บโพสต์<",
    ">{t('onboarding.hospitalQuickAction2')}<"
)
content = content.replace(
    ">3. ติดตามผู้สมัครจาก Applicants และแชท<",
    ">{t('onboarding.hospitalQuickAction3')}<"
)
# User quick actions
content = content.replace(
    ">1. ค้นหาผู้ดูแลจากหน้าแรกก่อน<",
    ">{t('onboarding.userQuickAction1')}<"
)
content = content.replace(
    ">2. ดูโปรไฟล์และรีวิวก่อนติดต่อ<",
    ">{t('onboarding.userQuickAction2')}<"
)
content = content.replace(
    ">3. บันทึกประกาศที่สนใจไว้เปรียบเทียบ<",
    ">{t('onboarding.userQuickAction3')}<"
)
# Hints
content = content.replace(
    ">เลือกได้หลายประเภท หากคุณทำงานได้มากกว่าหนึ่งสาย<",
    ">{t('onboarding.multipleTypesHint')}<"
)
content = content.replace(
    ">ใช้สำหรับตั้งต้นการค้นหาและช่วยให้ผลลัพธ์ตรงพื้นที่มากขึ้น<",
    ">{t('onboarding.locationHint')}<"
)
content = content.replace(
    ">เลือกเฉพาะที่เกี่ยวกับคุณจริง ๆ เพื่อให้คำแนะนำที่แม่นขึ้น<",
    ">{t('onboarding.interestHint')}<"
)

if content != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"    Fixed")
else:
    print(f"    No changes")

# Final count
print("\n📊 Final Thai character count:")
import subprocess
for f in [
    'src/screens/auth/ChooseRoleScreen.tsx',
    'src/screens/auth/OnboardingSurveyScreen.tsx',
    'src/screens/chat/ChatScreens.tsx',
    'src/screens/documents/DocumentsScreen.tsx',
    'src/screens/favorites/FavoritesScreen.tsx',
    'src/screens/feedback/FeedbackScreen.tsx',
    'src/screens/help/HelpScreen.tsx',
    'src/screens/legal/PrivacyScreen.tsx',
    'src/screens/legal/TermsScreen.tsx',
    'src/screens/map/MapJobsScreen.tsx',
    'src/screens/myposts/MyPostsScreen.tsx',
    'src/screens/notifications/NotificationsScreen.tsx',
    'src/screens/payment/PaymentScreen.tsx',
    'src/screens/reviews/ReviewsScreen.tsx',
    'src/screens/shop/ShopScreen.tsx',
    'src/screens/verification/VerificationScreen.tsx',
]:
    result = subprocess.run(['grep', '-c', '[ก-๙]', os.path.join(BASE, f)],
                          capture_output=True, text=True)
    count = result.stdout.strip()
    print(f"  {count:>3} {f}")

print("\n✅ Pass 3 complete!")
