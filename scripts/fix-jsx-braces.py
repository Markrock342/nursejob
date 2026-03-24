#!/usr/bin/env python3
"""
Fix missing curly braces around t() calls in JSX attributes.
Pattern: attr=t('key') -> attr={t('key')}
"""
import re
import os

BASE = os.path.join(os.path.dirname(__file__), '..')

FILES = [
    'src/screens/chat/ChatScreens.tsx',
    'src/screens/documents/DocumentsScreen.tsx',
    'src/screens/feedback/FeedbackScreen.tsx',
    'src/screens/help/HelpScreen.tsx',
    'src/screens/map/MapJobsScreen.tsx',
    'src/screens/myposts/MyPostsScreen.tsx',
    'src/screens/notifications/NotificationsScreen.tsx',
    'src/screens/reviews/ReviewsScreen.tsx',
    'src/screens/verification/VerificationScreen.tsx',
]

def fix_file(rel_path):
    path = os.path.join(BASE, rel_path)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Fix: attr=t('key') -> attr={t('key')}
    # Match word chars (attr name) followed by =t(' and ending with ')
    # But NOT already wrapped in { }
    # Pattern: (\w)=t\(' ... '\)  but not {t('
    content = re.sub(
        r"(\w)=t\(('[\w.]+?')\)",
        r"\1={t(\2)}",
        content
    )
    
    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        count = len(re.findall(r'\w=t\(', original)) - len(re.findall(r'\w=t\(', content))
        print(f"  ✅ Fixed ({count} occurrences)")
        return True
    else:
        print(f"  ⏭️ No changes needed")
        return False

print("Fixing missing curly braces around t() in JSX attributes...")
for rel_path in FILES:
    print(f"\n{rel_path}:")
    fix_file(rel_path)

print("\nDone!")
