const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'src', 'components');
const pagesDir = path.join(__dirname, 'src', 'pages');

const processFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Add empty alt to decorative images without alt
  content = content.replace(/<img((?:(?!alt=)[^>])+?)>/g, (match, p1) => {
    return '<img' + p1 + ' alt="" />';
  });

  // Add aria-label to generic button elements without children text or aria-labels
  content = content.replace(/<button([^>]*)>\s*(<[A-Z][a-zA-Z]*[^>]*\/>)\s*<\/button>/g, (match, p1, p2) => {
    if (p1.includes('aria-label')) return match;
    const iconMatch = p2.match(/<([A-Z][a-zA-Z]*)/);
    let name = iconMatch ? iconMatch[1] : 'Action';
    return '<button' + p1 + ' aria-label="' + name + '">\n        ' + p2 + '\n      </button>';
  });

  // Convert generic a tags with no href to button or add tabindex
  content = content.replace(/<a([^>]*)onClick=([^>]*)>/g, (match, p1, p2) => {
    if (p1.includes('href')) return match;
    if (!p1.includes('role=')) {
      return '<a' + p1 + ' role="button" tabIndex={0} onClick=' + p2 + '>';
    }
    return match;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log('Updated WCAG rules for ' + filePath);
  }
};

const walkSync = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkSync(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      processFile(fullPath);
    }
  }
};

if (fs.existsSync(componentsDir)) walkSync(componentsDir);
if (fs.existsSync(pagesDir)) walkSync(pagesDir);

console.log('WCAG 2.1 Compliance Fixes applied successfully.');
