const fs = require('fs');
const { parseLocalFallback, summarizeTasks } = require('../lib/gemini');

const envText = fs.readFileSync('.env.local', 'utf8');
const match = envText.match(/GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : '';
process.env.GEMINI_API_KEY = apiKey;

// Test case 1 from user prompt
const testCase1 = `Task Update:
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
  console.log('==================================================');
  console.log('TEST 1: FULL SUMMARIZATION WITH AI & FALLBACK');
  console.log('==================================================');
  
  const result = await summarizeTasks(testCase1);
  console.log('SUMMARY RESULT:\n', JSON.stringify(result, null, 2));

  console.log('\n==================================================');
  console.log('TEST 2: LOCAL FALLBACK ENGINE TEST');
  console.log('==================================================');
  const localResult = parseLocalFallback(testCase1);
  console.log('LOCAL FALLBACK RESULT:\n', JSON.stringify(localResult, null, 2));

  // Assertions
  if (result.completed.length > 0 && result.prs.length > 0) {
    console.log('\n✅ TEST PASSED: Successfully extracted completed and PR items!');
  } else {
    console.error('\n❌ TEST FAILED: Output empty or incomplete!');
    process.exit(1);
  }
})();
