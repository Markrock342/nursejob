#!/usr/bin/env python3
"""
Fix dictionary key insertion for sections with nested braces.
Uses brace-depth counting instead of regex.
"""
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def find_section_end(content, section_name):
    """Find the line index of the closing '},\n' for a top-level section."""
    marker = f'  {section_name}: {{'
    lines = content.split('\n')
    inside = False
    depth = 0
    for i, line in enumerate(lines):
        if not inside:
            if line.strip().startswith(f'{section_name}: {{') and line.startswith('  '):
                inside = True
                depth = line.count('{') - line.count('}')
                if depth == 0:
                    return i  # single-line section
        else:
            depth += line.count('{') - line.count('}')
            if depth <= 0:
                return i
    return -1

def add_keys_to_section(filepath, section_name, new_keys):
    """Add keys to a section, inserting before the closing }."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    end_idx = find_section_end(content, section_name)
    
    if end_idx == -1:
        print(f"  ⚠️ Section '{section_name}' not found")
        return 0
    
    # Check which keys already exist in this section
    # Find start of section
    start_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith(f'{section_name}: {{') and line.startswith('  '):
            start_idx = i
            break
    
    if start_idx == -1:
        return 0
    
    section_block = '\n'.join(lines[start_idx:end_idx+1])
    
    keys_to_insert = []
    for key, value in new_keys.items():
        if f'    {key}:' in section_block or f'    {key} :' in section_block:
            continue
        escaped = value.replace("'", "\\'")
        keys_to_insert.append(f"    {key}: '{escaped}',")
    
    if not keys_to_insert:
        return 0
    
    # Insert before end_idx line
    for k in reversed(keys_to_insert):
        lines.insert(end_idx, k)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    return len(keys_to_insert)


# Keys that failed to insert in pass 3
MISSING_TH = {
    'chat': {
        'reset': 'รีเซ็ต',
        'imageViewerHint': 'ใช้ 2 นิ้วซูม/ลาก หรือกดปุ่มซูมและดาวน์โหลดด้านบน',
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

MISSING_EN = {
    'chat': {
        'reset': 'Reset',
        'imageViewerHint': 'Use 2 fingers to zoom/drag or use the zoom and download buttons above',
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
        'audienceFree': "Great for new users who don't post frequently",
        'audiencePremium': 'Great for general users who want more features without being tied to nursing specifically',
        'audienceNursePro': 'Great for nurses who take shifts or search for jobs weekly',
        'audienceHospitalStarter': "Great for organizations that post periodically without needing to boost multiple positions at once",
        'audienceHospitalPro': 'Great for organizations accepting multiple positions continuously and needing more flexibility',
        'audienceHospitalEnterprise': 'Great for organizations that need to boost multiple posts simultaneously all month',
        'billingUnavailable': '{subject} will be available for paid use again when the payment system is ready. Currently the account uses monthly quota without charges.',
        'packageNotCharged': "Package {name} is not yet charging. Currently the account can use features within the launch period monthly quota.",
        'addonNotCharged': "This add-on is not yet charging. Currently usable within your account's monthly quota.",
        'referralCopied': 'Code {code} copied',
        'launchNotice1': 'This account can use core features and add-ons during launch, but each item has a monthly quota based on account type.',
        'launchNotice2': 'Details shown may vary by account type and remaining quota used this month.',
        'hospitalFeature1': "Post jobs and track interested candidates within your organization's monthly quota",
        'hospitalFeature2': 'Use urgent badges, extensions, and boosts within remaining quota',
        'hospitalFeature3': "Chat and manage applicants within your account's usage quota",
        'defaultFeature1': "Use core features immediately within your account's monthly quota",
        'defaultFeature2': 'Some add-on services are available based on system-allocated quota',
        'defaultFeature3': 'Quota resets monthly so you can continue using the service',
        'freePlan': '🆓 Free',
        'usedWith': 'Use with {label}',
        'fromPrice': 'From ฿{original} to ฿{final}',
        'freeAccessAddonsTitle': 'Add-on services available in this account',
        'extraPostDesc': 'Use to add flexibility when your monthly post quota is nearly full',
        'viewQuota': 'View account quota',
        'extendPostDesc': "Extend post visibility within this month's add-on service quota",
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
        'userFeatureDesc2': "If you want to find a caregiver yourself, this tab opens a step-by-step form instantly",
        'userFeatureDesc3': "Follow up on conversations with caregivers you're interested in, all in one place",
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

print("Adding missing dictionary keys with brace-depth counting...")
th_path = os.path.join(BASE, 'src/i18n/dictionaries/th.ts')
en_path = os.path.join(BASE, 'src/i18n/dictionaries/en.ts')

th_total = 0
for section, keys in MISSING_TH.items():
    n = add_keys_to_section(th_path, section, keys)
    if n > 0:
        print(f"  th.ts/{section}: +{n} keys")
    th_total += n

en_total = 0
for section, keys in MISSING_EN.items():
    n = add_keys_to_section(en_path, section, keys)
    if n > 0:
        print(f"  en.ts/{section}: +{n} keys")
    en_total += n

print(f"\nTotal: th.ts +{th_total}, en.ts +{en_total}")
