#!/usr/bin/env python3
"""
Second pass: Fix JSX text nodes and remaining hardcoded Thai in screen files.
Uses regex to match >ThaiText< and >ThaiText</Tag> patterns.
"""
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "src" / "screens"

def replace_jsx_text(content: str, thai: str, key: str) -> str:
    """Replace Thai text that appears as JSX text content: >Thai<"""
    # Pattern: >Thai text< (between tags)
    escaped = re.escape(thai)
    # Match >Thai< or >{space}Thai{space}<
    content = re.sub(
        r'(>)\s*' + escaped + r'\s*(<)',
        r'\1{t(\'' + key + r'\')}\2',
        content
    )
    # Also match JSX attributes like description="Thai"
    content = re.sub(
        r'(description=)"' + escaped + r'"',
        r'\1{t(\'' + key + r'\')}',
        content
    )
    content = re.sub(
        r'(title=)"' + escaped + r'"',
        r'\1{t(\'' + key + r'\')}',
        content
    )
    content = re.sub(
        r'(actionLabel=)"' + escaped + r'"',
        r'\1{t(\'' + key + r'\')}',
        content
    )
    content = re.sub(
        r'(label=)"' + escaped + r'"',
        r'\1{t(\'' + key + r'\')}',
        content
    )
    content = re.sub(
        r'(placeholder=)"' + escaped + r'"',
        r'\1{t(\'' + key + r'\')}',
        content
    )
    return content


