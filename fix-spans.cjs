// Fix broken span elements and garbled characters
const fs = require('fs');
let content = fs.readFileSync('src/components/DischargeDocumentsPreview.tsx', 'utf8');

// Fix broken span elements where the emoji was removed
// Pattern: <span className="..."><span>{...}</span> should be <span className="...">{...}</span>
content = content.replace(/<span className="([^"]+)">\s*<span>\{([^}]+)\}<\/span>/g, '<span className="$1">{$2}</span>');

// Remove any remaining garbled single character
content = content.replace(/ï¸ /g, '');
content = content.replace(/ï¸/g, '');

// Fix unclosed span with newline between
content = content.replace(/<span className="([^"]+)">\s+<span>\{/g, '<span className="$1">{');

fs.writeFileSync('src/components/DischargeDocumentsPreview.tsx', content, 'utf8');
console.log('Fixed DischargeDocumentsPreview.tsx');
