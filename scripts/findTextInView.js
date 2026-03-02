const fs = require('fs');
const path = require('path');

function walkDir(dir, ext, results) {
  results = results || [];
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walkDir(full, ext, results);
    } else if (full.endsWith(ext)) {
      results.push(full);
    }
  });
  return results;
}

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const files = walkDir(srcDir, '.tsx');
console.log('Found', files.length, 'tsx files');

const results = [];

files.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const rel = path.relative('c:\\Projects\\nursejob', filePath).replace(/\\/g, '/');

  // Helper: look backwards from line i to find if we're inside a <Text> tag
  function isInsideText(idx) {
    let depth = 0;
    for (let j = idx; j >= Math.max(0, idx - 30); j--) {
      const prev = lines[j].trim();
      // Count closing Text tags (means we exited a text context going backwards)
      const closeTexts = (prev.match(/<\/Text>/g) || []).length;
      const openTexts = (prev.match(/<Text[\s>]/g) || []).length + (prev.match(/<Text$/g) || []).length;
      depth += openTexts - closeTexts;
      if (depth > 0) return true;
      
      // If we hit an opening View without being in Text, we're in a View
      if (prev.match(/<View[\s>]/) || prev.match(/<View$/) || prev.match(/<SafeAreaView[\s>]/)) {
        if (depth <= 0) return false;
      }
    }
    return false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip lines that are clearly props (key=value)
    if (trimmed.match(/^\w+=\{/) || trimmed.match(/^\w+="/)) continue;
    // Skip style/prop assignments
    if (trimmed.match(/^(style|behavior|title|subtitle|label|placeholder|message|confirmText|cancelText|name|onPress|onLongPress)=/)) continue;
    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

    // Pattern 1: {condition && 'string'} or {condition && `template`}
    const strAndPat = /\{[^{}]*&&\s*(['"`])/;
    if (strAndPat.test(trimmed) && !trimmed.includes('style=') && !trimmed.includes('name=')) {
      // Make sure the && result is a string, not a JSX element
      const afterAnd = trimmed.match(/&&\s*(.+)/);
      if (afterAnd && !afterAnd[1].trim().startsWith('<') && !afterAnd[1].trim().startsWith('(')) {
        if (!isInsideText(i)) {
          results.push({ file: rel, line: i + 1, code: trimmed, type: 'condition && string' });
        }
      }
    }

    // Pattern 2: ternary producing strings {x ? 'a' : 'b'} as direct children
    const ternaryPat = /\{[^{}]*\?\s*['"`][^{}]*:\s*['"`][^{}]*\}/;
    if (ternaryPat.test(trimmed) && !trimmed.includes('=') && !trimmed.includes('<')) {
      if (!isInsideText(i)) {
        results.push({ file: rel, line: i + 1, code: trimmed, type: 'ternary string' });
      }
    }

    // Pattern 3: Just a bare string expression {someVar} that might be string
    // This is harder to detect without type info, skip for now

    // Pattern 4: Whitespace text nodes between JSX elements
    // e.g., </View> text </View>  or  </TouchableOpacity> some text <View>
    // Check for text between closing and opening tags
    const betweenTags = trimmed.match(/>([\s]*[a-zA-Zก-๙][^<{]*)<\//);
    if (betweenTags) {
      const textContent = betweenTags[1].trim();
      if (textContent && !trimmed.startsWith('<Text') && !isInsideText(i)) {
        // Check it's not inside a Text element on the same line
        const beforeText = trimmed.substring(0, trimmed.indexOf(textContent));
        if (!beforeText.includes('<Text')) {
          results.push({ file: rel, line: i + 1, code: trimmed, type: 'bare text between tags' });
        }
      }
    }
  }
});

// Print results grouped by file
const byFile = {};
results.forEach(r => {
  if (!byFile[r.file]) byFile[r.file] = [];
  byFile[r.file].push(r);
});

Object.keys(byFile).sort().forEach(file => {
  console.log(`\n=== ${file} ===`);
  byFile[file].forEach(r => {
    console.log(`  Line ${r.line} [${r.type}]: ${r.code.substring(0, 120)}`);
  });
});

console.log(`\n\nTotal potential issues: ${results.length}`);
