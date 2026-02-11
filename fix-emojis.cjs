// Script to remove garbled emoji characters from source files
const fs = require('fs');
const path = require('path');

const files = [
    'src/pages/AdmissionDischargePage.tsx',
    'src/pages/PatientProfile.tsx',
    'src/pages/PatientEducation.tsx',
    'src/pages/ShoppingList.tsx',
    'src/pages/WoundCarePage.tsx',
    'src/components/PatientSummary.tsx',
    'src/components/MDTDischargeMedications.tsx',
    'src/components/DischargeDocumentsPreview.tsx',
    'src/components/procedures/PreoperativePlanning.tsx'
];

// Pattern to match garbled 4-byte UTF-8 emojis (when file is read as UTF-8)
// These patterns appear as sequences starting with specific bytes
const emojiPatterns = [
    // Remove emoji followed by space
    /[\u{1F300}-\u{1F9FF}]\s*/gu,
    // Remove emoji without space
    /[\u{1F300}-\u{1F9FF}]/gu,
    // Misc symbols
    /[\u{2600}-\u{26FF}]\s*/gu,
    /[\u{2700}-\u{27BF}]\s*/gu,
    // Dingbats  
    /[\u{2702}-\u{27B0}]\s*/gu,
    // Arrows (keep these as text)
    // /[\u{2190}-\u{21FF}]/gu,
];

// Remove specific garbled patterns that appear as mojibake
const mojibakePatterns = [
    // These are typical mojibake patterns for emojis
    /ðŸ[^\sa-zA-Z0-9]*\s*/g,
    /âœ[^\sa-zA-Z0-9]*\s*/g,
    /âž[^\sa-zA-Z0-9]*\s*/g,
    /â³\s*/g,
    /âš[^\sa-zA-Z0-9]*\s*/g,
    /â†[\s\S]?/g,
    /â›[^\sa-zA-Z0-9]*\s*/g,
];

// String replacements for symbols
const replacements = {
    '\xC2\xB0': '\xB0',  // Â° -> °
    '\xC2\xB2': '\xB2',  // Â² -> ²
    '\xE2\x80\xA2': '\u2022',  // Mojibake bullet -> •
    '\xE2\x86\x92': '\u2192',  // Mojibake arrow -> →
    '\xE2\x86\x90': '\u2190',  // Mojibake arrow -> ←
};

function fixFile(filepath) {
    if (!fs.existsSync(filepath)) {
        console.log(`Not found: ${filepath}`);
        return false;
    }
    
    let content = fs.readFileSync(filepath, 'utf8');
    const original = content;
    
    // Apply string replacements
    for (const [bad, good] of Object.entries(replacements)) {
        content = content.split(bad).join(good);
    }
    
    // Remove emoji patterns
    for (const pattern of emojiPatterns) {
        content = content.replace(pattern, '');
    }
    
    // Remove mojibake patterns
    for (const pattern of mojibakePatterns) {
        content = content.replace(pattern, '');
    }
    
    if (content !== original) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Fixed: ${filepath}`);
        return true;
    }
    
    console.log(`No changes: ${filepath}`);
    return false;
}

let fixed = 0;
for (const file of files) {
    if (fixFile(file)) fixed++;
}
console.log(`\nTotal fixed: ${fixed}/${files.length}`);
