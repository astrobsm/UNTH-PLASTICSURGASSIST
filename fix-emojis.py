#!/usr/bin/env python3
"""
Script to remove garbled emoji characters (UTF-8 mojibake) from source files.
These appear when UTF-8 emojis are incorrectly displayed as Windows-1252.
"""

import os
import re

files_to_fix = [
    'src/pages/AdmissionDischargePage.tsx',
    'src/pages/PatientProfile.tsx',
    'src/pages/PatientEducation.tsx',
    'src/pages/ShoppingList.tsx',
    'src/pages/WoundCarePage.tsx',
    'src/components/PatientSummary.tsx',
    'src/components/MDTDischargeMedications.tsx',
    'src/components/DischargeDocumentsPreview.tsx',
    'src/components/procedures/PreoperativePlanning.tsx'
]

# Common mojibake patterns - these are UTF-8 bytes misinterpreted as Windows-1252
# We'll use regex to match various garbled emoji patterns
patterns_to_remove = [
    # 4-byte UTF-8 emojis showing as garbled text (various patterns)
    r'\xc3\xb0\xc5\xb8[\x80-\xff]{2,4}\s*',  # Many emoji patterns
    r'ðŸ[^\s]*\s*',  # Hospital, door, clipboard, chart, refresh, etc
    r'âœ[^\s]*\s*',  # Check marks
    r'âž[^\s]*\s*',  # Plus signs
    r'â³\s*',  # Hourglass
    r'âš[^\s]*\s*',  # Warning signs
    r'â†[^\s]*',  # Arrows
    r'â€¢',  # Bullet point
    r'â›[^\s]*',  # No entry
    r'âœ‰[^\s]*\s*',  # Envelope
]

# Specific replacements for degree and other symbols
symbol_fixes = {
    'Â°': '°',
    'Â²': '²',
    'cmÂ²': 'cm²',
    '38Â°C': '38°C',
    '100.4Â°F': '100.4°F',
    'mL/min/1.73mÂ²': 'mL/min/1.73m²',
}

def fix_file(filepath):
    if not os.path.exists(filepath):
        print(f'Not found: {filepath}')
        return False
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Apply symbol fixes first
    for bad, good in symbol_fixes.items():
        content = content.replace(bad, good)
    
    # Remove emoji patterns
    for pattern in patterns_to_remove:
        content = re.sub(pattern, '', content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Fixed: {filepath}')
        return True
    else:
        print(f'No changes: {filepath}')
        return False

def main():
    fixed_count = 0
    for filepath in files_to_fix:
        if fix_file(filepath):
            fixed_count += 1
    print(f'\nTotal files fixed: {fixed_count}/{len(files_to_fix)}')

if __name__ == '__main__':
    main()
