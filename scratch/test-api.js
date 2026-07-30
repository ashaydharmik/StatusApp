const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync('.env.local', 'utf8');
const match = envText.match(/GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : '';

console.log('Testing with API key starting with:', apiKey.substring(0, 8));

const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey });

const modelsToTest = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash',
];

const sampleInput = `Task Update:
1.Worked on Succession plan IDP
2. Updated mapping in Print approved letters API

Pr same as updates

Task Update:
Integrated the Save Or Update Employee Appraisal Recommendation API.
Integrated the Save Or Update EmpAppraisal Recommendation Rating Bulk API.
Implemented Update Recommendation data prefilling.
Implemented the Amend Increment flow.
Implemented the Amend Promotion flow.
In Progress:
End-to-end testing and issue fixes for the Update Recommendation flow in the Amend Increment and Amend Promotion

Task Update:
1. Integrated the onboarding tasks grid apis 
2. Updated the labels of the onboarding tasks grid 
3. Integrated the Employee Onboarding listing apis
4. Integrated the Employee Onboarding grid apis
5. Updated the mapping for Employee Onboarding grid table 

PR- employee Onboarding task UI + api`;

(async () => {
  for (const model of modelsToTest) {
    try {
      console.log(`\n--- Testing model: ${model} ---`);
      const response = await ai.models.generateContent({
        model,
        contents: `You are an expert developer task update summarizer. Output ONLY valid JSON: {"completed":["task1"],"inProgress":["task2"],"prs":["pr1"]}.\n\nText:\n${sampleInput}`,
      });
      console.log(`SUCCESS with ${model}! Response:`);
      console.log(response.text);
      return;
    } catch (err) {
      console.error(`FAILED with ${model}:`, err.message || err);
    }
  }
  console.error('\nALL MODELS FAILED!');
})();
