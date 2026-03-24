#!/usr/bin/env python3
"""
Fix all t() scope bugs:
1. Sub-components missing useI18n hook (FavoritesScreen, ChatScreens)
2. Module-level data using t() → convert to getter functions + useMemo
3. Helper functions using t()/resolvedLanguage → pass as params
4. Misplaced imports
5. Local variable `t` shadowing useI18n's t
"""
import re
from pathlib import Path

BASE = Path('/Users/nursego/nursejob/src/screens')

# ════════════════════════════════════════════════════════════════
# FAVORITES SCREEN — add useI18n to sub-components
# ════════════════════════════════════════════════════════════════
def fix_favorites():
    fp = BASE / 'favorites' / 'FavoritesScreen.tsx'
    c = fp.read_text('utf-8')

    # EmptyState sub-component needs useI18n
    old = '''function EmptyState({ filtered }: { filtered: boolean }) {
  const { colors } = useTheme();'''
    new = '''function EmptyState({ filtered }: { filtered: boolean }) {
  const { t } = useI18n();
  const { colors } = useTheme();'''
    assert old in c, "EmptyState anchor not found"
    c = c.replace(old, new, 1)

    # FavoriteCard sub-component needs useI18n + resolvedLanguage
    old = '''function FavoriteCard({ favorite, onPress, onRemove, removing }: FavoriteCardProps) {
  const { colors } = useTheme();'''
    new = '''function FavoriteCard({ favorite, onPress, onRemove, removing }: FavoriteCardProps) {
  const { t, resolvedLanguage } = useI18n();
  const { colors } = useTheme();'''
    assert old in c, "FavoriteCard anchor not found"
    c = c.replace(old, new, 1)

    # Remove the duplicate hook from main FavoritesScreen component
    # (it was added to both sub-components AND the main component; keep main one too)
    fp.write_text(c, 'utf-8')
    print(f"✅ FavoritesScreen — sub-component hooks added")


