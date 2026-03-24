#!/usr/bin/env python3
"""
Migrate ALL remaining screens from hardcoded Thai to i18n t() calls.
This uses regex-based replacements to handle Thai text reliably.
"""
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "src" / "screens"

def add_i18n_import(content: str, rel_path: str) -> str:
    """Add useI18n import if not already present."""
    if 'useI18n' in content:
        return content
    # Find the last import line
    lines = content.split('\n')
    last_import_idx = 0
    for i, line in enumerate(lines):
        if line.strip().startswith('import ') or (line.strip().startswith('}') and 'from' in line):
            last_import_idx = i
    # Count depth: chat/ChatScreens.tsx -> ../../i18n, auth/ChooseRoleScreen.tsx -> ../../i18n
    lines.insert(last_import_idx + 1, f"import {{ useI18n }} from '{rel_path}';")
    return '\n'.join(lines)

def add_t_hook(content: str, component_pattern: str) -> str:
    """Add const { t } = useI18n(); after the first line that matches a pattern inside a component function."""
    if "const { t } = useI18n();" in content or "const { t, resolvedLanguage } = useI18n();" in content:
        return content
    # Find the component function and add t hook after its opening
    # Look for 'export default function XXX' or 'function XXX'
    patterns_to_try = [
        # export default function XXX(...) {
        r'(export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{)',
        # function XXX(...) {
        r'(function\s+' + re.escape(component_pattern) + r'\s*\([^)]*\)\s*\{)',
        # const XXX = ... => {
        r'(const\s+' + re.escape(component_pattern) + r'\s*[:=].*?\{)',
    ]
    for pat in patterns_to_try:
        m = re.search(pat, content, re.DOTALL)
        if m:
            insert_pos = m.end()
            content = content[:insert_pos] + "\n  const { t } = useI18n();" + content[insert_pos:]
            return content
    return content

def replace_thai_strings(content: str, replacements: list) -> str:
    """Replace Thai strings with t() calls."""
    for thai, key, template_vars in replacements:
        if template_vars:
            # Template literal replacement: `...${var}...` -> t(key, { var })
            # We need to be more careful with these
            escaped = re.escape(thai)
            # Allow for slight whitespace differences
            pattern = escaped
            if content.find(thai) >= 0:
                if template_vars == 'TEMPLATE':
                    # Skip template literals - handle manually
                    continue
                content = content.replace(thai, f"t('{key}', {template_vars})")
            continue
        
        # Simple string replacement
        # Try exact replacement first with quotes
        for quote in ["'", '"']:
            old = f"{quote}{thai}{quote}"
            new = f"t('{key}')"
            if old in content:
                content = content.replace(old, new)
                break
    return content

def replace_locale(content: str) -> str:
    """Replace hardcoded 'th-TH' locale with locale-aware version."""
    # Replace 'th-TH' in toLocaleTimeString/toLocaleDateString
    # Need to add resolvedLanguage if not present
    if "'th-TH'" in content or '"th-TH"' in content:
        # Add resolvedLanguage to the useI18n destructuring
        content = content.replace(
            "const { t } = useI18n();",
            "const { t, resolvedLanguage } = useI18n();"
        )
        # Replace the locale strings
        content = content.replace("'th-TH'", "resolvedLanguage === 'th' ? 'th-TH' : 'en-US'")
        content = content.replace('"th-TH"', "resolvedLanguage === 'th' ? 'th-TH' : 'en-US'")
    return content


# ═══════════════════════════════════════════════════════════════
# CHAT SCREENS
# ═══════════════════════════════════════════════════════════════
def migrate_chat():
    fp = BASE / "chat" / "ChatScreens.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    # ChatScreens has multiple components. We need to add useI18n to each.
    # The main components: ChatListScreen, ChatRoomScreen, ImageViewerScreen
    # And helper components: ConversationRow, MessageBubble
    # For simplicity, we'll add a module-level translate import and use t() in components
    
    # Actually let's add useI18n to each main exported component
    # First, let's add it to ChatListScreen
    if 'function ChatListScreen' in c and 'const { t' not in c.split('function ChatListScreen')[1].split('function ')[0][:200]:
        c = c.replace(
            'function ChatListScreen({',
            'function ChatListScreen({'
        )
        # Insert after the function opening brace
        idx = c.find('function ChatListScreen(')
        if idx >= 0:
            brace = c.find('{', c.find(')', idx))
            if brace >= 0:
                # Find the next newline
                nl = c.find('\n', brace)
                c = c[:nl] + "\n  const { t, resolvedLanguage } = useI18n();" + c[nl:]
    
    # Add to ChatRoomScreen
    if 'function ChatRoomScreen' in c:
        idx = c.find('function ChatRoomScreen(')
        if idx >= 0:
            brace = c.find('{', c.find(')', idx))
            if brace >= 0:
                nl = c.find('\n', brace)
                existing = c[nl:nl+100]
                if 'useI18n' not in existing:
                    c = c[:nl] + "\n  const { t, resolvedLanguage } = useI18n();" + c[nl:]
    
    # Add to ImageViewerScreen
    if 'function ImageViewerScreen' in c:
        idx = c.find('function ImageViewerScreen(')
        if idx >= 0:
            brace = c.find('{', c.find(')', idx))
            if brace >= 0:
                nl = c.find('\n', brace)
                existing = c[nl:nl+100]
                if 'useI18n' not in existing:
                    c = c[:nl] + "\n  const { t } = useI18n();" + c[nl:]
    
    # For helper functions outside components (formatTime, QUICK_REPLIES), 
    # we need to use translate() directly or move them inside components
    # For formatTime - it's used as a helper, let's add translate import
    if "import { translate }" not in c and "translate" not in c.split("import")[0]:
        c = c.replace(
            "import { useI18n } from '../../i18n';",
            "import { useI18n, translate } from '../../i18n';"
        )
    
    # Replace simple Thai strings
    simple_replacements = [
        # ConversationRow
        ('ซ่อน', 'chat.hide', None),
        ('ลบ', 'chat.delete', None),
        ('เริ่มต้นการสนทนา', 'chat.startConversation', None),
        
        # ChatListScreen  
        ('ข้อความ', 'chat.messagesTitle', None),
        ('ยังไม่ได้เข้าสู่ระบบ', 'chat.notLoggedIn', None),
        ('เข้าสู่ระบบเพื่อดูข้อความสนทนาของคุณ', 'chat.loginToSeeMessages', None),
        ('ลบการสนทนา', 'chat.deleteConversationTitle', None),
        ('ยกเลิก', 'chat.cancel', None),
        ('ผิดพลาด', 'chat.error', None),
        ('ไม่สามารถลบการสนทนาได้', 'chat.deleteConversationError', None),
        ('ค้นหาการสนทนา...', 'chat.searchPlaceholder', None),
        ('ข้อความทั้งหมดจะถูกรวมไว้ที่นี่', 'chat.firstVisitTipTitle', None),
        ('ดูคู่มือ', 'chat.viewGuide', None),
        ('ยังไม่มีข้อความ', 'chat.noMessages', None),
        ('ไม่มีแชทที่ซ่อน', 'chat.noHiddenChats', None),
        ('นำกลับ', 'chat.unhide', None),
        
        # MessageBubble
        ('แตะเพื่อเปิด', 'chat.tapToOpen', None),
        ('ข้อผิดพลาด', 'chat.error', None),
        ('ไม่สามารถเปิดเอกสารได้', 'chat.openDocError', None),
        ('เอกสารแนบ', 'chat.attachedDocument', None),
        ('แตะเพื่อเปิดเอกสาร', 'chat.tapToOpenDocument', None),
        ('ไม่สามารถเปิดแผนที่ได้', 'chat.openMapError', None),
        ('ตำแหน่งที่ปักหมุด', 'chat.pinnedLocation', None),
        ('แตะเพื่อเปิดในแผนที่', 'chat.tapToOpenMap', None),
        
        # ChatRoomScreen
        ('แชทนี้ถูกปิดแล้ว', 'chat.chatClosed', None),
        ('ส่งข้อความไม่ได้', 'chat.sendMessageFailed', None),
        ('ส่งรูปภาพไม่สำเร็จ', 'chat.sendImageFailed', None),
        ('ส่งเอกสารไม่ได้', 'chat.sendDocFailed', None),
        ('กรุณาลองใหม่อีกครั้ง', 'chat.pleaseTryAgain', None),
        ('ส่งตำแหน่งไม่ได้', 'chat.sendLocationFailed', None),
        ('ไม่สามารถลบได้', 'chat.cannotDelete', None),
        ('บันทึกรูปไม่ได้', 'chat.cannotSaveImage', None),
        ('กรุณาอนุญาตสิทธิ์เข้าถึงรูปภาพก่อน', 'chat.grantPhotoPermission', None),
        ('ไม่พบพื้นที่จัดเก็บไฟล์', 'chat.storageNotFound', None),
        ('บันทึกสำเร็จ', 'chat.savedSuccessfully', None),
        ('ข้อความลัด', 'chat.quickReplies', None),
        ('แตะเพื่อส่งทันที', 'chat.tapToSendInstantly', None),
        ('จัดการข้อความ', 'chat.manageMessage', None),
        ('ลบข้อความนี้', 'chat.deleteMessage', None),
        ('แนบข้อมูลในแชท', 'chat.attachInChat', None),
        ('เลือกรูปจากเครื่อง', 'chat.choosePhoto', None),
        ('ส่งตำแหน่งแบบปักหมุด', 'chat.sendPinnedLocation', None),
        ('เลือกเอกสารที่อัปไว้แล้ว', 'chat.chooseUploadedDoc', None),
        ('ยังไม่มีเอกสารในหน้าของฉัน', 'chat.noSavedDocuments', None),
        ('รีเซ็ต', 'chat.reset', None),
        
        # ImageViewer
    ]
    
    c = replace_thai_strings(c, simple_replacements)
    
    # Handle specific complex replacements manually
    # 'ผู้ใช้' (user fallback) - appears many times
    c = re.sub(r"(?<=['\"])ผู้ใช้(?=['\"])", lambda m: "' + t('chat.unknownUser') + '", c, count=0)
    # Actually this is tricky - let's do targeted replacements
    # Revert the above and do it properly
    c = c.replace("' + t('chat.unknownUser') + '", 'ผู้ใช้')  # revert
    
    # Replace 'ผู้ใช้' only when it's a complete string value
    c = re.sub(r"'ผู้ใช้'(?!\s*\+)", "t('chat.unknownUser')", c)
    c = re.sub(r'"ผู้ใช้"(?!\s*\+)', "t('chat.unknownUser')", c)
    
    # Handle formatTime Thai strings - these are outside components
    # Replace 'เมื่อวาน' in formatTime
    c = c.replace("'เมื่อวาน'", "translate('th', 'chat.yesterday')  // TODO: needs resolvedLanguage")
    
    # Handle template literals with Thai
    # `${diffDays} วันที่แล้ว` 
    c = re.sub(r'`\$\{diffDays\}\s*วันที่แล้ว`', "translate('th', 'chat.daysAgo', { count: String(diffDays) })", c)
    
    # `ลบแชทกับ "${...}" ออกจากรายการของคุณ?`
    c = re.sub(
        r'`ลบแชทกับ\s*"\$\{[^}]+\}"\s*ออกจากรายการของคุณ\?`',
        lambda m: "t('chat.deleteConversationMessage', { name: recipientName })",
        c
    )
    
    # `แชทที่ซ่อน (${hidden.length})`
    c = re.sub(
        r'`แชทที่ซ่อน\s*\(\$\{hidden\.length\}\)`',
        "t('chat.hiddenChatsTitle', { count: String(hidden.length) })",
        c
    )
    
    # Quick reply replacements  
    c = c.replace("'สนใจงานนี้ครับ/ค่ะ'", "t('chat.quickReplyInterested')")
    c = c.replace("'ส่งเอกสารล่าสุดให้แล้วครับ/ค่ะ'", "t('chat.quickReplyDocsSent')")
    
    # Handle remaining specific strings
    c = c.replace("'เมื่อคุณติดต่อจากหน้าโพสต์ ระบบจะสร้างห้องแชทให้อัตโนมัติ คุณปัดเพื่อซ่อนหรือลบห้องได้ และกลับมาดูภาพรวมการใช้งานจากคู่มือได้ทุกเมื่อ'", "t('chat.firstVisitTipDescription')")
    c = c.replace("'เมื่อคุณติดต่อกับผู้โพสต์ ข้อความจะแสดงที่นี่'", "t('chat.noMessagesDescription')")
    c = c.replace("'รูปถูกบันทึกไว้ในอัลบั้ม NurseGo แล้ว'", "t('chat.imageSavedToAlbum')")
    c = c.replace("'ส่งเอกสารจากเอกสารของฉัน'", "t('chat.sendFromMyDocuments')")
    
    # Remaining complex strings
    c = c.replace("'ขอรายละเอียดเพิ่มอีกนิดได้ไหมครับ/คะ'", "t('chat.quickReplyMoreDetails')")
    c = c.replace("'สะดวกคุยต่อช่วงไหนครับ/คะ'", "t('chat.quickReplyWhenToChat')")
    
    # Handle the swipe hint that appears multiple times  
    c = c.replace("'💡 ปัดซ้าย = ลบ · ปัดขวา = ซ่อน'", "t('chat.swipeHint')")
    
    # 🗑 ข้อความนี้ถูกลบแล้ว
    c = c.replace("'🗑 ข้อความนี้ถูกลบแล้ว'", "t('chat.messageDeleted')")
    
    # พิมพ์ข้อความ หรือเลือกข้อความลัดด้านบน
    c = c.replace("'พิมพ์ข้อความ หรือเลือกข้อความลัดด้านบน'", "t('chat.inputPlaceholder')")
    
    # ใช้ 2 นิ้วซูม/ลาก หรือกดปุ่มซูมและดาวน์โหลดด้านบน
    c = c.replace("'ใช้ 2 นิ้วซูม/ลาก หรือกดปุ่มซูมและดาวน์โหลดด้านบน'", "t('chat.imageViewerHint')")
    
    # Replace 'th-TH' locale
    c = c.replace("'th-TH'", "resolvedLanguage === 'th' ? 'th-TH' : 'en-US'")
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ ChatScreens.tsx — {remaining} Thai chars remaining")