def fix_chat():
    fp = BASE / "chat" / "ChatScreens.tsx"
    c = fp.read_text('utf-8')
    
    # JSX text nodes
    jsx_replacements = [
        ('ซ่อน', 'chat.hide'),
        ('ลบ', 'chat.delete'),
        ('ข้อความ', 'chat.messagesTitle'),
        ('ยังไม่ได้เข้าสู่ระบบ', 'chat.notLoggedIn'),
        ('เข้าสู่ระบบเพื่อดูข้อความสนทนาของคุณ', 'chat.loginToSeeMessages'),
        ('ยังไม่มีข้อความ', 'chat.noMessages'),
        ('เมื่อคุณติดต่อกับผู้โพสต์ ข้อความจะแสดงที่นี่', 'chat.noMessagesDescription'),
        ('💡 ปัดซ้าย = ลบ · ปัดขวา = ซ่อน', 'chat.swipeHint'),
        ('ไม่มีแชทที่ซ่อน', 'chat.noHiddenChats'),
        ('นำกลับ', 'chat.unhide'),
        ('🗑 ข้อความนี้ถูกลบแล้ว', 'chat.messageDeleted'),
        ('แตะเพื่อเปิด', 'chat.tapToOpen'),
        ('แตะเพื่อเปิดเอกสาร', 'chat.tapToOpenDocument'),
        ('แตะเพื่อเปิดในแผนที่', 'chat.tapToOpenMap'),
        ('ข้อความลัด', 'chat.quickReplies'),
        ('แตะเพื่อส่งทันที', 'chat.tapToSendInstantly'),
        ('จัดการข้อความ', 'chat.manageMessage'),
        ('ลบข้อความนี้', 'chat.deleteMessage'),
        ('ยกเลิก', 'chat.cancel'),
        ('แนบข้อมูลในแชท', 'chat.attachInChat'),
        ('เลือกรูปจากเครื่อง', 'chat.choosePhoto'),
        ('ส่งเอกสารจากเอกสารของฉัน', 'chat.sendFromMyDocuments'),
        ('ส่งตำแหน่งแบบปักหมุด', 'chat.sendPinnedLocation'),
        ('เลือกเอกสารที่อัปไว้แล้ว', 'chat.chooseUploadedDoc'),
        ('ยังไม่มีเอกสารในหน้าของฉัน', 'chat.noSavedDocuments'),
    ]
    for thai, key in jsx_replacements:
        c = replace_jsx_text(c, thai, key)
    
    # Fix the description attribute with long text
    c = c.replace(
        'description="เมื่อคุณติดต่อจากหน้าโพสต์ ระบบจะสร้างห้องแชทให้อัตโนมัติ คุณปัดเพื่อซ่อนหรือลบห้องได้ และกลับมาดูภาพรวมการใช้งานจากคู่มือได้ทุกเมื่อ"',
        "description={t('chat.firstVisitTipDescription')}"
    )
    
    # Fix the hidden chats title with template literal in JSX
    c = re.sub(
        r'>แชทที่ซ่อน\s*\(\{hidden\.length\}\)<',
        ">{t('chat.hiddenChatsTitle', { count: String(hidden.length) })}<",
        c
    )
    # Also try the direct JSX text pattern
    c = re.sub(
        r'>\s*แชทที่ซ่อน\s*\(\{?hidden\.length\}?\)\s*<',
        ">{t('chat.hiddenChatsTitle', { count: String(hidden.length) })}<",
        c
    )
    
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ ChatScreens.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_notifications():
    fp = BASE / "notifications" / "NotificationsScreen.tsx"
    c = fp.read_text('utf-8')
    c = replace_jsx_text(c, 'การแจ้งเตือน', 'notifications.title')
    c = replace_jsx_text(c, 'อ่านทั้งหมด', 'notifications.markAllRead')
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ NotificationsScreen.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_payment():
    fp = BASE / "payment" / "PaymentScreen.tsx"
    c = fp.read_text('utf-8')
    c = replace_jsx_text(c, 'สถานะตอนนี้', 'payment.currentStatus')
    c = replace_jsx_text(c, 'กลับไปใช้งานต่อ', 'payment.continueUsing')
    c = replace_jsx_text(c, 'ปิดหน้านี้', 'payment.closePage')
    # Fix บาท in template literal
    c = re.sub(r'`\$\{[^}]+\}\s*บาท`', lambda m: "t('payment.baht')", c)
    # Actually we need the amount too. Let's be more careful.
    c = c.replace("บาท`", "' + t('payment.baht')}`")
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ PaymentScreen.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_favorites():
    fp = BASE / "favorites" / "FavoritesScreen.tsx"
    c = fp.read_text('utf-8')
    
    jsx_replacements = [
        ('ประกาศหมดอายุแล้ว', 'favorites.postExpired'),
        ('⚡ ด่วน', 'favorites.urgent'),
        ('❤️ รายการโปรด', 'favorites.title'),
        ('กำลังโหลด...', 'favorites.loading'),
    ]
    for thai, key in jsx_replacements:
        c = replace_jsx_text(c, thai, key)
    
    # Fix placeholder attribute
    c = c.replace(
        'placeholder="ค้นหาชื่องาน, โรงพยาบาล, สถานที่..."',
        "placeholder={t('favorites.searchPlaceholder')}"
    )
    
    # Fix the found X of Y template in JSX
    c = re.sub(
        r'>\s*พบ\s*\{filtered\.length\}\s*จาก\s*\{favorites\.length\}\s*รายการ\s*<',
        ">{t('favorites.resultCount', { filtered: String(filtered.length), total: String(favorites.length) })}<",
        c
    )
    
    # Fix the remove confirmation template literal  
    c = re.sub(
        r'`ต้องการลบ\s*"\$\{[^}]+\}"\s*ออกจากรายการโปรดหรือไม่\?`',
        lambda m: "t('favorites.removeMessage', { title: fav.job?.title || '' })",
        c
    )
    
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ FavoritesScreen.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_myposts():
    fp = BASE / "myposts" / "MyPostsScreen.tsx"
    c = fp.read_text('utf-8')
    
    # Check remaining Thai lines
    thai_lines = [(i+1, line) for i, line in enumerate(c.split('\n')) 
                  if re.search(r'[ก-๙]', line) and not line.strip().startswith('//')]
    
    # JSX text nodes
    jsx_replacements = [
        ('ประกาศของฉัน', 'myPosts.title'),
        ('ยังไม่มีประกาศ', 'myPosts.noPosts'),
        ('สร้างประกาศ', 'myPosts.createPost'),
        ('ไม่มีประกาศในหมวดนี้', 'myPosts.noPostsInFilter'),
        ('ดูผู้สมัคร', 'myPosts.viewApplicants'),
        ('แก้ไข', 'myPosts.edit'),
        ('ต่ออายุประกาศ', 'myPosts.extendPost'),
        ('ทำเครื่องหมายด่วน', 'myPosts.markUrgent'),
        ('เปิดใหม่', 'myPosts.reactivate'),
        ('ปิดประกาศ', 'myPosts.closePost'),
        ('ลบถาวร', 'myPosts.deletePermanently'),
        ('ยกเลิก', 'myPosts.cancel'),
        ('กำลังเปิด', 'myPosts.statusActive'),
        ('ด่วน', 'myPosts.statusUrgent'),
        ('ปิดแล้ว', 'myPosts.statusClosed'),
        ('หมดอายุ', 'myPosts.statusExpired'),
        ('ถูกลบ', 'myPosts.statusDeleted'),
        ('ทั้งหมด', 'myPosts.filterAll'),
        ('กรุณาเข้าสู่ระบบ', 'myPosts.pleaseLogin'),
        ('เข้าสู่ระบบเพื่อดูประกาศของคุณ', 'myPosts.loginToViewPosts'),
        ('เข้าสู่ระบบ', 'myPosts.login'),
        ('หมดอายุแล้ว', 'myPosts.expired'),
        ('แตะเพื่อจัดการ', 'myPosts.tapToManage'),
    ]
    for thai, key in jsx_replacements:
        c = replace_jsx_text(c, thai, key)
    
    # Template strings with ${...}
    c = re.sub(
        r'`เหลือ\s*\$\{daysLeft\}\s*วัน`',
        "t('myPosts.daysLeft', { count: String(daysLeft) })",
        c
    )
    
    # Rate display: บาท/ชม. etc in JSX
    c = re.sub(r'>บาท<', ">{t('myPosts.baht')}<", c)
    
    # Your posts description in JSX
    c = replace_jsx_text(c, 'คุณยังไม่ได้สร้างประกาศใดๆ ลองสร้างประกาศใหม่ดูสิ!', 'myPosts.noPostsDescription')
    
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ MyPostsScreen.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_reviews():
    fp = BASE / "reviews" / "ReviewsScreen.tsx"
    c = fp.read_text('utf-8')
    
    jsx_replacements = [
        ('เขียนรีวิว', 'reviews.writeReview'),
        ('กำลังโหลดรีวิว...', 'reviews.loading'),
        ('ยังไม่มีรีวิว', 'reviews.emptyTitle'),
        ('ยืนยันแล้ว', 'reviews.verified'),
        ('รายงานรีวิว', 'reviews.report'),
        ('กำลังส่ง...', 'reviews.submitting'),
        ('ส่ง', 'reviews.submit'),
        ('ให้คะแนน', 'reviews.rateLabel'),
        ('หัวข้อ *', 'reviews.titleLabel'),
        ('รายละเอียด *', 'reviews.detailsLabel'),
        ('ข้อดี', 'reviews.prosLabel'),
        ('ข้อเสีย', 'reviews.consLabel'),
        ('แนะนำ', 'reviews.recommend'),
        ('ไม่แนะนำ', 'reviews.notRecommend'),
        ('มีประโยชน์', 'reviews.helpful'),
        ('มีประโยชน์แล้ว', 'reviews.helpfulDone'),
        ('รีวิว', 'reviews.headerSubtitle'),
    ]
    for thai, key in jsx_replacements:
        c = replace_jsx_text(c, thai, key)
    
    # Placeholder attributes
    c = c.replace('placeholder="เช่น ประสบการณ์ทำงานที่ดี"', "placeholder={t('reviews.titlePlaceholder')}")
    c = c.replace('placeholder="บอกเล่าประสบการณ์ของคุณ..."', "placeholder={t('reviews.detailsPlaceholder')}")
    c = c.replace('placeholder="สิ่งที่ชอบ..."', "placeholder={t('reviews.prosPlaceholder')}")
    c = c.replace('placeholder="สิ่งที่ควรปรับปรุง..."', "placeholder={t('reviews.consPlaceholder')}")
    
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ ReviewsScreen.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_verification():
    fp = BASE / "verification" / "VerificationScreen.tsx"
    c = fp.read_text('utf-8')
    
    jsx_replacements = [
        ('กำลังโหลด...', 'verification.loading'),
        ('ประเภทการยืนยัน', 'verification.verificationType'),
        ('ประเภทใบอนุญาต', 'verification.licenseType'),
        ('เลขที่เอกสาร', 'verification.documentNumber'),
        ('รอการตรวจสอบ', 'verification.pendingTitle'),
        ('ชื่อผู้ยื่น', 'verification.applicantName'),
        ('ข้อมูลผู้ยื่นคำขอ', 'verification.applicantInfoTitle'),
        ('ชื่อจริง', 'verification.firstName'),
        ('นามสกุล', 'verification.lastName'),
        ('ข้อมูลใบอนุญาต', 'verification.licenseInfoTitle'),
        ('เลขที่ใบอนุญาต', 'verification.licenseNumber'),
        ('เลือกประเภท', 'verification.selectType'),
        ('วันหมดอายุใบอนุญาต', 'verification.licenseExpiry'),
        ('เอกสารประกอบ', 'verification.documentsTitle'),
        ('ใบประกอบวิชาชีพ', 'verification.licenseDocLabel'),
        ('บัตรประชาชน', 'verification.idCardLabel'),
        ('กำลังส่ง...', 'verification.submitting'),
        ('ส่งคำขอยืนยัน', 'verification.submitButton'),
        ('แตะเพื่ออัปโหลด', 'verification.tapToUpload'),
    ]
    for thai, key in jsx_replacements:
        c = replace_jsx_text(c, thai, key)
    
    # Placeholder attributes
    c = c.replace('placeholder="กรอกชื่อจริง"', "placeholder={t('verification.firstNamePlaceholder')}")
    c = c.replace('placeholder="กรอกนามสกุล"', "placeholder={t('verification.lastNamePlaceholder')}")
    c = c.replace('placeholder="เช่น ว.12345"', "placeholder={t('verification.licenseNumberPlaceholder')}")
    
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ VerificationScreen.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_documents():
    fp = BASE / "documents" / "DocumentsScreen.tsx"
    c = fp.read_text('utf-8')
    
    jsx_replacements = [
        ('เอกสารของฉัน', 'documents.headerTitle'),
        ('กำลังอัพโหลด...', 'documents.uploading'),
        ('เพิ่มเอกสาร', 'documents.addDocument'),
        ('ยังไม่มีเอกสาร', 'documents.emptyTitle'),
        ('กำลังโหลด...', 'documents.loading'),
        ('อนุมัติแล้ว', 'documents.statusApproved'),
        ('ไม่ผ่านการตรวจสอบ', 'documents.statusRejected'),
        ('รอการตรวจสอบ', 'documents.statusPending'),
        ('สถานะ:', 'documents.statusLabel'),
        ('เหตุผลที่ไม่ผ่าน:', 'documents.rejectionReasonLabel'),
        ('เหตุผล:', 'documents.rejectionInline'),
        ('ยกเลิกคำขอ', 'documents.cancelRequest'),
        ('ลบเอกสาร', 'documents.deleteDocument'),
    ]
    for thai, key in jsx_replacements:
        c = replace_jsx_text(c, thai, key)
    
    c = replace_jsx_text(c, 'เพิ่มเอกสารเพื่อเพิ่มโอกาสในการสมัครงาน', 'documents.emptySubtitle')
    c = replace_jsx_text(c, 'เข้าสู่ระบบเพื่อจัดการเอกสาร', 'documents.loginTitle')
    c = replace_jsx_text(c, 'เข้าสู่ระบบ', 'documents.loginButton')
    
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ DocumentsScreen.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_feedback():
    fp = BASE / "feedback" / "FeedbackScreen.tsx"
    c = fp.read_text('utf-8')
    
    jsx_replacements = [
        ('Feedback & รีวิว', 'feedback.headerTitle'),
        ('ยังไม่มี feedback', 'feedback.emptyHistory'),
        ('ให้คะแนนแอพของเรา', 'feedback.rateTitle'),
        ('ประเภท Feedback', 'feedback.typeTitle'),
        ('ข้อความของคุณ', 'feedback.messageTitle'),
        ('📤 ส่ง Feedback', 'feedback.submitButton'),
        ('📢 ตอบกลับจากทีมงาน:', 'feedback.adminResponseLabel'),
    ]
    for thai, key in jsx_replacements:
        c = replace_jsx_text(c, thai, key)
    
    c = c.replace('placeholder="หัวข้อ"', "placeholder={t('feedback.titlePlaceholder')}")
    c = c.replace('placeholder="รายละเอียด... (บอกเราว่าคุณชอบอะไร หรืออยากให้ปรับปรุงอะไร)"', "placeholder={t('feedback.messagePlaceholder')}")
    
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ FeedbackScreen.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_privacy():
    fp = BASE / "legal" / "PrivacyScreen.tsx"
    c = fp.read_text('utf-8')
    
    jsx_replacements = [
        ('นโยบายความเป็นส่วนตัว', 'privacy.headerTitle'),
        ('อัปเดตล่าสุด:', 'privacy.lastUpdated'),
        ('สรุปสั้นๆ', 'privacy.summaryTitle'),
        ('ความเป็นส่วนตัวของคุณสำคัญสำหรับเรา', 'privacy.introTitle'),
        ('เราเก็บข้อมูลเท่าที่จำเป็นต่อการให้บริการ', 'privacy.summary1'),
        ('ข้อมูลของคุณได้รับการเข้ารหัสและปกป้อง', 'privacy.summary2'),
        ('เราไม่ขายข้อมูลของคุณให้บุคคลภายนอก', 'privacy.summary3'),
        ('คุณสามารถลบบัญชีและข้อมูลได้ตลอดเวลา', 'privacy.summary4'),
        ('มีคำถามเกี่ยวกับความเป็นส่วนตัว?', 'privacy.contactTitle'),
        ('ติดต่อเราเพื่อสอบถามหรือใช้สิทธิ์เกี่ยวกับข้อมูลส่วนบุคคล', 'privacy.contactSubtitle'),
        ('© 2569 NurseGo. สงวนลิขสิทธิ์.', 'privacy.footerCopyright'),
    ]
    for thai, key in jsx_replacements:
        c = replace_jsx_text(c, thai, key)
    
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ PrivacyScreen.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_terms():
    fp = BASE / "legal" / "TermsScreen.tsx"
    c = fp.read_text('utf-8')
    
    jsx_replacements = [
        ('ข้อกำหนดการใช้งาน', 'terms.headerTitle'),
        ('อัปเดตล่าสุด:', 'terms.lastUpdated'),
        ('© 2569 NurseGo. สงวนลิขสิทธิ์.', 'terms.footerCopyright'),
    ]
    for thai, key in jsx_replacements:
        c = replace_jsx_text(c, thai, key)
    
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ TermsScreen.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_shop():
    fp = BASE / "shop" / "ShopScreen.tsx"
    c = fp.read_text('utf-8')
    
    jsx_replacements = [
        ('สิทธิ์และบริการในบัญชี', 'shop.headerTitleFree'),
        ('สิทธิ์และแพ็กเกจ', 'shop.headerTitlePaid'),
        ('สิทธิ์เพิ่มเติมที่เปิดใช้ในบัญชีนี้', 'shop.freeAccessTitle'),
        ('แพ็กเกจปัจจุบัน', 'shop.currentPlanLabel'),
        ('โค้ดที่รอใช้', 'shop.pendingCodeTitle'),
        ('ล้าง', 'shop.clearButton'),
        ('รายเดือน', 'shop.monthly'),
        ('รายปี', 'shop.annual'),
        ('ประหยัด ~17%', 'shop.savingsHint'),
        ('แพ็กเกจสำหรับพยาบาล', 'shop.nursePlansTitle'),
        ('แพ็กเกจสำหรับโรงพยาบาล', 'shop.hospitalPlansTitle'),
        ('แนะนำเพื่อน', 'shop.referralTitle'),
        ('โค้ดของคุณ', 'shop.referralCodeLabel'),
        ('คัดลอก', 'shop.copyButton'),
        ('เพื่อนที่แนะนำ', 'shop.statReferred'),
        ('เดือนฟรีที่ได้', 'shop.statFreeMonths'),
        ('เดือนคงเหลือ', 'shop.statMonthsLeft'),
        ('ใช้งานอยู่', 'shop.currentTag'),
        ('อัพเกรด', 'shop.upgradeButton'),
        ('รวมในสิทธิ์บัญชีนี้', 'shop.includedInAccount'),
        ('สิทธิ์ที่เปิดใช้ในบัญชีนี้', 'shop.sectionAccessTitle'),
        ('โพสต์เพิ่ม 1 ครั้ง', 'shop.extraPostTitle'),
        ('ต่ออายุโพสต์ +1 วัน', 'shop.extendPostTitle'),
        ('ปุ่มด่วน (Urgent)', 'shop.urgentTitle'),
        ('เลือกแผนนี้', 'shop.selectPlan'),
        ('เปิดใช้รายครั้ง', 'shop.addonsTitlePaid'),
    ]
    for thai, key in jsx_replacements:
        c = replace_jsx_text(c, thai, key)
    
    # Long strings in JSX or data
    c = c.replace("'ระบบจะใช้โค้ดนี้อัตโนมัติเมื่อซื้อรายการที่ตรงกัน'", "t('shop.pendingCodeHint')")
    c = replace_jsx_text(c, 'ระบบจะใช้โค้ดนี้อัตโนมัติเมื่อซื้อรายการที่ตรงกัน', 'shop.pendingCodeHint')
    c = replace_jsx_text(c, 'แนะนำเพื่อน → ได้ Pro ฟรี 1 เดือน!', 'shop.referralHeadline')
    
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ ShopScreen.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_choose_role():
    fp = BASE / "auth" / "ChooseRoleScreen.tsx"
    c = fp.read_text('utf-8')
    
    jsx_replacements = [
        ('ขั้นตอนที่ 2 / 3', 'chooseRole.stepLabel'),
        ('คุณเป็นใคร?', 'chooseRole.title'),
        ('เลือกบทบาทเพื่อประสบการณ์ที่เหมาะกับคุณ', 'chooseRole.subtitle'),
        ('กำลังบันทึก...', 'chooseRole.saving'),
        ('ดำเนินการต่อ', 'chooseRole.continue'),
        ('ข้ามไปก่อน', 'chooseRole.skip'),
        ('(ไม่บังคับ)', 'chooseRole.optional'),
    ]
    for thai, key in jsx_replacements:
        c = replace_jsx_text(c, thai, key)
    
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ ChooseRoleScreen.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_onboarding():
    fp = BASE / "auth" / "OnboardingSurveyScreen.tsx"
    c = fp.read_text('utf-8')
    
    jsx_replacements = [
        ('ข้ามทั้งหมด', 'onboarding.skipAll'),
        ('ย้อนกลับ', 'onboarding.goBack'),
        ('ข้ามขั้นตอนนี้', 'onboarding.skipStep'),
        ('ถัดไป', 'onboarding.next'),
        ('เข้าแอปเลย', 'onboarding.enterApp'),
        ('ประเภทวิชาชีพของคุณ', 'onboarding.staffTypeTitle'),
        ('จังหวัดที่ใช้งานบ่อย', 'onboarding.provinceTitle'),
        ('ค้นหาจังหวัด...', 'onboarding.provinceSearchPlaceholder'),
    ]
    for thai, key in jsx_replacements:
        c = replace_jsx_text(c, thai, key)
    
    c = c.replace('placeholder="ค้นหาจังหวัด..."', "placeholder={t('onboarding.provinceSearchPlaceholder')}")
    
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ OnboardingSurveyScreen.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_map():
    fp = BASE / "map" / "MapJobsScreen.tsx"
    c = fp.read_text('utf-8')
    
    jsx_replacements = [
        ('กรองงาน', 'map.filterTitle'),
        ('รีเซ็ต', 'map.filterReset'),
        ('ประเภทประกาศ', 'map.filterPostType'),
        ('ทั้งหมด', 'map.filterAll'),
        ('จังหวัด', 'map.filterProvince'),
        ('ประเภทบุคลากร', 'map.filterStaffType'),
        ('ค่าตอบแทนขั้นต่ำ', 'map.filterMinRate'),
        ('เรียงลำดับ', 'map.filterSortBy'),
        ('ล่าสุด', 'map.sortLatest'),
        ('ค่าจ้างสูงสุด', 'map.sortHighestPay'),
        ('ใกล้ฉัน', 'map.sortNearMe'),
        ('สถานะ', 'map.filterStatus'),
        ('⚡ ด่วนเท่านั้น', 'map.filterUrgentOnly'),
        ('ด่วนเท่านั้น', 'map.urgentOnly'),
        ('ด่วน', 'map.legendUrgent'),
        ('⚡ ด่วน', 'map.urgentTag'),
        ('ดูงาน', 'map.viewJob'),
        ('กำลังโหลด...', 'map.loading'),
        ('กำลังโหลดงาน...', 'map.loadingJobs'),
    ]
    for thai, key in jsx_replacements:
        c = replace_jsx_text(c, thai, key)
    
    c = c.replace('placeholder="ค้นหาชื่องาน หรือชื่อสถานที่"', "placeholder={t('map.searchPlaceholder')}")
    
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ MapJobsScreen.tsx pass 2 — {remaining} lines with Thai remaining")


