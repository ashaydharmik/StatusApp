const fs = require('fs');
const envText = fs.readFileSync('.env.local', 'utf8');
const match = envText.match(/GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : '';

const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey });

(async () => {
  try {
    console.log('Listing available models for API key...');
    const list = await ai.models.list();
    for await (const m of list) {
      console.log('Model:', m.name, '-> supportedMethods:', m.supportedGenerationMethods);
    }
  } catch (err) {
    console.error('List models failed:', err.message || err);
  }
})();