# ════════════════════════════════════════════════════════════════
# CHAT SCREENS — fix multiple issues
# ════════════════════════════════════════════════════════════════
def fix_chat():
    fp = BASE / 'chat' / 'ChatScreens.tsx'
    c = fp.read_text('utf-8')

    # 1. ConversationRow: add useI18n
    old = 'function ConversationRow({ item, userId, onPress, onHide, onDelete, colors }: ConvItemProps) {'
    new = '''function ConversationRow({ item, userId, onPress, onHide, onDelete, colors }: ConvItemProps) {
  const { t } = useI18n();'''
    assert old in c, "ConversationRow anchor not found"
    c = c.replace(old, new, 1)

    # 2. MessageBubble: add useI18n
    old = '''function MessageBubble({
  msg, isOwn, showAvatar, other, colors, onImagePress,'''
    new = '''function MessageBubble({
  msg, isOwn, showAvatar, other, colors, onImagePress,'''
    # Find the function opening brace and add after it
    mb_match = re.search(r'function MessageBubble\([^)]*\)\s*\{', c, re.DOTALL)
    if mb_match:
        insert_pos = mb_match.end()
        if 'useI18n' not in c[insert_pos:insert_pos+200]:
            c = c[:insert_pos] + '\n  const { t } = useI18n();' + c[insert_pos:]
            print("  MessageBubble: added useI18n")

    # 3. Fix formatTime: pass resolvedLanguage as parameter
    # formatTime currently tries to use module-level resolvedLanguage
    old = 'function formatTime(date: any): string {'
    if old in c:
        new = 'function formatTime(date: any, lang = \'th\'): string {'
        c = c.replace(old, new, 1)
        # Update usage: formatTime(item.lastMessageAt) → formatTime(item.lastMessageAt, resolvedLanguage)
        c = re.sub(
            r'formatTime\(item\.lastMessageAt\)',
            "formatTime(item.lastMessageAt, resolvedLanguage)",
            c
        )
        # Fix the resolvedLanguage refs inside formatTime to use the `lang` param
        # The function body references resolvedLanguage in toLocaleTimeString
        # We need to change them to use `lang` inside formatTime
        # Find the formatTime function body and replace only there
        ft_start = c.find('function formatTime(date: any, lang')
        ft_end = c.find('\n}', ft_start) + 2
        ft_body = c[ft_start:ft_end]
        ft_body_fixed = ft_body.replace(
            "resolvedLanguage === 'th' ? 'th-TH' : 'en-US'",
            "lang === 'th' ? 'th-TH' : 'en-US'"
        )
        # Fix translate call — use lang param
        ft_body_fixed = ft_body_fixed.replace(
            "translate('th', 'chat.yesterday')",
            "translate(lang as any, 'chat.yesterday')"
        )
        ft_body_fixed = ft_body_fixed.replace(
            "translate('th', 'chat.daysAgo', { count: String(diffDays) })",
            "translate(lang as any, 'chat.daysAgo', { count: String(diffDays) })"
        )
        c = c[:ft_start] + ft_body_fixed + c[ft_end:]
        print("  formatTime: updated to accept lang param")

    # 4. Fix QUICK_REPLY_TEMPLATES — move inside ChatRoomScreen as useMemo
    old_qr = '''const QUICK_REPLY_TEMPLATES = [
  t('chat.quickReplyInterested'),
  t('chat.quickReplyDocsSent'),
  t('chat.quickReplyMoreDetails'),
  t('chat.quickReplyWhenToChat'),
];'''
    if old_qr in c:
        # Remove the module-level declaration
        c = c.replace(old_qr, '// QUICK_REPLY_TEMPLATES moved inside ChatRoomScreen', 1)
        # Add it inside ChatRoomScreen after the useI18n hook
        hook_line = "  const { t, resolvedLanguage } = useI18n();\n"
        qr_inside = """  const QUICK_REPLY_TEMPLATES = useMemo(() => [
    t('chat.quickReplyInterested'),
    t('chat.quickReplyDocsSent'),
    t('chat.quickReplyMoreDetails'),
    t('chat.quickReplyWhenToChat'),
  ], [t]);\n"""
        # Find the useI18n line in ChatRoomScreen
        crs_idx = c.find('export function ChatRoomScreen(')
        if crs_idx >= 0:
            hook_idx = c.find(hook_line, crs_idx)
            if hook_idx >= 0:
                insert_at = hook_idx + len(hook_line)
                c = c[:insert_at] + qr_inside + c[insert_at:]
                print("  QUICK_REPLY_TEMPLATES: moved inside ChatRoomScreen")

    # 5. Fix sendTextMessage: rename local `t` to `trimmed`
    old_send = '''  const sendTextMessage = async (messageText: string) => {
    const t = messageText.trim();
    if (!t || isSending || !user?.uid || chatLockReason) return;
    setIsSending(true);
    try {
      await trackEvent({
        eventName: 'message_sent',
        screenName: 'ChatRoom',
        subjectType: 'message',
        subjectId: conversationId,
        conversationId,
        props: {
          source: 'chat_room',
          messageType: 'text',
          textLength: t.length,
        },
      });

      await sendMessage(conversationId, user.uid, user.displayName || t('chat.unknownUser'), t);'''
    new_send = '''  const sendTextMessage = async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed || isSending || !user?.uid || chatLockReason) return;
    setIsSending(true);
    try {
      await trackEvent({
        eventName: 'message_sent',
        screenName: 'ChatRoom',
        subjectType: 'message',
        subjectId: conversationId,
        conversationId,
        props: {
          source: 'chat_room',
          messageType: 'text',
          textLength: trimmed.length,
        },
      });

      await sendMessage(conversationId, user.uid, user.displayName || t('chat.unknownUser'), trimmed);'''
    if old_send in c:
        c = c.replace(old_send, new_send, 1)
        print("  sendTextMessage: renamed t to trimmed")
    else:
        print("  ⚠️ sendTextMessage anchor not found (may already be fixed)")

    # 6. Fix handleSend: rename local `t` to `trimmed`
    old_hs = '''  const handleSend = async () => {
    const t = text.trim();
    if (!t || isSending || !user?.uid || chatLockReason) return;
    setText('');
    await sendTextMessage(t);
  };'''
    new_hs = '''  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending || !user?.uid || chatLockReason) return;
    setText('');
    await sendTextMessage(trimmed);
  };'''
    if old_hs in c:
        c = c.replace(old_hs, new_hs, 1)
        print("  handleSend: renamed t to trimmed")
    else:
        print("  ⚠️ handleSend anchor not found")

    # 7. Fix recipientName → derive from `other`
    old_rn = "      t('chat.deleteConversationMessage', { name: recipientName }),"
    new_rn = "      t('chat.deleteConversationMessage', { name: other?.displayName || other?.name || t('chat.unknownUser') }),"
    if old_rn in c:
        c = c.replace(old_rn, new_rn, 1)
        print("  handleDelete: fixed recipientName")
    else:
        print("  ⚠️ recipientName anchor not found")

    fp.write_text(c, 'utf-8')
    print(f"✅ ChatScreens — fixed")