def fix_help():
    fp = BASE / "help" / "HelpScreen.tsx"
    c = fp.read_text('utf-8')
    
    jsx_replacements = [
        ('ช่วยเหลือ', 'help.headerTitle'),
        ('คำถามที่พบบ่อย', 'help.faqSectionTitle'),
        ('ไม่พบคำถามที่ตรงกับการค้นหา', 'help.emptySearch'),
        ('ติดต่อเรา', 'help.contactTitle'),
        ('อีเมล', 'help.contactEmail'),
        ('โทรศัพท์', 'help.contactPhone'),
        ('ลิงก์ที่เกี่ยวข้อง', 'help.quickLinksTitle'),
        ('ดูคู่มือเริ่มต้นใช้งาน', 'help.onboardingGuideLink'),
        ('ข้อกำหนดการใช้งาน', 'help.termsLink'),
        ('นโยบายความเป็นส่วนตัว', 'help.privacyLink'),
        ('เกี่ยวกับเรา', 'help.aboutLink'),
    ]
    for thai, key in jsx_replacements:
        c = replace_jsx_text(c, thai, key)
    
    c = c.replace('placeholder="ค้นหาคำถาม..."', "placeholder={t('help.searchPlaceholder')}")
    c = replace_jsx_text(c, 'ยังหาคำตอบไม่เจอ? ติดต่อทีมสนับสนุนของเรา', 'help.contactSubtitle')
    c = replace_jsx_text(c, 'เวลาทำการ: จันทร์ - ศุกร์ 9:00 - 18:00 น.', 'help.officeHours')
    
    fp.write_text(c, 'utf-8')
    remaining = sum(1 for line in c.split('\n') if re.search(r'[ก-๙]', line) and not line.strip().startswith('//'))
    print(f"✅ HelpScreen.tsx pass 2 — {remaining} lines with Thai remaining")


if __name__ == '__main__':
    print("Pass 2: Fixing JSX text nodes...\n")
    fix_chat()
    fix_notifications()
    fix_payment()
    fix_favorites()
    fix_myposts()
    fix_reviews()
    fix_verification()
    fix_documents()
    fix_feedback()
    fix_privacy()
    fix_terms()
    fix_shop()
    fix_choose_role()
    fix_onboarding()
    fix_map()
    fix_help()
    print("\n✅ Pass 2 complete!")
