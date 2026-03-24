#!/usr/bin/env python3
"""
Fix two systematic bugs from the i18n migration scripts:
1. Escaped single quotes: \' inside JSX → '
2. Misplaced useI18n hooks: inserted into function params instead of body
"""
import re
import os

BASE = os.path.join(os.path.dirname(__file__), '..')

ALL_FILES = [
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
]

# Files where const { t } = useI18n(); was placed inside function params
# Map: broken text -> (fixed params line, hook line to insert after opening brace)
MISPLACED_HOOKS = {
    'src/screens/auth/ChooseRoleScreen.tsx': {
        'broken': "  const { t } = useI18n(); navigation, route }: { navigation: Nav; route: Route }) {",
        'fixed_sig': "  navigation, route }: { navigation: Nav; route: Route }) {",
        'hook_line': "  const { t } = useI18n();",
    },
    'src/screens/auth/OnboardingSurveyScreen.tsx': {
        'broken': "  const { t } = useI18n(); navigation }: Props) {",
        'fixed_sig': "  navigation }: Props) {",
        'hook_line': "  const { t } = useI18n();",
    },
    'src/screens/map/MapJobsScreen.tsx': {
        'broken': "  const { t } = useI18n(); navigation }: MapJobsProps) {",
        'fixed_sig': "  navigation }: MapJobsProps) {",
        'hook_line': "  const { t } = useI18n();",
    },
    'src/screens/payment/PaymentScreen.tsx': {
        'broken': "  const { t } = useI18n(); route, navigation }: Props) {",
        'fixed_sig': "  route, navigation }: Props) {",
        'hook_line': "  const { t } = useI18n();",
    },
    'src/screens/verification/VerificationScreen.tsx': {
        'broken': "  const { t } = useI18n(); navigation }: Props) {",
        'fixed_sig': "  navigation }: Props) {",
        'hook_line': "  const { t } = useI18n();",
    },
}

def fix_file(rel_path):
    path = os.path.join(BASE, rel_path)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Fix 1: Unescape single quotes — replace \' with '
    # These appear in JSX like {t(\'chat.hide\')} -> {t('chat.hide')}
    content = content.replace("\\'", "'")
    
    # Fix 2: Fix misplaced useI18n hooks
    if rel_path in MISPLACED_HOOKS:
        info = MISPLACED_HOOKS[rel_path]
        if info['broken'] in content:
            # Replace the broken line with the fixed signature
            content = content.replace(info['broken'], info['fixed_sig'])
            
            # Now find the opening brace of the function and insert the hook after it
            # The fixed_sig ends with ") {" — we need to add the hook line after the next line
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if info['fixed_sig'].strip() in line.strip():
                    # Insert the hook line after this line
                    lines.insert(i + 1, info['hook_line'])
                    break
            content = '\n'.join(lines)
            print(f"  Fixed misplaced useI18n hook")
    
    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

print("Fixing migration bugs...")
for rel_path in ALL_FILES:
    print(f"\n{rel_path}:")
    changed = fix_file(rel_path)
    if changed:
        print(f"  ✅ Fixed")
    else:
        print(f"  ⏭️ No changes needed")

print("\nDone!")
