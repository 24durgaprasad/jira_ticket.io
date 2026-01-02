// Import required packages
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { createWorker } from 'tesseract.js'; // local OCR, no API key needed
// Using Perplexity's chat completion API

// --- Basic Setup ---
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5001;

// --- Multer Setup ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- OCR Helpers (Tesseract, no external keys) ---
let tesseractWorkerPromise;

async function getTesseractWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      const worker = await createWorker('eng');
      return worker;
    })();
  }
  return tesseractWorkerPromise;
}

async function extractTextFromImage(buffer) {
  const worker = await getTesseractWorker();
  const { data } = await worker.recognize(buffer);
  const text = data?.text ? data.text.trim() : '';
  if (!text) {
    throw new Error('OCR produced no text from image.');
  }
  return text;
}

// --- Atlassian Document Format (ADF) helpers ---
function toADF(text) {
  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: text || "" }],
      },
    ],
  };
}

// --- Jira Helpers ---
const EPIC_NAME_FIELD_ID = process.env.JIRA_EPIC_NAME_FIELD_ID || "customfield_10011";
const EPIC_LINK_FIELD_ID = process.env.JIRA_EPIC_LINK_FIELD_ID || "customfield_10014";
const EPIC_ISSUE_TYPE_NAME = process.env.JIRA_EPIC_ISSUETYPE_NAME || "Epic";
const STORY_ISSUE_TYPE_NAME = process.env.JIRA_STORY_ISSUETYPE_NAME || "Story";

function buildJiraAuthHeader(email, apiToken) {
  const token = Buffer.from(`${email}:${apiToken}`).toString("base64");
  return `Basic ${token}`;
}

async function createJiraIssue({ jiraUrl, authHeader, fields }) {
  const endpoint = new URL('/rest/api/3/issue', jiraUrl).toString();
  console.log('[Jira] Creating issue at', endpoint);
  console.log('[Jira] Payload (fields keys):', Object.keys(fields));
  if (fields.summary) console.log('[Jira] summary:', fields.summary);
  if (fields.issuetype?.name) console.log('[Jira] issuetype:', fields.issuetype.name);
  if (fields.project?.key) console.log('[Jira] project:', fields.project.key);
  if (fields[EPIC_NAME_FIELD_ID]) console.log('[Jira] epic name field set:', EPIC_NAME_FIELD_ID);
  if (fields[EPIC_LINK_FIELD_ID]) console.log('[Jira] epic link field set:', EPIC_LINK_FIELD_ID);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Jira] Request failed', response.status, response.statusText, errorText);
    throw new Error(
      `Jira create issue failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return response.json();
}

async function linkJiraIssues({ jiraUrl, authHeader, inwardIssue, outwardIssue, linkType = 'Relates' }) {
  const endpoint = new URL('/rest/api/3/issueLink', jiraUrl).toString();
  
  const body = {
    type: { name: linkType },
    inwardIssue: { key: inwardIssue },
    outwardIssue: { key: outwardIssue }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.warn(`[Jira] Failed to link issues ${inwardIssue} <-> ${outwardIssue}:`, response.status, errorText);
    // Don't throw - linking is optional
    return false;
  }

  return true;
}

// --- AI Helper Function ---
// This function takes the raw text and asks Perplexity to structure it.
async function runAIAnalysis(requirementsText) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing PERPLEXITY_API_KEY in environment.");
  }

  const systemPrompt =
    process.env.SYSTEM_PROMPT ||
    "You are a helpful assistant that converts plain requirements into JSON epics and stories.";

  const body = {
    // Perplexity model; defaults to supported "sonar-pro" if not provided
    model: process.env.PERPLEXITY_MODEL || "sonar-pro",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Here are the raw requirements:\n\n${requirementsText}\n\nReturn only JSON.`,
      },
    ],
  };

  const endpoint = "https://api.perplexity.ai/chat/completions";
  console.log("--- Sending prompt to AI (Perplexity)... ---");

  const fetchWithTimeout = async (timeoutMs) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  const attempts = Number(process.env.PERPLEXITY_RETRIES || 2);
  const timeoutMs = Number(process.env.PERPLEXITY_TIMEOUT_MS || 20000);
  let response;
  let lastError;

  for (let i = 0; i <= attempts; i++) {
    try {
      response = await fetchWithTimeout(timeoutMs);
      break;
    } catch (err) {
      lastError = err;
      if (i === attempts) {
        throw new Error(`Perplexity request failed after retries: ${err.message}`);
      }
      console.warn(`Perplexity attempt ${i + 1} failed, retrying...`, err.message);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Perplexity API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Perplexity response missing content.");
  }

  // Try to robustly extract JSON even if model adds fences or pre/post text
  const cleanedText = text
    .replace(/^```[a-zA-Z]*\s*/, "")
    .replace(/```$/, "")
    .trim();

  const attemptParse = (payload) => {
    const start = payload.indexOf("{");
    const end = payload.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(payload.slice(start, end + 1));
    }
    return JSON.parse(payload);
  };

  try {
    return attemptParse(cleanedText);
  } catch (e) {
    console.error("Failed to parse AI response as JSON:", text);
    throw new Error(`AI response was not valid JSON. Raw response: ${text}`);
  }
}

