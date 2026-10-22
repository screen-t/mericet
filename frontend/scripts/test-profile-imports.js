import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const profilePagePath = path.resolve(__dirname, "../src/pages/ProfileNew.tsx");

console.log(`[TEST] Verifying JSX component imports in ${profilePagePath}...`);

if (!fs.existsSync(profilePagePath)) {
  console.error(`FAIL: File not found: ${profilePagePath}`);
  process.exit(1);
}

const content = fs.readFileSync(profilePagePath, "utf-8");

// Extract all import declarations
const importRegex = /import\s+(?:(?:\*\s+as\s+\w+)|(?:\{[^}]+\})|(?:\w+))(?:\s*,\s*(?:\{[^}]+\}|\w+))?\s+from\s+['"][^'"]+['"]/g;
const importStatements = content.match(importRegex) || [];

const importedIdentifiers = new Set();

for (const stmt of importStatements) {
  // Named imports { A, B as C }
  const namedMatch = stmt.match(/\{([^}]+)\}/);
  if (namedMatch) {
    const names = namedMatch[1].split(",");
    for (let n of names) {
      n = n.trim();
      if (!n) continue;
      if (n.includes(" as ")) {
        const parts = n.split(/\s+as\s+/);
        importedIdentifiers.add(parts[1].trim());
      } else {
        importedIdentifiers.add(n);
      }
    }
  }
  // Default import: import Foo from '...' or import Foo, { Bar } from '...'
  const defaultMatch = stmt.match(/import\s+([A-Za-z0-9_]+)\s*(?:,|$)/);
  if (defaultMatch && defaultMatch[1] && defaultMatch[1] !== "type") {
    importedIdentifiers.add(defaultMatch[1]);
  }
}

// Built-in React components or local declarations
const locallyAllowed = new Set([
  "ProfilePage",
  "Fragment",
]);

// Extract all JSX tags like <ComponentName or <ComponentName.Sub (preceded by whitespace, start of line, (, or return)
const jsxTagRegex = /(?:^|[\s\(\[\{>=])<([A-Z][A-Za-z0-9_]*)(?=[\s\/>])/gm;
const tagsFound = new Set();
let match;
while ((match = jsxTagRegex.exec(content)) !== null) {
  tagsFound.add(match[1]);
}

console.log(`[INFO] Found ${tagsFound.size} unique JSX components.`);

const missing = [];
for (const tag of tagsFound) {
  if (!importedIdentifiers.has(tag) && !locallyAllowed.has(tag)) {
    missing.push(tag);
  }
}

// Specifically assert critical icons that caused outages
const criticalComponents = ["ShieldCheck", "Badge"];
for (const critical of criticalComponents) {
  if (tagsFound.has(critical) && !importedIdentifiers.has(critical)) {
    if (!missing.includes(critical)) missing.push(critical);
  }
}

if (missing.length > 0) {
  console.error(`FAIL: Found JSX components used without an import declaration: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("PASS: All JSX components in ProfileNew.tsx are properly imported and defined.");
process.exit(0);
