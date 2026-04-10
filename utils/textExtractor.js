const fs = require('fs');
const path = require('path');

const extractTextFromFile = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const fullPath = path.join(__dirname, '..', filePath);

    if (!fs.existsSync(fullPath)) return '';

    try {
        if (ext === '.pdf') {
            const pdfParse = require('pdf-parse');
            const buffer = fs.readFileSync(fullPath);
            const data = await pdfParse(buffer);
            return data.text || '';
        }

        if (ext === '.docx') {
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ path: fullPath });
            return result.value || '';
        }

        if (['.txt', '.csv', '.md'].includes(ext)) {
            return fs.readFileSync(fullPath, 'utf8');
        }
    } catch (err) {
        console.error(`Text extraction error for ${filePath}:`, err.message);
    }

    return '';
};

const extractTextFromFiles = async (files) => {
    const texts = [];
    for (const f of files) {
        const text = await extractTextFromFile(f.path);
        if (text) texts.push(text);
    }
    return texts.join('\n\n');
};

module.exports = { extractTextFromFile, extractTextFromFiles };