// --- Routes ---
app.post('/api/generate-tickets', upload.single('requirementsFile'), async (req, res) => { // <-- async now
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const isImage = req.file.mimetype && req.file.mimetype.startsWith('image/');
    let requirementsText;

    if (isImage) {
      console.log('--- Detected image upload, running OCR ---');
      try {
        requirementsText = await extractTextFromImage(req.file.buffer);
      } catch (err) {
        console.error('OCR failed:', err);
        return res.status(400).json({
          message: 'Could not extract text from image (OCR). Please upload a clearer image or a text file.',
          error: err.message,
        });
      }
    } else {
      requirementsText = req.file.buffer.toString('utf8');
    }
    const { jiraUrl, projectKey, apiToken, email } = req.body;
    console.log('[Request] jiraUrl:', jiraUrl);
    console.log('[Request] projectKey:', projectKey);
    console.log('[Request] email:', email);
    console.log('[Request] Using epic name field:', EPIC_NAME_FIELD_ID || 'none');
    console.log('[Request] Using epic link field:', EPIC_LINK_FIELD_ID || 'none');
    console.log('[Request] Using epic issuetype name:', EPIC_ISSUE_TYPE_NAME);
    console.log('[Request] Using story issuetype name:', STORY_ISSUE_TYPE_NAME);

    if (!jiraUrl || !projectKey || !apiToken || !email) {
      return res.status(400).json({ message: 'Missing Jira credentials or project info.' });
    }

    const normalizedJiraUrl = jiraUrl.startsWith('http') ? jiraUrl : `https://${jiraUrl}`;
    try {
      // Validate URL early to avoid silent bad hosts
      new URL(normalizedJiraUrl);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid Jira URL.' });
    }
    const jiraAuth = buildJiraAuthHeader(email, apiToken);

    console.log('\n--- 1. File Received ---');
    // console.log(fileContent); // Optional: comment out to keep logs cleaner

    // --- Step 2: Call the AI ---
    console.log('\n--- 2. Starting AI Analysis ---');
    const structuredData = await runAIAnalysis(requirementsText);

    // --- LOGGING THE PARTITIONS (Epics, Stories) ---
    console.log('\n--- 3. AI Analysis Complete - Partitions Found ---');
    if (structuredData.epics && Array.isArray(structuredData.epics)) {
        console.log(`Found ${structuredData.epics.length} Epics:`);
        structuredData.epics.forEach((epic, i) => {
            console.log(`  [Epic ${i+1}] ${epic.summary}`);
            if (epic.stories && Array.isArray(epic.stories)) {
                console.log(`    -> Contains ${epic.stories.length} Stories`);
                // Optional: Log a few story names to verify
                // epic.stories.forEach(story => console.log(`       - Story: ${story.summary}`));
            }
        });
    } else {
        console.log("WARNING: No 'epics' array found in AI response.");
    }

    // --- Step 3: Create Jira issues in real time ---
    const creationResults = [];

    // Create a parent epic for this upload to group all epics from this specific upload
    const uploadTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const parentEpicSummary = `Requirements Upload - ${uploadTimestamp}`;
    const parentEpicDescription = `Parent epic grouping all epics and stories generated from requirements document uploaded on ${new Date().toLocaleString()}.`;

    const parentEpicFields = {
      project: { key: projectKey },
      summary: parentEpicSummary,
      description: toADF(parentEpicDescription),
      issuetype: { name: EPIC_ISSUE_TYPE_NAME },
      labels: [`upload-${uploadTimestamp}`], // Label to group all issues from this upload
    };

    if (EPIC_NAME_FIELD_ID && EPIC_NAME_FIELD_ID !== 'skip') {
      parentEpicFields[EPIC_NAME_FIELD_ID] = parentEpicSummary;
    }

    let parentEpicKey = null;
    try {
      const parentEpicIssue = await createJiraIssue({
        jiraUrl: normalizedJiraUrl,
        authHeader: jiraAuth,
        fields: parentEpicFields,
      });
      parentEpicKey = parentEpicIssue.key;
      console.log(`[Jira] Created parent epic: ${parentEpicKey} - ${parentEpicSummary}`);
    } catch (err) {
      console.warn('[Jira] Failed to create parent epic, continuing without it:', err.message);
    }

    if (structuredData.epics && Array.isArray(structuredData.epics)) {
      for (const epic of structuredData.epics) {
        const epicSummary = epic.summary || 'Epic';
        const epicDescription = epic.description || '';

        // Create Epic
        const epicFields = {
          project: { key: projectKey },
          summary: epicSummary,
          description: toADF(epicDescription),
          issuetype: { name: EPIC_ISSUE_TYPE_NAME },
          labels: [`upload-${uploadTimestamp}`], // Label to group epics from same upload
        };
        // Epic Name field (required for many company-managed projects). If your project does not
        // require it, or uses a different field id, set JIRA_EPIC_NAME_FIELD_ID in .env or leave empty.
        if (EPIC_NAME_FIELD_ID && EPIC_NAME_FIELD_ID !== 'skip') {
          epicFields[EPIC_NAME_FIELD_ID] = epicSummary;
        }

        const epicIssue = await createJiraIssue({
          jiraUrl: normalizedJiraUrl,
          authHeader: jiraAuth,
          fields: epicFields,
        });

        const epicKey = epicIssue.key;

        // Link this epic to the parent epic if parent was created
        if (parentEpicKey) {
          await linkJiraIssues({
            jiraUrl: normalizedJiraUrl,
            authHeader: jiraAuth,
            inwardIssue: parentEpicKey,
            outwardIssue: epicKey,
            linkType: 'Relates'
          });
        }
        const storiesCreated = [];

        if (epic.stories && Array.isArray(epic.stories)) {
          for (const story of epic.stories) {
            const storyFields = {
              project: { key: projectKey },
              summary: story.summary || 'Story',
              description: toADF(story.description || ''),
              issuetype: { name: STORY_ISSUE_TYPE_NAME },
            };

            // Link story to epic (company-managed default field). Skip if unset/skip.
            if (EPIC_LINK_FIELD_ID && EPIC_LINK_FIELD_ID !== 'skip') {
              storyFields[EPIC_LINK_FIELD_ID] = epicKey;
            }

            const storyIssue = await createJiraIssue({
              jiraUrl: normalizedJiraUrl,
              authHeader: jiraAuth,
              fields: storyFields,
            });
            storiesCreated.push(storyIssue.key);
          }
        }

        creationResults.push({
          epicKey,
          stories: storiesCreated,
        });
      }
    }

    // --- Final Response to Client ---
    res.status(200).json({
      message: 'Requirements analyzed and Jira issues created successfully!',
      stats: {
        epics: structuredData.epics ? structuredData.epics.length : 0,
        parentEpic: parentEpicKey,
        uploadLabel: `upload-${uploadTimestamp}`,
      },
      aiOutput: structuredData,
      jira: {
        parentEpic: parentEpicKey,
        childEpics: creationResults,
      },
      notes: {
        epicNameField: EPIC_NAME_FIELD_ID || null,
        epicLinkField: EPIC_LINK_FIELD_ID || null,
        uploadTimestamp: uploadTimestamp,
      },
    });

  } catch (error) {
    console.error('Error in /api/generate-tickets:', error);
    // If the AI couldn't return JSON, surface a clearer 400 to the client
    if (error.message && error.message.startsWith('AI response was not valid JSON')) {
      return res.status(400).json({
        message: 'AI response was not valid JSON. Ensure the uploaded file contains plain text requirements.',
        error: error.message,
      });
    }
    res.status(500).json({ message: 'Server error during analysis', error: error.message });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});