# ════════════════════════════════════════════════════════════════
# MAP JOBS SCREEN — convert module-level data to getters
# ════════════════════════════════════════════════════════════════
def fix_map():
    fp = BASE / 'map' / 'MapJobsScreen.tsx'
    c = fp.read_text('utf-8')

    # Convert STAFF_LABELS to getter
    old = '''const STAFF_LABELS: Record<string, string> = {
  rn: t('map.staffTypeRN'),
  RN: t('map.staffTypeRN'),
  lpn: t('map.staffTypeLPN'),
  LPN: t('map.staffTypeLPN'),
  PN: t('map.staffTypeLPN'),
  NA: t('map.staffTypeLPN'),
  nurse_aide: t('map.staffTypeLPN'),
  CG: t('map.staffTypeCG'),
  caregiver: t('map.staffTypeCG'),
  SITTER: t('map.staffTypeSitter'),
  ANES: t('map.staffTypeAnes'),
  OTHER: t('map.staffTypeOther'),
  other: t('map.staffTypeOther'),
};'''
    new = '''const getStaffLabels = (t: (k: string) => string): Record<string, string> => ({
  rn: t('map.staffTypeRN'),
  RN: t('map.staffTypeRN'),
  lpn: t('map.staffTypeLPN'),
  LPN: t('map.staffTypeLPN'),
  PN: t('map.staffTypeLPN'),
  NA: t('map.staffTypeLPN'),
  nurse_aide: t('map.staffTypeLPN'),
  CG: t('map.staffTypeCG'),
  caregiver: t('map.staffTypeCG'),
  SITTER: t('map.staffTypeSitter'),
  ANES: t('map.staffTypeAnes'),
  OTHER: t('map.staffTypeOther'),
  other: t('map.staffTypeOther'),
});'''
    assert old in c, "STAFF_LABELS not found"
    c = c.replace(old, new, 1)

    # Convert POST_TYPE_LABELS to getter
    old = '''const POST_TYPE_LABELS: Record<string, string> = {
  shift: t('map.postTypeShift'),
  job: t('map.postTypeJob'),
  homecare: t('map.postTypeHomecare'),
};'''
    new = '''const getPostTypeLabels = (t: (k: string) => string): Record<string, string> => ({
  shift: t('map.postTypeShift'),
  job: t('map.postTypeJob'),
  homecare: t('map.postTypeHomecare'),
});'''
    assert old in c, "POST_TYPE_LABELS not found"
    c = c.replace(old, new, 1)

    # Inside the main component, add useMemo calls after the useI18n hook
    hook_pattern = "  const { t } = useI18n();"
    insert_after = """\n  const STAFF_LABELS = useMemo(() => getStaffLabels(t), [t]);
  const POST_TYPE_LABELS = useMemo(() => getPostTypeLabels(t), [t]);"""

    # Find the hook in the component context
    comp_idx = c.find('export default function MapJobsScreen')
    if comp_idx < 0:
        comp_idx = c.find('function MapJobsScreen')
    hook_idx = c.find(hook_pattern, comp_idx)
    if hook_idx >= 0:
        insert_at = hook_idx + len(hook_pattern)
        c = c[:insert_at] + insert_after + c[insert_at:]
        print("  STAFF_LABELS/POST_TYPE_LABELS: useMemo added to component")
    else:
        print("  ⚠️ useI18n hook not found in MapJobsScreen component")

    fp.write_text(c, 'utf-8')
    print(f"✅ MapJobsScreen — fixed")