# ═══════════════════════════════════════════════════════════════
# MY POSTS SCREEN
# ═══════════════════════════════════════════════════════════════
def migrate_myposts():
    fp = BASE / "myposts" / "MyPostsScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    # Find the main component and add hook
    # It's likely: export default function MyPostsScreen
    if 'const { t }' not in c and 'const { t,' not in c:
        m = re.search(r'(export\s+default\s+function\s+MyPostsScreen[^{]*\{)', c)
        if not m:
            m = re.search(r'(function\s+MyPostsScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t } = useI18n();" + c[m.end():]
    
    replacements = [
        ('กดกลับอีกครั้งเพื่อออกจากแอพ', 'myPosts.pressBackToExit', None),
        ('เกิดข้อผิดพลาด', 'myPosts.error', None),
        ('ไม่สามารถโหลดประกาศได้', 'myPosts.loadPostsError', None),
        ('ปิดประกาศ', 'myPosts.closePost', None),
        ('ยกเลิก', 'myPosts.cancel', None),
        ('สำเร็จ', 'myPosts.success', None),
        ('ประกาศถูกปิดเรียบร้อยแล้ว', 'myPosts.postClosed', None),
        ('ไม่สามารถปิดประกาศได้', 'myPosts.closePostError', None),
        ('เปิดประกาศใหม่เรียบร้อยแล้ว', 'myPosts.postReactivated', None),
        ('ไม่สามารถเปิดประกาศได้', 'myPosts.reactivatePostError', None),
        ('ใช้สิทธิ์ป้ายด่วนครบแล้ว', 'myPosts.urgentQuotaUsed', None),
        ('บัญชีนี้ใช้สิทธิ์ป้ายด่วนครบตามรอบเดือนนี้แล้ว', 'myPosts.urgentQuotaUsedReason', None),
        ('ทำเครื่องหมายด่วนเรียบร้อยแล้ว', 'myPosts.markedUrgent', None),
        ('🎁 ใช้สิทธิ์ฟรี', 'myPosts.useFreePerk', None),
        ('ไม่สามารถอัปเดตได้', 'myPosts.updateError', None),
        ('รับทราบ', 'myPosts.acknowledged', None),
        ('ยังอยู่ในช่วงทดลองใช้ฟรี', 'myPosts.freeTrialMode', None),
        ('🗑️ ลบประกาศ', 'myPosts.deletePostTitle', None),
        ('ลบถาวร', 'myPosts.deletePermanently', None),
        ('ลบประกาศเรียบร้อยแล้ว', 'myPosts.postDeleted', None),
        ('ไม่สามารถลบประกาศได้', 'myPosts.deletePostError', None),
        ('ต่ออายุเลย', 'myPosts.extendNow', None),
        ('กรุณาเข้าสู่ระบบ', 'myPosts.pleaseLogin', None),
        ('ไม่พบข้อมูลบัญชีสำหรับใช้สิทธิ์', 'myPosts.accountNotFound', None),
        ('ใช้สิทธิ์ต่ออายุครบแล้ว', 'myPosts.extendQuotaUsed', None),
        ('บัญชีนี้ใช้สิทธิ์ต่ออายุประกาศครบตามรอบเดือนนี้แล้ว', 'myPosts.extendQuotaUsedReason', None),
        ('ต่ออายุประกาศเพิ่มอีก 1 วันแล้ว', 'myPosts.postExtended', None),
        ('ไม่สามารถต่ออายุประกาศได้', 'myPosts.extendPostError', None),
        ('เริ่มงานตามตกลง', 'myPosts.startDateAsAgreed', None),
        ('เวลางานตามตกลง', 'myPosts.workHoursAsAgreed', None),
        ('เงินเดือน', 'myPosts.salary', None),
        ('ค่าตอบแทน', 'myPosts.compensation', None),
        ('กำลังเปิด', 'myPosts.statusActive', None),
        ('ด่วน', 'myPosts.statusUrgent', None),
        ('ปิดแล้ว', 'myPosts.statusClosed', None),
        ('หมดอายุ', 'myPosts.statusExpired', None),
        ('ถูกลบ', 'myPosts.statusDeleted', None),
        ('ไม่ระบุ', 'myPosts.notSpecified', None),
        ('หมดอายุแล้ว', 'myPosts.expired', None),
        ('แตะเพื่อจัดการ', 'myPosts.tapToManage', None),
        ('ทั้งหมด', 'myPosts.filterAll', None),
        ('ประกาศของฉัน', 'myPosts.title', None),
        ('เข้าสู่ระบบเพื่อดูประกาศของคุณ', 'myPosts.loginToViewPosts', None),
        ('เข้าสู่ระบบ', 'myPosts.login', None),
        ('ยังไม่มีประกาศ', 'myPosts.noPosts', None),
        ('สร้างประกาศ', 'myPosts.createPost', None),
        ('ไม่มีประกาศในหมวดนี้', 'myPosts.noPostsInFilter', None),
        ('ดูผู้สมัคร', 'myPosts.viewApplicants', None),
        ('แก้ไข', 'myPosts.edit', None),
        ('ต่ออายุประกาศ', 'myPosts.extendPost', None),
        ('ทำเครื่องหมายด่วน', 'myPosts.markUrgent', None),
        ('เปิดใหม่', 'myPosts.reactivate', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    # Handle complex strings with interpolation
    c = c.replace("'คุณยังไม่ได้สร้างประกาศใดๆ ลองสร้างประกาศใหม่ดูสิ!'", "t('myPosts.noPostsDescription')")
    c = c.replace("'🎁 สิทธิ์พิเศษ Premium'", "t('myPosts.premiumPerkTitle')")
    c = c.replace("'⚡ ทำเครื่องหมายด่วน'", "t('myPosts.markUrgentTitle')")
    c = c.replace("'⏰ ต่ออายุประกาศ'", "t('myPosts.extendPostTitle')")
    
    # Template strings with job title
    c = re.sub(
        r'`คุณต้องการปิดประกาศนี้หรือไม่\?\n.*?`',
        "t('myPosts.closePostMessage')",
        c, flags=re.DOTALL
    )
    c = re.sub(
        r'`คุณต้องการลบประกาศนี้ถาวรหรือไม่\?\n.*?`',
        "t('myPosts.deletePostMessage')",
        c, flags=re.DOTALL
    )
    
    # Rate unit strings
    c = re.sub(r"'บาท'", "t('myPosts.baht')", c)
    c = re.sub(r"'ชม\.'", "t('myPosts.perHour')", c)
    # Be careful with วัน - it can appear in 'เหลือ X วัน' too  
    
    # Handle complex alert messages
    c = c.replace("'บัญชีนี้ใช้สิทธิ์ป้ายด่วนของรอบปัจจุบันครบแล้ว แต่ยังโพสต์และจัดการประกาศแบบปกติได้ตามปกติ'", "t('myPosts.urgentQuotaUsedDetail')")
    c = c.replace("'ตอนนี้ระบบยังใช้งานฟรีอยู่ จึงยังไม่มีขั้นตอนชำระเงินจริงสำหรับป้ายด่วน'", "t('myPosts.freeTrialUrgentNote')")
    c = c.replace("'ตอนนี้ระบบยังใช้งานฟรีอยู่ จึงยังไม่มีขั้นตอนชำระเงินจริงสำหรับการต่ออายุประกาศ'", "t('myPosts.freeTrialExtendNote')")
    
    # โพสต์ prefix
    c = c.replace("'โพสต์ '", "t('myPosts.posted')")
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ MyPostsScreen.tsx — {remaining} Thai chars remaining")


# ═══════════════════════════════════════════════════════════════
# NOTIFICATIONS SCREEN
# ═══════════════════════════════════════════════════════════════
def migrate_notifications():
    fp = BASE / "notifications" / "NotificationsScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    if 'const { t' not in c:
        m = re.search(r'(export\s+default\s+function\s+NotificationsScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t, resolvedLanguage } = useI18n();" + c[m.end():]
    
    replacements = [
        ('วันนี้', 'notifications.today', None),
        ('เมื่อวาน', 'notifications.yesterday', None),
        ('สัปดาห์นี้', 'notifications.thisWeek', None),
        ('เกิดข้อผิดพลาด', 'notifications.error', None),
        ('ไม่สามารถอ่านทั้งหมดได้', 'notifications.markAllReadError', None),
        ('ลบการแจ้งเตือน', 'notifications.deleteNotificationTitle', None),
        ('ต้องการลบการแจ้งเตือนนี้หรือไม่?', 'notifications.deleteNotificationMessage', None),
        ('ยกเลิก', 'notifications.cancel', None),
        ('ลบ', 'notifications.delete', None),
        ('ไม่สามารถลบได้', 'notifications.deleteError', None),
        ('ผู้ใช้', 'notifications.unknownUser', None),
        ('การแจ้งเตือน', 'notifications.title', None),
        ('เข้าสู่ระบบเพื่อดูการแจ้งเตือน', 'notifications.loginToView', None),
        ('รับการแจ้งเตือนงานใหม่และข้อความ', 'notifications.loginSubtitle', None),
        ('เข้าสู่ระบบ', 'notifications.login', None),
        ('กำลังโหลด...', 'notifications.loading', None),
        ('อ่านทั้งหมด', 'notifications.markAllRead', None),
        ('ไม่มีการแจ้งเตือน', 'notifications.empty', None),
        ('เมื่อมีกิจกรรมใหม่ จะแสดงที่นี่', 'notifications.emptySubtitle', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    # Replace 'th-TH' locale
    c = c.replace("'th-TH'", "resolvedLanguage === 'th' ? 'th-TH' : 'en-US'")
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ NotificationsScreen.tsx — {remaining} Thai chars remaining")


# ═══════════════════════════════════════════════════════════════
# PAYMENT SCREEN
# ═══════════════════════════════════════════════════════════════
def migrate_payment():
    fp = BASE / "payment" / "PaymentScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    if 'const { t' not in c:
        m = re.search(r'(export\s+default\s+function\s+PaymentScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t } = useI18n();" + c[m.end():]
    
    replacements = [
        ('ถึงช่วงทบทวนการเปิดชำระเงินแล้ว', 'payment.transitionReviewTitle', None),
        ('ช่วงใช้งานแบบโควตารายเดือน', 'payment.monthlyQuotaTitle', None),
        ('ระบบชำระเงินจริงเริ่มทำงานแล้ว', 'payment.livePaymentTitle', None),
        ('สถานะตอนนี้', 'payment.currentStatus', None),
        ('จำนวนที่เปิดใช้งานอยู่', 'payment.activeAmount', None),
        ('ยังไม่คิดเงิน', 'payment.noCharges', None),
        ('กลับไปใช้งานต่อ', 'payment.continueUsing', None),
        ('ปิดหน้านี้', 'payment.closePage', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    # Long description strings
    c = c.replace("'ตอนนี้ระบบถึงเกณฑ์ทบทวนแล้ว แต่ยังคงใช้ฟรีต่อจนกว่าผู้ดูแลจะอนุมัติเปิดชำระเงินจริง'", "t('payment.transitionReviewDesc')")
    c = c.replace("'ตอนนี้แอปยังไม่เรียกเก็บเงินจริงในแอป โดยสิทธิ์ต่าง ๆ จะถูกควบคุมผ่านโควตารายเดือนของบัญชี'", "t('payment.monthlyQuotaDesc')")
    c = c.replace("'สถานะนี้ใช้เมื่อผู้ดูแลอนุมัติเปิดชำระเงินจริงและช่องทางชำระเงินพร้อมใช้งานแล้ว'", "t('payment.livePaymentDesc')")
    c = c.replace("'ช่องทางชำระเงินจริงพร้อมแล้ว แต่ระบบยังรอผู้ดูแลอนุมัติการเปิดใช้งาน'", "t('payment.gatewayReadyAwaitingApproval')")
    c = c.replace("'ระบบยังรอช่องทางชำระเงินจริงพร้อมก่อนเข้าสู่ขั้นพิจารณาเปิดใช้งานจริง'", "t('payment.awaitingGateway')")
    c = c.replace("'สิทธิ์ฟีเจอร์หลักและบริการเสริมที่เปิดให้ จะถูกดูแลผ่านระบบโควตารายเดือนของบัญชีโดยตรง'", "t('payment.quotaManagedNote')")
    c = c.replace("'ไม่มีการจำลองชำระเงินและไม่มีการตัดเงินในขั้นตอนนี้'", "t('payment.noChargesNote')")
    c = c.replace("'ระบบชำระเงินพร้อมและถูกเปิดใช้งานแล้วในสถานะนี้'", "t('payment.livePaymentReady')")
    c = c.replace("'ระบบชำระเงินยังไม่พร้อม จึงยังไม่สามารถเปิดเก็บเงินจริงได้'", "t('payment.paymentNotReady')")
    c = c.replace("'เมื่อเปิดระบบชำระเงิน เราจะแจ้งรายละเอียดให้ทราบก่อนใช้งานจริง'", "t('payment.willNotifyBeforeLaunch')")
    c = re.sub(r"'บาท'", "t('payment.baht')", c)
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ PaymentScreen.tsx — {remaining} Thai chars remaining")


# ═══════════════════════════════════════════════════════════════
# FAVORITES SCREEN
# ═══════════════════════════════════════════════════════════════
def migrate_favorites():
    fp = BASE / "favorites" / "FavoritesScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    # FavoritesScreen might have a named function or default export
    if 'const { t' not in c:
        m = re.search(r'(export\s+default\s+function\s+FavoritesScreen[^{]*\{)', c)
        if not m:
            m = re.search(r'(function\s+FavoritesScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t, resolvedLanguage } = useI18n();" + c[m.end():]
    
    replacements = [
        ('ไม่พบผลลัพธ์', 'favorites.noResults', None),
        ('ยังไม่มีงานที่บันทึก', 'favorites.noSavedJobs', None),
        ('ลองเปลี่ยนคำค้นหาใหม่', 'favorites.tryDifferentSearch', None),
        ('ตามตกลง', 'favorites.negotiable', None),
        ('ประกาศหมดอายุแล้ว', 'favorites.postExpired', None),
        ('⚡ ด่วน', 'favorites.urgent', None),
        ('ไม่ระบุสถานพยาบาล', 'favorites.noFacility', None),
        ('ลบออกจากรายการโปรด', 'favorites.removeTitle', None),
        ('ยกเลิก', 'favorites.cancel', None),
        ('ลบออก', 'favorites.remove', None),
        ('❤️ รายการโปรด', 'favorites.title', None),
        ('กำลังโหลด...', 'favorites.loading', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    # Rate suffixes
    c = c.replace("'/ชม.'", "t('favorites.perHour')")
    c = c.replace("'/วัน'", "t('favorites.perDay')")
    c = c.replace("'/เดือน'", "t('favorites.perMonth')")
    c = c.replace("'/เวร'", "t('favorites.perShift')")
    
    # Search placeholder
    c = c.replace("'ค้นหาชื่องาน, โรงพยาบาล, สถานที่...'", "t('favorites.searchPlaceholder')")
    
    # Tap to save hint
    c = c.replace("'กดไอคอน ❤️ เพื่อบันทึกงานที่สนใจ'", "t('favorites.tapToSave')")
    
    # Replace 'th-TH' locale
    c = c.replace("'th-TH'", "resolvedLanguage === 'th' ? 'th-TH' : 'en-US'")
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ FavoritesScreen.tsx — {remaining} Thai chars remaining")


# ═══════════════════════════════════════════════════════════════
# MAP JOBS SCREEN
# ═══════════════════════════════════════════════════════════════
def migrate_map():
    fp = BASE / "map" / "MapJobsScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    if 'const { t' not in c:
        m = re.search(r'(export\s+default\s+function\s+MapJobsScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t } = useI18n();" + c[m.end():]
    
    replacements = [
        ('ไม่พบตำแหน่ง', 'map.locationNotFoundTitle', None),
        ('กรุณาเปิดใช้ GPS แล้วลองใหม่', 'map.locationNotFoundMessage', None),
        ('ดูอัตรา', 'map.seeRate', None),
        ('กำลังโหลด...', 'map.loading', None),
        ('กำลังโหลดงาน...', 'map.loadingJobs', None),
        ('งาน', 'map.jobFallbackTitle', None),
        ('⚡ ด่วน', 'map.urgentTag', None),
        ('ดูงาน', 'map.viewJob', None),
        ('กรองงาน', 'map.filterTitle', None),
        ('รีเซ็ต', 'map.filterReset', None),
        ('ประเภทประกาศ', 'map.filterPostType', None),
        ('ทั้งหมด', 'map.filterAll', None),
        ('จังหวัด', 'map.filterProvince', None),
        ('ประเภทบุคลากร', 'map.filterStaffType', None),
        ('ค่าตอบแทนขั้นต่ำ', 'map.filterMinRate', None),
        ('เรียงลำดับ', 'map.filterSortBy', None),
        ('ล่าสุด', 'map.sortLatest', None),
        ('ค่าจ้างสูงสุด', 'map.sortHighestPay', None),
        ('ใกล้ฉัน', 'map.sortNearMe', None),
        ('สถานะ', 'map.filterStatus', None),
        ('⚡ ด่วนเท่านั้น', 'map.filterUrgentOnly', None),
        ('ด่วนเท่านั้น', 'map.urgentOnly', None),
        ('ด่วน', 'map.legendUrgent', None),
        ('หาคนแทนเวร', 'map.postTypeShift', None),
        ('รับสมัครงาน', 'map.postTypeJob', None),
        ('ดูแลผู้ป่วย', 'map.postTypeHomecare', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    # Rate units
    c = c.replace("'/เวร'", "t('map.rateUnitShift')")
    c = c.replace("'/ชม'", "t('map.rateUnitHour')")
    c = c.replace("'/วัน'", "t('map.rateUnitDay')")
    c = c.replace("'/เดือน'", "t('map.rateUnitMonth')")
    
    # Search and sort
    c = c.replace("'ค้นหาชื่องาน หรือชื่อสถานที่'", "t('map.searchPlaceholder')")
    c = c.replace("'เรียง: ค่าจ้างสูงสุด'", "t('map.sortRateDesc')")
    c = c.replace("'เรียง: ใกล้ฉัน'", "t('map.sortNearby')")
    
    # Province names in STAFF_TYPE_LABELS and PROVINCE_PRESETS are data, not UI strings
    # We'll skip those for now - they're lookup data
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ MapJobsScreen.tsx — {remaining} Thai chars remaining (includes province/staff data)")


# ═══════════════════════════════════════════════════════════════
# HELP, REVIEWS, VERIFICATION, DOCUMENTS, FEEDBACK SCREENS
# ═══════════════════════════════════════════════════════════════
def migrate_help():
    fp = BASE / "help" / "HelpScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    if 'const { t' not in c:
        m = re.search(r'(export\s+default\s+function\s+HelpScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t } = useI18n();" + c[m.end():]
    
    replacements = [
        ('ช่วยเหลือ', 'help.headerTitle', None),
        ('ค้นหาคำถาม...', 'help.searchPlaceholder', None),
        ('คำถามที่พบบ่อย', 'help.faqSectionTitle', None),
        ('ไม่พบคำถามที่ตรงกับการค้นหา', 'help.emptySearch', None),
        ('ติดต่อเรา', 'help.contactTitle', None),
        ('อีเมล', 'help.contactEmail', None),
        ('โทรศัพท์', 'help.contactPhone', None),
        ('ดูคู่มือเริ่มต้นใช้งาน', 'help.onboardingGuideLink', None),
        ('ข้อกำหนดการใช้งาน', 'help.termsLink', None),
        ('นโยบายความเป็นส่วนตัว', 'help.privacyLink', None),
        ('เกี่ยวกับเรา', 'help.aboutLink', None),
        ('ทั่วไป', 'help.catGeneral', None),
        ('บัญชี', 'help.catAccount', None),
        ('การสมัคร', 'help.catApplications', None),
        ('โรงพยาบาล', 'help.catHospital', None),
        ('การชำระเงิน', 'help.catPayment', None),
        ('ขอความช่วยเหลือ', 'help.emailSubject', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    # FAQ strings - these are typically in an array/object
    # Q&A pairs
    c = c.replace("'NurseGo คืออะไร?'", "t('help.faq1Q')")
    c = c.replace("'แอปนี้ใช้งานฟรีหรือไม่?'", "t('help.faq2Q')")
    c = c.replace("'รองรับการใช้งานบนอุปกรณ์อะไรบ้าง?'", "t('help.faq3Q')")
    c = c.replace("'จะสมัครสมาชิกได้อย่างไร?'", "t('help.faq4Q')")
    c = c.replace("'ลืมรหัสผ่านทำอย่างไร?'", "t('help.faq5Q')")
    c = c.replace("'จะแก้ไขข้อมูลโปรไฟล์ได้อย่างไร?'", "t('help.faq6Q')")
    c = c.replace("'จะลบบัญชีได้อย่างไร?'", "t('help.faq7Q')")
    c = c.replace("'จะค้นหางานที่ตรงใจได้อย่างไร?'", "t('help.faq8Q')")
    c = c.replace("'บันทึกงานที่สนใจได้อย่างไร?'", "t('help.faq9Q')")
    c = c.replace("'งานที่แสดงมาจากไหน?'", "t('help.faq10Q')")
    c = c.replace("'จะสมัครงานได้อย่างไร?'", "t('help.faq11Q')")
    c = c.replace("'จะดูสถานะการสมัครได้ที่ไหน?'", "t('help.faq12Q')")
    c = c.replace("'สามารถยกเลิกการสมัครได้ไหม?'", "t('help.faq13Q')")
    c = c.replace("'ต้องอัปโหลดเอกสารอะไรบ้าง?'", "t('help.faq14Q')")
    c = c.replace("'โรงพยาบาลจะลงประกาศงานได้อย่างไร?'", "t('help.faq15Q')")
    c = c.replace("'จะดูผู้สมัครได้ที่ไหน?'", "t('help.faq16Q')")
    c = c.replace("'รีวิวของโรงพยาบาลมีผลอย่างไร?'", "t('help.faq17Q')")
    c = c.replace("'โรงพยาบาลต้องจ่ายค่าธรรมเนียมอะไรบ้าง?'", "t('help.faq18Q')")
    c = c.replace("'ชำระเงินได้ทางช่องทางไหนบ้าง?'", "t('help.faq19Q')")
    c = c.replace("'ขอใบเสร็จได้อย่างไร?'", "t('help.faq20Q')")
    
    # Long answer replacements
    c = c.replace("'ยังหาคำตอบไม่เจอ? ติดต่อทีมสนับสนุนของเรา'", "t('help.contactSubtitle')")
    c = c.replace("'เวลาทำการ: จันทร์ - ศุกร์ 9:00 - 18:00 น.'", "t('help.officeHours')")
    c = c.replace("'ลิงก์ที่เกี่ยวข้อง'", "t('help.quickLinksTitle')")
    
    # 'ทั้งหมด' for all categories
    c = c.replace("'ทั้งหมด'", "t('help.allCategories')")
    # 'งาน' category
    c = c.replace("'งาน'", "t('help.catJobs')")
    
    # All FAQ answers (long strings) - these need exact matches
    # They're likely in a data array, let's handle them with broader regex
    # For now, let's try direct replacement of the most unique ones
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ HelpScreen.tsx — {remaining} Thai chars remaining (FAQ answers in data array)")


def migrate_reviews():
    fp = BASE / "reviews" / "ReviewsScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    if 'const { t' not in c:
        m = re.search(r'(export\s+default\s+function\s+ReviewsScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t } = useI18n();" + c[m.end():]
    
    replacements = [
        ('ผู้ใช้งาน', 'reviews.userFallback', None),
        ('สถานที่ทำงาน', 'reviews.workplaceFallback', None),
        ('แจ้งเตือน', 'reviews.alertNotice', None),
        ('คุณได้รีวิวงานนี้แล้ว', 'reviews.alreadyReviewedJob', None),
        ('คุณได้รีวิวสถานที่นี้แล้ว', 'reviews.alreadyReviewedPlace', None),
        ('ยังรีวิวไม่ได้', 'reviews.cannotReviewTitle', None),
        ('กรุณากรอกข้อมูล', 'reviews.validationTitle', None),
        ('กรุณาใส่หัวข้อรีวิว', 'reviews.validationTitleRequired', None),
        ('กรุณาใส่เนื้อหารีวิว', 'reviews.validationContentRequired', None),
        ('สำเร็จ', 'reviews.successTitle', None),
        ('ขอบคุณสำหรับรีวิวของคุณ', 'reviews.successMessage', None),
        ('เกิดข้อผิดพลาด', 'reviews.errorTitle', None),
        ('ไม่สามารถส่งรีวิวได้', 'reviews.errorSubmitFallback', None),
        ('กรุณาเข้าสู่ระบบ', 'reviews.loginTitle', None),
        ('กดแล้ว', 'reviews.alreadyHelpfulTitle', None),
        ('กดไม่ได้', 'reviews.helpfulErrorTitle', None),
        ('ไม่สามารถบันทึกคะแนนประโยชน์ได้', 'reviews.helpfulErrorFallback', None),
        ('ไม่พบข้อมูลผู้ใช้งาน', 'reviews.noUserData', None),
        ('ไม่พบข้อมูลสถานที่ทำงาน', 'reviews.noWorkplaceData', None),
        ('กลับ', 'reviews.goBack', None),
        ('กำลังโหลดรีวิว...', 'reviews.loading', None),
        ('ยืนยันแล้ว', 'reviews.verified', None),
        ('ไม่แนะนำ', 'reviews.notRecommend', None),
        ('แนะนำ', 'reviews.recommend', None),
        ('มีประโยชน์แล้ว', 'reviews.helpfulDone', None),
        ('มีประโยชน์', 'reviews.helpful', None),
        ('รายงานรีวิว', 'reviews.report', None),
        ('เขียนรีวิว', 'reviews.writeReview', None),
        ('ล่าสุด', 'reviews.sortLatest', None),
        ('คะแนนมากสุด', 'reviews.sortHighest', None),
        ('คะแนนน้อยสุด', 'reviews.sortLowest', None),
        ('มีประโยชน์มากสุด', 'reviews.sortMostHelpful', None),
        ('มีประโยชน์น้อยสุด', 'reviews.sortLeastHelpful', None),
        ('ยังไม่มีรีวิว', 'reviews.emptyTitle', None),
        ('กำลังส่ง...', 'reviews.submitting', None),
        ('ส่ง', 'reviews.submit', None),
        ('ให้คะแนน', 'reviews.rateLabel', None),
        ('หัวข้อ *', 'reviews.titleLabel', None),
        ('รายละเอียด *', 'reviews.detailsLabel', None),
        ('ข้อดี', 'reviews.prosLabel', None),
        ('ข้อเสีย', 'reviews.consLabel', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    # Longer strings
    c = c.replace("'จะรีวิวได้เมื่อมีงานที่ยืนยันแล้วและจบงานเรียบร้อย'", "t('reviews.cannotReviewMessage')")
    c = c.replace("'เข้าสู่ระบบก่อนกดว่ารีวิวนี้มีประโยชน์'", "t('reviews.loginHelpfulMessage')")
    c = c.replace("'คุณกดว่ารีวิวนี้มีประโยชน์ไปแล้ว'", "t('reviews.alreadyHelpfulMessage')")
    c = c.replace("'รีวิวได้เมื่อคุณมีงานที่ยืนยันแล้วและจบงานกับโปรไฟล์นี้'", "t('reviews.reviewHint')")
    c = c.replace("'เป็นคนแรกที่รีวิวผู้ใช้งานนี้'", "t('reviews.emptySubtitleUser')")
    c = c.replace("'เป็นคนแรกที่รีวิวสถานที่นี้'", "t('reviews.emptySubtitlePlace')")
    c = c.replace("'คำตอบจากผู้ใช้งาน'", "t('reviews.responseFromUser')")
    c = c.replace("'คำตอบจากสถานที่ทำงาน'", "t('reviews.responseFromWorkplace')")
    c = c.replace("'เช่น ประสบการณ์ทำงานที่ดี'", "t('reviews.titlePlaceholder')")
    c = c.replace("'บอกเล่าประสบการณ์ของคุณ...'", "t('reviews.detailsPlaceholder')")
    c = c.replace("'สิ่งที่ชอบ...'", "t('reviews.prosPlaceholder')")
    c = c.replace("'สิ่งที่ควรปรับปรุง...'", "t('reviews.consPlaceholder')")
    c = c.replace("'คุณจะแนะนำให้ผู้อื่นหรือไม่?'", "t('reviews.recommendQuestion')")
    c = c.replace("'รีวิว'", "t('reviews.headerSubtitle')")
    c = c.replace("'ผู้ใช้'", "t('reviews.userFallback')")
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ ReviewsScreen.tsx — {remaining} Thai chars remaining")


def migrate_verification():
    fp = BASE / "verification" / "VerificationScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    if 'const { t' not in c:
        m = re.search(r'(export\s+default\s+function\s+VerificationScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t } = useI18n();" + c[m.end():]
    
    replacements = [
        ('ข้อผิดพลาด', 'verification.error', None),
        ('กรุณากรอกชื่อจริง', 'verification.firstNameRequired', None),
        ('กรุณากรอกนามสกุล', 'verification.lastNameRequired', None),
        ('กรุณากรอกเลขที่ใบอนุญาต', 'verification.licenseNumberRequired', None),
        ('รูปแบบเลขใบอนุญาตไม่ถูกต้อง', 'verification.licenseInvalidFormat', None),
        ('กรุณาอัปโหลดใบประกอบวิชาชีพ', 'verification.licenseDocRequired', None),
        ('กรุณาอัปโหลดบัตรพนักงาน', 'verification.employeeCardRequired', None),
        ('กรุณาอัปโหลดบัตรประชาชน', 'verification.idCardRequired', None),
        ('ข้อมูลไม่ครบ', 'verification.incompleteTitle', None),
        ('ไม่ระบุชื่อ', 'verification.noNameFallback', None),
        ('ส่งคำขอสำเร็จ', 'verification.submitSuccessTitle', None),
        ('ไม่สามารถส่งคำขอยืนยันตัวตนได้', 'verification.submitErrorFallback', None),
        ('แตะเพื่ออัปโหลด', 'verification.tapToUpload', None),
        ('กำลังโหลด...', 'verification.loading', None),
        ('ประเภทการยืนยัน', 'verification.verificationType', None),
        ('ประเภทใบอนุญาต', 'verification.licenseType', None),
        ('เลขที่เอกสาร', 'verification.documentNumber', None),
        ('รอการตรวจสอบ', 'verification.pendingTitle', None),
        ('ชื่อผู้ยื่น', 'verification.applicantName', None),
        ('ข้อมูลผู้ยื่นคำขอ', 'verification.applicantInfoTitle', None),
        ('ชื่อจริง', 'verification.firstName', None),
        ('กรอกชื่อจริง', 'verification.firstNamePlaceholder', None),
        ('นามสกุล', 'verification.lastName', None),
        ('กรอกนามสกุล', 'verification.lastNamePlaceholder', None),
        ('ข้อมูลใบอนุญาต', 'verification.licenseInfoTitle', None),
        ('เลขที่ใบอนุญาต', 'verification.licenseNumber', None),
        ('เลือกประเภท', 'verification.selectType', None),
        ('วันหมดอายุใบอนุญาต', 'verification.licenseExpiry', None),
        ('เอกสารประกอบ', 'verification.documentsTitle', None),
        ('ใบประกอบวิชาชีพ', 'verification.licenseDocLabel', None),
        ('บัตรประชาชน', 'verification.idCardLabel', None),
        ('กำลังส่ง...', 'verification.submitting', None),
        ('ส่งคำขอยืนยัน', 'verification.submitButton', None),
        ('เลือกประเภทใบอนุญาต', 'verification.selectLicenseTypeTitle', None),
        ('เลือกรูปเอกสาร', 'verification.selectImageTitle', None),
        ('เลือกจากคลังรูปภาพ', 'verification.pickFromGallery', None),
        ('ถ่ายรูป', 'verification.takePhoto', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    # Long strings
    c = c.replace("'กรุณาอัปโหลดเอกสารเซ็นกำกับว่าใช้กับ NurseGo'", "t('verification.declarationRequired')")
    c = c.replace("'คำขอยืนยันตัวตนของคุณถูกส่งแล้ว ทีมงานจะตรวจสอบภายใน 1-3 วันทำการ'", "t('verification.submitSuccessMessage')")
    c = c.replace("'คำขอยืนยันตัวตนของคุณอยู่ระหว่างการตรวจสอบ ทีมงานจะตรวจสอบภายใน 1-3 วันทำการ'", "t('verification.pendingMessage')")
    c = c.replace("'Tag จาก role / survey'", "t('verification.tagsFromSurvey')")
    c = c.replace("'เช่น ว.12345'", "t('verification.licenseNumberPlaceholder')")
    c = c.replace("'อัปโหลดรูปใบประกอบวิชาชีพที่ใช้ตรวจสอบ'", "t('verification.licenseDocDesc')")
    c = c.replace("'บัตรพนักงาน / เอกสารสังกัด'", "t('verification.employeeCardLabel')")
    c = c.replace("'ใช้ยืนยันว่าคุณเป็นผู้แทนของหน่วยงานนี้จริง'", "t('verification.employeeCardDesc')")
    c = c.replace("'อัปโหลดเฉพาะข้อมูลที่ใช้ยืนยันตัวตนได้ชัดเจน'", "t('verification.idCardDesc')")
    c = c.replace("'เอกสารเซ็นกำกับว่าใช้กับ NurseGo'", "t('verification.declarationLabel')")
    c = c.replace("'เอกสารทั้งหมดใช้เพื่อการตรวจสอบตัวตนและความน่าเชื่อถือของผู้โพสต์งานเท่านั้น'", "t('verification.privacyNote')")
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ VerificationScreen.tsx — {remaining} Thai chars remaining")


def migrate_documents():
    fp = BASE / "documents" / "DocumentsScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    if 'const { t' not in c:
        m = re.search(r'(export\s+default\s+function\s+DocumentsScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t } = useI18n();" + c[m.end():]
    
    replacements = [
        ('เกิดข้อผิดพลาด', 'documents.error', None),
        ('ไม่สามารถเลือกเอกสารได้', 'documents.errorSelectDoc', None),
        ('ต้องการสิทธิ์', 'documents.permissionTitle', None),
        ('กรุณาอนุญาตการเข้าถึงรูปภาพ', 'documents.permissionMessage', None),
        ('ไม่สามารถเลือกรูปภาพได้', 'documents.errorSelectImage', None),
        ('ไฟล์ใหญ่เกินไป', 'documents.fileTooLargeTitle', None),
        ('ขนาดไฟล์สูงสุด 10MB', 'documents.fileTooLargeMessage', None),
        ('สำเร็จ', 'documents.uploadSuccessTitle', None),
        ('อัพโหลดเอกสารเรียบร้อยแล้ว', 'documents.uploadSuccessMessage', None),
        ('ยกเลิกคำขอ', 'documents.cancelRequest', None),
        ('ลบเอกสาร', 'documents.deleteDocument', None),
        ('ยกเลิก', 'documents.cancel', None),
        ('ยืนยัน', 'documents.confirm', None),
        ('ลบ', 'documents.delete', None),
        ('ไม่สามารถลบได้', 'documents.deleteError', None),
        ('อนุมัติแล้ว', 'documents.statusApproved', None),
        ('ไม่ผ่านการตรวจสอบ', 'documents.statusRejected', None),
        ('รอการตรวจสอบ', 'documents.statusPending', None),
        ('กำลังโหลด...', 'documents.loading', None),
        ('เอกสารของฉัน', 'documents.headerTitle', None),
        ('กำลังอัพโหลด...', 'documents.uploading', None),
        ('เพิ่มเอกสาร', 'documents.addDocument', None),
        ('ยังไม่มีเอกสาร', 'documents.emptyTitle', None),
        ('เลือกประเภทเอกสาร', 'documents.selectTypeTitle', None),
        ('ดูเอกสาร', 'documents.viewDocumentFallback', None),
        ('สถานะ:', 'documents.statusLabel', None),
        ('เหตุผล:', 'documents.rejectionInline', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    c = c.replace("'ไม่สามารถอัพโหลดได้ กรุณาลองใหม่'", "t('documents.uploadErrorMessage')")
    c = c.replace("'เข้าสู่ระบบเพื่อจัดการเอกสาร'", "t('documents.loginTitle')")
    c = c.replace("'เข้าสู่ระบบ'", "t('documents.loginButton')")
    c = c.replace("'เพิ่มเอกสารเพื่อเพิ่มโอกาสในการสมัครงาน'", "t('documents.emptySubtitle')")
    c = c.replace("'เหตุผลที่ไม่ผ่าน:'", "t('documents.rejectionReasonLabel')")
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ DocumentsScreen.tsx — {remaining} Thai chars remaining")


def migrate_feedback():
    fp = BASE / "feedback" / "FeedbackScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    if 'const { t' not in c:
        m = re.search(r'(export\s+default\s+function\s+FeedbackScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t } = useI18n();" + c[m.end():]
    
    replacements = [
        ('กรุณาเข้าสู่ระบบ', 'feedback.loginTitle', None),
        ('กรุณากรอกข้อมูล', 'feedback.validationTitle', None),
        ('กรุณากรอกหัวข้อ', 'feedback.titleRequired', None),
        ('กรุณากรอกข้อความ', 'feedback.messageRequired', None),
        ('ผู้ใช้', 'feedback.userFallback', None),
        ('ข้อผิดพลาด', 'feedback.errorTitle', None),
        ('แย่มาก 😢', 'feedback.rating1', None),
        ('ไม่ดี 😕', 'feedback.rating2', None),
        ('ปานกลาง 😐', 'feedback.rating3', None),
        ('ดี 😊', 'feedback.rating4', None),
        ('ยอดเยี่ยม 🤩', 'feedback.rating5', None),
        ('Feedback & รีวิว', 'feedback.headerTitle', None),
        ('ยังไม่มี feedback', 'feedback.emptyHistory', None),
        ('ให้คะแนนแอพของเรา', 'feedback.rateTitle', None),
        ('ประเภท Feedback', 'feedback.typeTitle', None),
        ('ข้อความของคุณ', 'feedback.messageTitle', None),
        ('หัวข้อ', 'feedback.titlePlaceholder', None),
        ('📤 ส่ง Feedback', 'feedback.submitButton', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    c = c.replace("'คุณต้องเข้าสู่ระบบก่อนส่ง feedback'", "t('feedback.loginMessage')")
    c = c.replace("'ส่ง Feedback สำเร็จ'", "t('feedback.successTitle')")
    c = c.replace("'ขอบคุณสำหรับความคิดเห็นของคุณ เราจะนำไปปรับปรุงแอพให้ดียิ่งขึ้น'", "t('feedback.successMessage')")
    c = c.replace("'ประวัติ Feedback ของคุณ'", "t('feedback.historyTitle')")
    c = c.replace("'📢 ตอบกลับจากทีมงาน:'", "t('feedback.adminResponseLabel')")
    c = c.replace("'รายละเอียด... (บอกเราว่าคุณชอบอะไร หรืออยากให้ปรับปรุงอะไร)'", "t('feedback.messagePlaceholder')")
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ FeedbackScreen.tsx — {remaining} Thai chars remaining")


# ═══════════════════════════════════════════════════════════════
# LEGAL SCREENS
# ═══════════════════════════════════════════════════════════════
def migrate_privacy():
    fp = BASE / "legal" / "PrivacyScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    if 'const { t' not in c:
        m = re.search(r'(export\s+default\s+function\s+PrivacyScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t } = useI18n();" + c[m.end():]
    
    replacements = [
        ('นโยบายความเป็นส่วนตัว', 'privacy.headerTitle', None),
        ('อัปเดตล่าสุด:', 'privacy.lastUpdated', None),
        ('สรุปสั้นๆ', 'privacy.summaryTitle', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    c = c.replace("'คำถามเกี่ยวกับข้อมูลส่วนบุคคล'", "t('privacy.emailSubject')")
    c = c.replace("'ความเป็นส่วนตัวของคุณสำคัญสำหรับเรา'", "t('privacy.introTitle')")
    c = c.replace("'เราเก็บข้อมูลเท่าที่จำเป็นต่อการให้บริการ'", "t('privacy.summary1')")
    c = c.replace("'ข้อมูลของคุณได้รับการเข้ารหัสและปกป้อง'", "t('privacy.summary2')")
    c = c.replace("'เราไม่ขายข้อมูลของคุณให้บุคคลภายนอก'", "t('privacy.summary3')")
    c = c.replace("'คุณสามารถลบบัญชีและข้อมูลได้ตลอดเวลา'", "t('privacy.summary4')")
    c = c.replace("'มีคำถามเกี่ยวกับความเป็นส่วนตัว?'", "t('privacy.contactTitle')")
    c = c.replace("'ติดต่อเราเพื่อสอบถามหรือใช้สิทธิ์เกี่ยวกับข้อมูลส่วนบุคคล'", "t('privacy.contactSubtitle')")
    c = c.replace("'© 2569 NurseGo. สงวนลิขสิทธิ์.'", "t('privacy.footerCopyright')")
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ PrivacyScreen.tsx — {remaining} Thai chars remaining")


def migrate_terms():
    fp = BASE / "legal" / "TermsScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    if 'const { t' not in c:
        m = re.search(r'(export\s+default\s+function\s+TermsScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t } = useI18n();" + c[m.end():]
    
    replacements = [
        ('ข้อกำหนดการใช้งาน', 'terms.headerTitle', None),
        ('อัปเดตล่าสุด:', 'terms.lastUpdated', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    c = c.replace("'© 2569 NurseGo. สงวนลิขสิทธิ์.'", "t('terms.footerCopyright')")
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ TermsScreen.tsx — {remaining} Thai chars remaining")


# ═══════════════════════════════════════════════════════════════
# SHOP SCREEN
# ═══════════════════════════════════════════════════════════════
def migrate_shop():
    fp = BASE / "shop" / "ShopScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    if 'const { t' not in c:
        m = re.search(r'(export\s+default\s+function\s+ShopScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t } = useI18n();" + c[m.end():]
    
    replacements = [
        ('ยังอยู่ในช่วงทดลองใช้ฟรี', 'shop.trialTitle', None),
        ('ตอนนี้ยังเป็นสิทธิ์ช่วงเปิดตัว', 'shop.launchAccessTitle', None),
        ('กรุณาเข้าสู่ระบบ', 'shop.loginWarning', None),
        ('โพสต์เพิ่ม', 'shop.addonExtraPost', None),
        ('ต่ออายุโพสต์', 'shop.addonExtendPost', None),
        ('ปุ่มด่วน', 'shop.addonUrgent', None),
        ('📋 คัดลอกแล้ว!', 'shop.codeCopiedTitle', None),
        ('❌ เกิดข้อผิดพลาด', 'shop.errorTitle', None),
        ('ลบโค้ดไม่สำเร็จ', 'shop.clearCodeErrorTitle', None),
        ('กรุณาลองใหม่', 'shop.clearCodeErrorMessage', None),
        ('แพ็กเกจปัจจุบัน', 'shop.currentPlanLabel', None),
        ('โค้ดที่รอใช้', 'shop.pendingCodeTitle', None),
        ('ล้าง', 'shop.clearButton', None),
        ('รายเดือน', 'shop.monthly', None),
        ('รายปี', 'shop.annual', None),
        ('ใช้งานอยู่', 'shop.currentTag', None),
        ('อัพเกรด', 'shop.upgradeButton', None),
        ('คัดลอก', 'shop.copyButton', None),
        ('เลือกแผนนี้', 'shop.selectPlan', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    # Long strings
    c = c.replace("'สิทธิ์และบริการในบัญชี'", "t('shop.headerTitleFree')")
    c = c.replace("'สิทธิ์และแพ็กเกจ'", "t('shop.headerTitlePaid')")
    c = c.replace("'สิทธิ์เพิ่มเติมที่เปิดใช้ในบัญชีนี้'", "t('shop.freeAccessTitle')")
    c = c.replace("'แพ็กเกจสำหรับพยาบาล'", "t('shop.nursePlansTitle')")
    c = c.replace("'แพ็กเกจสำหรับโรงพยาบาล'", "t('shop.hospitalPlansTitle')")
    c = c.replace("'แนะนำเพื่อน'", "t('shop.referralTitle')")
    c = c.replace("'โค้ดของคุณ'", "t('shop.referralCodeLabel')")
    c = c.replace("'เพื่อนที่แนะนำ'", "t('shop.statReferred')")
    c = c.replace("'เดือนฟรีที่ได้'", "t('shop.statFreeMonths')")
    c = c.replace("'เดือนคงเหลือ'", "t('shop.statMonthsLeft')")
    c = c.replace("'รวมในสิทธิ์บัญชีนี้'", "t('shop.includedInAccount')")
    c = c.replace("'สิทธิ์ที่เปิดใช้ในบัญชีนี้'", "t('shop.sectionAccessTitle')")
    c = c.replace("'โพสต์เพิ่ม 1 ครั้ง'", "t('shop.extraPostTitle')")
    c = c.replace("'ต่ออายุโพสต์ +1 วัน'", "t('shop.extendPostTitle')")
    c = c.replace("'ปุ่มด่วน (Urgent)'", "t('shop.urgentTitle')")
    c = c.replace("'/ปี'", "t('shop.perYear')")
    c = c.replace("'/เดือน'", "t('shop.perMonth')")
    c = c.replace("'ลบโค้ดที่รอใช้แล้ว'", "t('shop.clearCodeSuccessTitle')")
    c = c.replace("'คุณสามารถกลับไปกรอกโค้ดใหม่ที่หน้าโปรไฟล์ได้'", "t('shop.clearCodeSuccessMessage')")
    c = c.replace("'ประหยัด ~17%'", "t('shop.savingsHint')")
    c = c.replace("'ระบบจะใช้โค้ดนี้อัตโนมัติเมื่อซื้อรายการที่ตรงกัน'", "t('shop.pendingCodeHint')")
    c = c.replace("'เปิดใช้รายครั้ง'", "t('shop.addonsTitlePaid')")
    
    # Audience descriptions
    for key in ['audienceFree', 'audiencePremium', 'audienceNursePro', 'audienceHospitalStarter', 'audienceHospitalPro', 'audienceHospitalEnterprise']:
        pass  # These are in data arrays, harder to match precisely
    
    # Referral headline
    c = c.replace("'แนะนำเพื่อน → ได้ Pro ฟรี 1 เดือน!'", "t('shop.referralHeadline')")
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ ShopScreen.tsx — {remaining} Thai chars remaining")


# ═══════════════════════════════════════════════════════════════
# CHOOSE ROLE & ONBOARDING SCREENS
# ═══════════════════════════════════════════════════════════════
def migrate_choose_role():
    fp = BASE / "auth" / "ChooseRoleScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    if 'const { t' not in c:
        m = re.search(r'(export\s+default\s+function\s+ChooseRoleScreen[^{]*\{)', c)
        if not m:
            m = re.search(r'(function\s+ChooseRoleScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t } = useI18n();" + c[m.end():]
    
    replacements = [
        ('พยาบาล / บุคลากรทางการแพทย์', 'chooseRole.nurseTitle', None),
        ('โรงพยาบาล / คลินิก / เอเจนซี่', 'chooseRole.hospitalTitle', None),
        ('คนทั่วไป / ญาติผู้ป่วย', 'chooseRole.userTitle', None),
        ('ค้นหางานเวร / งานพาร์ทไทม์', 'chooseRole.nurseBullet1', None),
        ('แจ้งเตือนงานใกล้ตัวอัตโนมัติ', 'chooseRole.nurseBullet2', None),
        ('แสดงใบประกอบวิชาชีพได้', 'chooseRole.nurseBullet3', None),
        ('โพสต์งานหาพยาบาล / CG', 'chooseRole.hospitalBullet1', None),
        ('จัดการผู้สมัครได้', 'chooseRole.hospitalBullet2', None),
        ('ดูสถิติ + ประวัติผู้สมัคร', 'chooseRole.hospitalBullet3', None),
        ('หาผู้ดูแลผู้ป่วย / เฝ้าไข้', 'chooseRole.userBullet1', None),
        ('ดูรีวิว + ตรวจสอบตัวตนได้', 'chooseRole.userBullet2', None),
        ('แชทกับผู้ดูแลได้โดยตรง', 'chooseRole.userBullet3', None),
        ('RN — พยาบาลวิชาชีพ', 'chooseRole.staffRN', None),
        ('PN — พยาบาลเทคนิค', 'chooseRole.staffPN', None),
        ('NA — ผู้ช่วยพยาบาล', 'chooseRole.staffNA', None),
        ('ANES — วิสัญญีพยาบาล', 'chooseRole.staffANES', None),
        ('CG — ผู้ดูแลผู้ป่วย', 'chooseRole.staffCG', None),
        ('เฝ้าไข้', 'chooseRole.staffSitter', None),
        ('อื่นๆ', 'chooseRole.staffOther', None),
        ('โรงพยาบาลรัฐ', 'chooseRole.orgPublic', None),
        ('โรงพยาบาลเอกชน', 'chooseRole.orgPrivate', None),
        ('คลินิก', 'chooseRole.orgClinic', None),
        ('เอเจนซี่จัดหางาน', 'chooseRole.orgAgency', None),
        ('ไม่พบผู้ใช้ที่เข้าสู่ระบบ', 'chooseRole.userNotFound', None),
        ('เกิดข้อผิดพลาด', 'chooseRole.errorTitle', None),
        ('กำลังบันทึก...', 'chooseRole.saving', None),
        ('ดำเนินการต่อ', 'chooseRole.continue', None),
        ('ข้ามไปก่อน', 'chooseRole.skip', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    c = c.replace("'กำลังมองหางานเวร, งานพาร์ทไทม์'", "t('chooseRole.nurseSubtitle')")
    c = c.replace("'ต้องการโพสต์หาบุคลากร'", "t('chooseRole.hospitalSubtitle')")
    c = c.replace("'กำลังหาคนดูแลผู้ป่วยที่บ้าน'", "t('chooseRole.userSubtitle')")
    c = c.replace("'ขั้นตอนที่ 2 / 3'", "t('chooseRole.stepLabel')")
    c = c.replace("'คุณเป็นใคร?'", "t('chooseRole.title')")
    c = c.replace("'เลือกบทบาทเพื่อประสบการณ์ที่เหมาะกับคุณ'", "t('chooseRole.subtitle')")
    c = c.replace("'คุณเป็นบุคลากรประเภทไหน?'", "t('chooseRole.staffTypeLabel')")
    c = c.replace("'(ไม่บังคับ)'", "t('chooseRole.optional')")
    c = c.replace("'ประเภทองค์กรของคุณ?'", "t('chooseRole.orgTypeLabel')")
    c = c.replace("'ไม่สามารถบันทึกได้ กรุณาลองใหม่'", "t('chooseRole.errorSave')")
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ ChooseRoleScreen.tsx — {remaining} Thai chars remaining")


def migrate_onboarding():
    fp = BASE / "auth" / "OnboardingSurveyScreen.tsx"
    c = fp.read_text('utf-8')
    c = add_i18n_import(c, '../../i18n')
    
    if 'const { t' not in c:
        m = re.search(r'(export\s+default\s+function\s+OnboardingSurveyScreen[^{]*\{)', c)
        if not m:
            m = re.search(r'(function\s+OnboardingSurveyScreen[^{]*\{)', c)
        if m:
            c = c[:m.end()] + "\n  const { t } = useI18n();" + c[m.end():]
    
    replacements = [
        ('ประจำ / เต็มเวลา', 'onboarding.workFulltime', None),
        ('พาร์ทไทม์ / ชั่วคราว', 'onboarding.workParttime', None),
        ('เฉพาะวันหยุด / เสาร์-อาทิตย์', 'onboarding.workWeekend', None),
        ('ยืดหยุ่น / รับทุกรูปแบบ', 'onboarding.workFlexible', None),
        ('ดูแลผู้สูงอายุทั่วไป', 'onboarding.careElderly', None),
        ('ดูแลผู้ป่วยติดเตียง', 'onboarding.careBedridden', None),
        ('ดูแลหลังผ่าตัด / พักฟื้น', 'onboarding.carePostSurg', None),
        ('ดูแลเด็ก / เด็กป่วย', 'onboarding.careChild', None),
        ('ดูแลผู้ป่วยระยะท้าย', 'onboarding.careTerminal', None),
        ('อื่นๆ', 'onboarding.careOther', None),
        ('เร่งด่วนมาก', 'onboarding.urgencyNow', None),
        ('ภายใน 1 สัปดาห์', 'onboarding.urgencyWeek', None),
        ('ภายใน 1 เดือน', 'onboarding.urgencyMonth', None),
        ('วางแผนล่วงหน้า', 'onboarding.urgencyPlan', None),
        ('สำหรับพยาบาล', 'onboarding.badgeNurse', None),
        ('สำหรับองค์กร', 'onboarding.badgeHospital', None),
        ('สำหรับผู้ใช้งานทั่วไป', 'onboarding.badgeUser', None),
        ('หน้าแรก', 'onboarding.nurseFeature1', None),
        ('โพสต์', 'onboarding.nurseFeature2', None),
        ('ข้อความ', 'onboarding.nurseFeature3', None),
        ('โปรไฟล์', 'onboarding.nurseFeature4', None),
        ('ข้ามทั้งหมด', 'onboarding.skipAll', None),
        ('ย้อนกลับ', 'onboarding.goBack', None),
        ('ข้ามขั้นตอนนี้', 'onboarding.skipStep', None),
        ('ถัดไป', 'onboarding.next', None),
        ('เข้าแอปเลย', 'onboarding.enterApp', None),
    ]
    c = replace_thai_strings(c, replacements)
    
    # Long hero/highlight strings
    c = c.replace("'เริ่มใช้งานได้คล่องในไม่กี่นาที'", "t('onboarding.step1Title')")
    c = c.replace("'ฟีเจอร์หลักอยู่ตรงไหน'", "t('onboarding.step2Title')")
    c = c.replace("'ปรับแอปให้ตรงกับคุณ'", "t('onboarding.step3Title')")
    c = c.replace("'หางานไว คุยสะดวก และจัดการโปรไฟล์ได้ในที่เดียว'", "t('onboarding.heroNurse')")
    c = c.replace("'โพสต์รับสมัคร ดูผู้สนใจ และคุยต่อได้ในที่เดียว'", "t('onboarding.heroHospital')")
    c = c.replace("'บอกเราว่าคุณทำงานแบบไหน'", "t('onboarding.nurseSetupTitle')")
    c = c.replace("'ตั้งค่าพื้นฐานขององค์กร'", "t('onboarding.hospitalSetupTitle')")
    c = c.replace("'หางานแทนเวรได้ไว'", "t('onboarding.nurseHighlight1')")
    c = c.replace("'คุยกับผู้โพสต์ได้ต่อเนื่อง'", "t('onboarding.nurseHighlight2')")
    c = c.replace("'เพิ่มความมั่นใจให้โปรไฟล์'", "t('onboarding.nurseHighlight3')")
    c = c.replace("'ประเภทวิชาชีพของคุณ'", "t('onboarding.staffTypeTitle')")
    c = c.replace("'จังหวัดที่ใช้งานบ่อย'", "t('onboarding.provinceTitle')")
    c = c.replace("'ค้นหาจังหวัด...'", "t('onboarding.provinceSearchPlaceholder')")
    c = c.replace("'รูปแบบงานที่คุณสนใจ'", "t('onboarding.nurseSetupLabel')")
    c = c.replace("'ความเร่งด่วนในการหาคน'", "t('onboarding.hospitalSetupLabel')")
    c = c.replace("'ประเภทการดูแลที่ต้องการ'", "t('onboarding.userSetupLabel')")
    c = c.replace("'บอกประเภทการดูแลที่คุณสนใจ'", "t('onboarding.userSetupTitle')")
    
    fp.write_text(c, 'utf-8')
    remaining = len(re.findall(r'[ก-๙]', c))
    print(f"✅ OnboardingSurveyScreen.tsx — {remaining} Thai chars remaining")


# ═══════════════════════════════════════════════════════════════
# RUN ALL MIGRATIONS
# ═══════════════════════════════════════════════════════════════
if __name__ == '__main__':
    print("Starting migrations...\n")
    migrate_chat()
    migrate_myposts()
    migrate_notifications()
    migrate_payment()
    migrate_favorites()
    migrate_map()
    migrate_help()
    migrate_reviews()
    migrate_verification()
    migrate_documents()
    migrate_feedback()
    migrate_privacy()
    migrate_terms()
    migrate_shop()
    migrate_choose_role()
    migrate_onboarding()
    print("\n✅ All migrations complete!")
