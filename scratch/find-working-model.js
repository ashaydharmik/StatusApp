const fs = require('fs');
const envText = fs.readFileSync('.env.local', 'utf8');
const match = envText.match(/GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : '';

const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey });

const candidates = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
  'gemini-2.0-flash-lite-001',
  'gemini-2.0-flash-001',
];

(async () => {
  for (const model of candidates) {
    try {
      console.log('Testing model:', model);
      const res = await ai.models.generateContent({
        model,
        contents: 'Hi, return simple JSON {"status":"ok"}'
      });
      console.log('SUCCESS with model:', model, '->', res.text.trim());
    } catch (err) {
      console.error('FAILED with model:', model, '->', err.status || err.message?.substring(0, 150));
    }
  }
})();