# ════════════════════════════════════════════════════════════════
# NOTIFICATIONS SCREEN — pass t to groupNotificationsByDate
# ════════════════════════════════════════════════════════════════
def fix_notifications():
    fp = BASE / 'notifications' / 'NotificationsScreen.tsx'
    c = fp.read_text('utf-8')

    # Fix the function signature to accept t and resolvedLanguage
    old = "const groupNotificationsByDate = (notifications: Notification[]) => {"
    new = "const groupNotificationsByDate = (notifications: Notification[], t: (k: string) => string, resolvedLanguage: string) => {"
    assert old in c, "groupNotificationsByDate signature not found"
    c = c.replace(old, new, 1)

    # Fix the call site
    old_call = "return groupNotificationsByDate(notifications);"
    new_call = "return groupNotificationsByDate(notifications, t, resolvedLanguage);"
    assert old_call in c, "groupNotificationsByDate call not found"
    c = c.replace(old_call, new_call, 1)

    fp.write_text(c, 'utf-8')
    print(f"✅ NotificationsScreen — fixed")


# ════════════════════════════════════════════════════════════════
# CHOOSE ROLE SCREEN — fix misplaced import + convert data arrays
# ════════════════════════════════════════════════════════════════
def fix_choose_role():
    fp = BASE / 'auth' / 'ChooseRoleScreen.tsx'
    c = fp.read_text('utf-8')

    # 1. Remove misplaced import from inside component
    misplaced = "\nimport { useI18n } from '../../i18n';\n"
    if misplaced in c:
        c = c.replace(misplaced, '\n', 1)
        print("  Removed misplaced import")

    # 2. Convert ROLES to getter
    roles_pattern = re.search(
        r"const ROLES: RoleOption\[\] = \[[\s\S]*?\];",
        c
    )
    if roles_pattern:
        roles_text = roles_pattern.group(0)
        roles_getter = roles_text.replace(
            "const ROLES: RoleOption[] = [",
            "const getRoles = (t: (k: string) => string): RoleOption[] => ["
        )
        c = c.replace(roles_text, roles_getter, 1)
        print("  ROLES: converted to getRoles getter")

    # 3. Convert NURSE_STAFF_TYPES to getter
    nst_pattern = re.search(
        r"const NURSE_STAFF_TYPES = \[[\s\S]*?\];",
        c
    )
    if nst_pattern:
        nst_text = nst_pattern.group(0)
        nst_getter = nst_text.replace(
            "const NURSE_STAFF_TYPES = [",
            "const getNurseStaffTypes = (t: (k: string) => string) => ["
        )
        c = c.replace(nst_text, nst_getter, 1)
        print("  NURSE_STAFF_TYPES: converted to getter")

    # 4. Convert ORG_TYPES to getter
    org_pattern = re.search(
        r"const ORG_TYPES:.*?= \[[\s\S]*?\];",
        c
    )
    if org_pattern:
        org_text = org_pattern.group(0)
        org_type_decl = re.match(r"const ORG_TYPES:(.*?)= \[", org_text, re.DOTALL)
        if org_type_decl:
            type_ann = org_type_decl.group(1).strip()
            org_getter = org_text.replace(
                f"const ORG_TYPES: {type_ann} = [",
                f"const getOrgTypes = (t: (k: string) => string): {type_ann} => ["
            )
            c = c.replace(org_text, org_getter, 1)
            print("  ORG_TYPES: converted to getter")

    # 5. Inside the component, add useMemo for the data arrays
    #    Find the useI18n hook in the component
    comp_idx = c.find('export default function ChooseRoleScreen')
    if comp_idx < 0:
        comp_idx = c.find('function ChooseRoleScreen')
    hook_line = "  const { t } = useI18n();"
    hook_idx = c.find(hook_line, comp_idx)
    if hook_idx >= 0:
        insert_at = hook_idx + len(hook_line)
        memos = """\n  const ROLES = useMemo(() => getRoles(t), [t]);
  const NURSE_STAFF_TYPES = useMemo(() => getNurseStaffTypes(t), [t]);
  const ORG_TYPES = useMemo(() => getOrgTypes(t), [t]);"""
        c = c[:insert_at] + memos + c[insert_at:]
        print("  useMemo for ROLES/NURSE_STAFF_TYPES/ORG_TYPES added")
    else:
        print("  ⚠️ useI18n hook not found in ChooseRoleScreen")

    fp.write_text(c, 'utf-8')
    print(f"✅ ChooseRoleScreen — fixed")


