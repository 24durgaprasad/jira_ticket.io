// Import required packages
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai'; // <-- NEW IMPORT

// --- Basic Setup ---
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5001;

// --- Google AI Setup ---
// Initialize the Google AI client with your API key from .env
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// --- Multer Setup ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- AI Helper Function ---
// This function takes the raw text and asks Gemini to structure it.
async function runAIAnalysis(requirementsText) {
  // Use the 'gemini-pro' model which is good for text tasks
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // The prompt is the most important part. It tells the AI exactly what to do.
  const prompt = process.env.SYSTEM_PROMPT

  console.log("--- Sending prompt to AI... ---");
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  console.log("--- AI response received ---");

  // Clean up the response in case Gemini adds markdown formatting
  const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
  
  try {
      return JSON.parse(cleanedText);
  } catch (e) {
      console.error("Failed to parse AI response as JSON:", text);
      throw new Error("AI response was not valid JSON.");
  }
}

// --- Routes ---
app.post('/api/generate-tickets', upload.single('requirementsFile'), async (req, res) => { // <-- async now
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const fileContent = req.file.buffer.toString('utf8');
    // We're not using these yet, but we're still receiving them for later
    const { jiraUrl, projectKey, apiToken } = req.body;

    console.log('\n--- 1. File Received ---');
    // console.log(fileContent); // Optional: comment out to keep logs cleaner

    // --- Step 2: Call the AI ---
    console.log('\n--- 2. Starting AI Analysis ---');
    const structuredData = await runAIAnalysis(fileContent);

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

    // --- Final Response to Client ---
    res.status(200).json({
      message: 'Requirements analyzed successfully!',
      stats: {
        epics: structuredData.epics ? structuredData.epics.length : 0,
      },
      // We send the full structured data back so you can see it in Postman
      aiOutput: structuredData 
    });

  } catch (error) {
    console.error('Error in /api/generate-tickets:', error);
    res.status(500).json({ message: 'Server error during analysis', error: error.message });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});