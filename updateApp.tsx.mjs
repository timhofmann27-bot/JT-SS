import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add import after the motion/react import
const importMotionRegex = /import \{AnimatePresence, motion\} from 'motion\/react'/;
content = content.replace(importMotionRegex, `$&\nimport {formatTime, haptic, trackMeta} from '../utils/formatters';`);

// Remove formatTime function
const formatTimeRegex = /function formatTime\(value: number\) \{[\s\S]*?\}/m;
content = content.replace(formatTimeRegex, '');

// Remove haptic function
const hapticRegex = /function haptic\(\) \{[\s\S]*?\}/m;
content = content.replace(hapticRegex, '');

// Remove trackMeta function
const trackMetaRegex = /function trackMeta\(file: ApiFile\) \{[\s\S]*?\}/m;
content = content.replace(trackMetaRegex, '');

// Remove any extra blank lines that might have been left
content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

fs.writeFileSync(filePath, content, 'utf8');

console.log('Updated App.tsx');