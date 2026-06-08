const fs = require('fs');
const path = require('path');

const extractTextFromFile = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const fullPath = path.join(__dirname, '..', filePath);

    if (!fs.existsSync(fullPath)) return '';

    try {
        if (ext === '.pdf') {
            // pdf-parse needs canvas rendering elements defined globally on newer Node.js versions
            if (!globalThis.DOMMatrix) globalThis.DOMMatrix = class {};
            if (!globalThis.ImageData) globalThis.ImageData = class {};
            if (!globalThis.Path2D) globalThis.Path2D = class {};

            const pdfParse = require('pdf-parse');
            const buffer = fs.readFileSync(fullPath);
            
            let data;
            if (typeof pdfParse === 'function') {
                data = await pdfParse(buffer);
            } else if (pdfParse && typeof pdfParse.PDFParse === 'function') {
                // Handle different pdf-parse packaging layouts
                const uint8 = new Uint8Array(buffer);
                const instance = new pdfParse.PDFParse(uint8);
                data = await instance.getText();
            }

            if (data) {
                return typeof data === 'string' ? data : (data.text || '');
            }
            return '';
        }

        if (ext === '.docx') {
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ path: fullPath });
            return result.value || '';
        }

        if (ext === '.doc') {
            const WordExtractor = require('word-extractor');
            const extractor = new WordExtractor();
            const extracted = await extractor.extract(fullPath);
            return extracted.getBody() || '';
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