# ════════════════════════════════════════════════════════════════
# ONBOARDING SURVEY SCREEN — convert module-level data to getters
# ════════════════════════════════════════════════════════════════
def fix_onboarding():
    fp = BASE / 'auth' / 'OnboardingSurveyScreen.tsx'
    c = fp.read_text('utf-8')

    # Convert each constant array/object to a getter function
    conversions = [
        ("const NURSE_WORK_STYLES = [", "const getNurseWorkStyles = (t: (k: string) => string) => ["),
        ("const USER_CARE_TYPES = [", "const getUserCareTypes = (t: (k: string) => string) => ["),
        ("const HOSPITAL_URGENCY = [", "const getHospitalUrgency = (t: (k: string) => string) => ["),
        ("const STEP_META = [", "const getStepMeta = (t: (k: string) => string) => ["),
    ]
    for old_decl, new_decl in conversions:
        if old_decl in c:
            c = c.replace(old_decl, new_decl, 1)
            print(f"  {old_decl[:30]}: converted to getter")

    # ROLE_GUIDE is an object not array
    old_rg = "const ROLE_GUIDE: Record<AppRole, {"
    new_rg = "const getRoleGuide = (t: (k: string) => string): Record<AppRole, {"
    if old_rg in c:
        c = c.replace(old_rg, new_rg, 1)
        # The type annotation continues on the next lines until '> =' so find the closing "> ="
        # Actually the pattern is: "const getRoleGuide = (t): Record<AppRole, {...}> = {"
        # We need to replace "> = {" with "> => ({"  and close with "});"
        # This is complex JSON-like object. Let's do a simpler fix:
        # Replace the last "} = {" → "} => ({" and trailing "};" → "});"
        # Actually just find "}> = {" and replace with "}> => ({"
        c = c.replace("\n}> = {", "\n}> => ({", 1)
        # Now we need to find the end and add ")" - this is very hard to do reliably
        # Let me use a different approach: just use type assertion
        c = c.replace(
            "const getRoleGuide = (t: (k: string) => string): Record<AppRole, {",
            "const getRoleGuide = (t: (k: string) => string) => ({  // Record<AppRole, {"
        )
        # Remove the explicit type annotation closing
        c = c.replace("\n}> = {", "\n// }>", 1)
        print("  ROLE_GUIDE: partial conversion (needs manual review)")

    # Add useMemo calls inside the component
    comp_idx = c.find('export default function OnboardingSurveyScreen')
    if comp_idx < 0:
        comp_idx = c.find('function OnboardingSurveyScreen')
    hook_line = "  const { t } = useI18n();"
    hook_idx = c.find(hook_line, comp_idx)
    if hook_idx >= 0:
        insert_at = hook_idx + len(hook_line)
        memos = """\n  const NURSE_WORK_STYLES = useMemo(() => getNurseWorkStyles(t), [t]);
  const USER_CARE_TYPES = useMemo(() => getUserCareTypes(t), [t]);
  const HOSPITAL_URGENCY = useMemo(() => getHospitalUrgency(t), [t]);
  const STEP_META = useMemo(() => getStepMeta(t), [t]);
  const ROLE_GUIDE = useMemo(() => getRoleGuide(t), [t]);"""
        c = c[:insert_at] + memos + c[insert_at:]
        print("  useMemo for all data arrays added")

    fp.write_text(c, 'utf-8')
    print(f"✅ OnboardingSurveyScreen — fixed (ROLE_GUIDE may need manual review)")


# ════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════
print("Fixing t() scope bugs...\n")
fix_favorites()
fix_chat()
fix_map()
fix_notifications()
fix_choose_role()
fix_onboarding()
print("\nDone!")
