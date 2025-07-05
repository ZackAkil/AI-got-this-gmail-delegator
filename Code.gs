/**
 * (A)I Got This! AI Email Assistant : Automated Email Processing with Gemini AI
 * ================================================================
 *
 * This Google Apps Script automatically processes incoming emails using Google's Gemini AI.
 * It analyzes emails, determines if they need responses, and either generates AI drafts,
 * marks them for manual review, or flags them as not needing replies.
 *
 * 🚀 Features:
 * - Automatic email analysis using Gemini AI (supports both AI Studio API and Vertex AI)
 * - Smart decision making: draft replies, manual review, or no reply needed
 * - Gmail label management with automatic cleanup to prevent label buildup
 * - Comprehensive logging to Google Sheets for tracking and analytics
 * - Customizable writing style and knowledge base from Google Docs
 * - Error handling and retry logic for robust operation
 *
 * 🔧 Setup Requirements:
 * - Google Doc with knowledge base/context (set CONTEXT_DOC_ID)
 * - Google Sheet for logging (set LOGGING_SHEET_ID)
 * - Gmail labels: "🆕 New-Email", "🤖 AI-Drafted", "✍️ Needs-Manual-Reply", "⛔️ No-Reply-Needed"
 * - Gemini API credentials (API key for AI Studio or service account for Vertex AI)
 *
 * 📋 How It Works:
 * 1. Monitors Gmail for emails with "🆕 New-Email" label
 * 2. Analyzes each email using Gemini AI and your knowledge base
 * 3. Makes intelligent decisions about response requirements
 * 4. Applies appropriate labels and takes action (draft, manual review, or no reply)
 * 5. Logs all decisions and actions to Google Sheets
 *
 * 🎯 Usage:
 * - Run processNewEmails() to process all new emails
 * - Run testGemini() to test the AI integration
 * - Set up a trigger to run processNewEmails() periodically
 *
 * @author Zack Akil
 * @version 1.0.0
 * @lastUpdated 5 July 2025
 */

/**
 * The unique ID of your Google Doc containing the knowledge base/context.
 * Find this in the URL of your Google Doc.
 */
const CONTEXT_DOC_ID = "1D4agJcDptZy0_WxRgKtq-PsRSuIhPKnbqQ5t0";

/**
 * Your personal writing style. Be descriptive.
 * Gemini will use this to generate the draft.
 * Example: "Friendly and professional, but not overly formal. Use emojis where appropriate.
 * Start with a warm greeting like 'Hi [Name],' and end with 'Best regards, [Your Name]'."
 */
const MY_WRITING_STYLE = `
Write in a clear, concise, and helpful tone. 
Be professional and friendly. 
Sign off with "Cheers, 
Zack".`;

/**
 * Google Sheet ID for logging email processing results.
 * Create a new Google Sheet and copy its ID from the URL.
 * The sheet should have columns: Timestamp, Email Link, Subject, Sender, Label, Reasoning, Thread ID
 */
const LOGGING_SHEET_ID = "1XophC3voJ6DO6yU6BULMGhTROurcbcKk"; // Replace with your actual sheet ID

// --- Gmail Label Names (change if you use different names) ---
const NEW_EMAIL_LABEL_NAME = "🆕 New-Email";
const DRAFTED_LABEL_NAME = "🤖 AI-Drafted";
const MANUAL_REPLY_LABEL_NAME = "✍️ Needs-Manual-Reply";
const NO_REPLY_NEEDED_LABEL_NAME = "⛔️ No-Reply-Needed";

// --- AI Model Configuration ---
const GEMINI_MODEL = "gemini-2.0-flash";

// ===============================================================
//         END OF CONFIGURATION - DO NOT EDIT BELOW THIS LINE
// ===============================================================

// Initialize the Gemini client using the library
const gemini = BuildGemini(GEMINI_MODEL, CREDENTIALS);

// --- Cache for lazy loading ---
let cachedContext = null;
let cachedSheet = null;
let cachedLabels = {};

/**
 * Main function to be triggered periodically.
 * It finds emails labeled "New Email", analyzes them, and takes action.
 */
function processNewEmails() {
  Logger.log("🚀 Starting email processing workflow...");

  // 1. Quick check - are there any emails to process?
  const newEmailLabel = GmailApp.getUserLabelByName(NEW_EMAIL_LABEL_NAME);
  if (!newEmailLabel) {
    Logger.log(
      `❌ Label "${NEW_EMAIL_LABEL_NAME}" does not exist. Please create it in Gmail.`
    );
    return;
  }

  const threads = newEmailLabel.getThreads();
  if (threads.length === 0) {
    Logger.log("😴 No new emails to process. Taking a nap... 💤");
    return;
  }

  Logger.log(
    `📧 Found ${threads.length} threads to process. Time to get busy! 🎯`
  );

  // 2. Only load context and initialize sheet if we actually have emails to process
  const context = getCachedContext();
  if (!context) {
    console.error("❌ Could not retrieve context from Google Doc. Aborting.");
    return;
  }
  Logger.log(`✅ Successfully loaded ${context.length} characters of context.`);

  // 3. Initialize logging sheet (lazy load)
  initializeLoggingSheet();

  // 4. Get or create labels (cached)
  const draftedLabel = getCachedLabel(DRAFTED_LABEL_NAME);
  const manualLabel = getCachedLabel(MANUAL_REPLY_LABEL_NAME);
  const noReplyLabel = getCachedLabel(NO_REPLY_NEEDED_LABEL_NAME);

  // 5. Process each thread with the "New Email" label
  for (const thread of threads) {
    try {
      const message = thread.getMessages()[thread.getMessageCount() - 1]; // Get the last message
      const subject = message.getSubject();
      const sender = message.getFrom();
      const body = message.getPlainBody();

      Logger.log(
        `🔍 Analyzing email from: ${sender} with subject: "${subject}"`
      );

      // 6. Clean up any existing process-related labels before analysis
      cleanupProcessLabels(thread, [draftedLabel, manualLabel, noReplyLabel]);
      Logger.log("🧹 Cleaned up any existing process labels");

      // 7. Analyze with Gemini and decide on an action
      const aiResponse = analyzeEmailWithAI(subject, sender, body, context);

      // 8. Take action based on the AI's analysis
      if (aiResponse && aiResponse.isAnswerable) {
        Logger.log(
          `✅ Email is answerable. Generating draft for thread: ${thread.getId()}`
        );
        createDraftReply(thread, message, aiResponse.draft);
        thread.addLabel(draftedLabel);
        Logger.log("🏷️ Applied 'AI-Drafted' label.");
        logEmailProcessing(
          message,
          DRAFTED_LABEL_NAME,
          aiResponse.reasoning,
          thread
        );
      } else if (aiResponse && aiResponse.noReplyNeeded) {
        Logger.log(
          `⛔️ Email doesn't require a response. Reason: ${aiResponse.reasoning}`
        );
        thread.addLabel(noReplyLabel);
        Logger.log("🏷️ Applied 'No-Reply-Needed' label.");
        logEmailProcessing(
          message,
          NO_REPLY_NEEDED_LABEL_NAME,
          aiResponse.reasoning,
          thread
        );
      } else {
        Logger.log(
          `✍️ Email requires manual review. Reason: ${
            aiResponse ? aiResponse.reasoning : "AI analysis failed"
          }`
        );
        thread.addLabel(manualLabel);
        Logger.log("🏷️ Applied 'Needs-Manual-Reply' label.");
        logEmailProcessing(
          message,
          MANUAL_REPLY_LABEL_NAME,
          aiResponse ? aiResponse.reasoning : "AI analysis failed",
          thread
        );
      }

      // 9. Clean up by removing the "New Email" label
      thread.removeLabel(newEmailLabel);
      Logger.log(`🧹 Removed "${NEW_EMAIL_LABEL_NAME}" label from thread.`);
    } catch (e) {
      console.error(
        `❌ An error occurred while processing thread ${thread.getId()}: ${e.toString()}`
      );
      // Log the error to the sheet as well
      try {
        logEmailProcessing(
          message,
          "ERROR",
          `Processing failed: ${e.toString()}`,
          thread
        );
      } catch (logError) {
        console.error(`❌ Failed to log error: ${logError.toString()}`);
      }
    }
  }
  Logger.log("🎉 Email processing workflow finished.");

  // // Generate summary report
  // generateProcessingSummary();
}

/**
 * Gets cached context, loading it only if not already cached.
 * @returns {string} The context content.
 */
function getCachedContext() {
  if (cachedContext === null) {
    Logger.log("📚 Loading context from Google Doc (first time)...");
    cachedContext = getDocContent(CONTEXT_DOC_ID);
  }
  return cachedContext;
}

/**
 * Gets a cached Gmail label, creating it if it doesn't exist.
 * @param {string} labelName The name of the label.
 * @returns {GoogleAppsScript.Gmail.GmailLabel} The label object.
 */
function getCachedLabel(labelName) {
  if (!cachedLabels[labelName]) {
    Logger.log(`🏷️ Getting/creating label: "${labelName}"`);
    cachedLabels[labelName] = getOrCreateLabel(labelName);
  }
  return cachedLabels[labelName];
}

/**
 * Analyzes an email using Gemini and a structured prompt.
 * @param {string} subject The email subject.
 * @param {string} sender The email sender.
 * @param {string} body The plain text body of the email.
 * @param {string} context The knowledge base from the Google Doc.
 * @returns {object|null} A parsed JSON object with the AI's decision or null on error.
 */
function analyzeEmailWithAI(subject, sender, body, context) {
  const prompt = `
    You are an expert AI email assistant. Your task is to analyze an incoming email and determine if you can confidently answer it using ONLY the provided context.

    **My Writing Style:**
    ${MY_WRITING_STYLE}

    **Context / Knowledge Base:**
    ---
    ${context}
    ---

    **Incoming Email:**
    - From: ${sender}
    - Subject: ${subject}
    - Body:
    ${body}

    **Your Task:**
    1. Read the email carefully.
    2. Determine if the email requires any response at all:
       - If it's a product announcement, newsletter, confirmation, spam, or general broadcast that doesn't need a reply, mark it as "no reply needed"
       - If it asks a question or requires action that you can answer with the provided context, mark it as "answerable"
       - If it requires a response but you don't have enough information in the context, mark it as "needs manual reply"
    3. For answerable emails, generate a helpful draft reply in my specified writing style.
    4. Do not use any external knowledge beyond the provided context.

    **Respond with a valid JSON object in the following format and nothing else:**
    {
      "isAnswerable": boolean,
      "noReplyNeeded": boolean,
      "reasoning": "A brief explanation of your decision.",
      "draft": "The full text of the draft email if answerable, otherwise an empty string."
    }
  `;

  try {
    const geminiResponse = gemini.generate(prompt);
    // Clean the response to ensure it's valid JSON
    const cleanResponse = geminiResponse
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleanResponse);
  } catch (e) {
    console.error(`Error parsing Gemini response: ${e.toString()}`);
    return null;
  }
}

/**
 * Creates a draft reply within the specified email thread.
 * @param {GoogleAppsScript.Gmail.GmailThread} thread The thread to reply in.
 * @param {GoogleAppsScript.Gmail.GmailMessage} originalMessage The message to reply to.
 * @param {string} draftBody The content of the draft.
 */
function createDraftReply(thread, originalMessage, draftBody) {
  // Convert plain text newlines to HTML <br> tags for proper formatting in Gmail
  const htmlBody = draftBody.replace(/\n/g, "<br>");

  thread.createDraftReply("", {
    htmlBody: htmlBody,
  });
}

/**
 * Retrieves the text content from a Google Doc.
 * @param {string} docId The ID of the Google Document.
 * @returns {string} The text content of the document.
 */
function getDocContent(docId) {
  try {
    const doc = DocumentApp.openById(docId);
    return doc.getBody().getText();
  } catch (e) {
    console.error(
      `Failed to read Google Doc with ID ${docId}. Error: ${e.toString()}`
    );
    return "";
  }
}

/**
 * Gets a Gmail label by name, creating it if it doesn't exist.
 * @param {string} labelName The name of the label.
 * @returns {GoogleAppsScript.Gmail.GmailLabel} The label object.
 */
function getOrCreateLabel(labelName) {
  let label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    Logger.log(`Label "${labelName}" not found. Creating it...`);
    label = GmailApp.createLabel(labelName);
  }
  return label;
}

/**
 * Removes all process-related labels from a thread to prevent label buildup.
 * This ensures clean state before applying new decision labels.
 *
 * @param {GoogleAppsScript.Gmail.GmailThread} thread The email thread to clean up
 * @param {Array<GoogleAppsScript.Gmail.GmailLabel>} processLabels Array of process-related labels to remove
 */
function cleanupProcessLabels(thread, processLabels) {
  try {
    let removedCount = 0;

    // Remove each process-related label if it exists on the thread
    processLabels.forEach((label) => {
      if (label && thread.hasLabel(label)) {
        thread.removeLabel(label);
        removedCount++;
        console.log(`🧹 Removed process label: ${label.getName()}`);
      }
    });

    if (removedCount > 0) {
      console.log(
        `🧹 Cleaned up ${removedCount} process labels from thread ${thread.getId()}`
      );
    }
  } catch (e) {
    console.error(`❌ Error cleaning up process labels: ${e.toString()}`);
  }
}

/**
 * Initializes the logging sheet with headers if it doesn't exist.
 * Uses lazy loading to only open the sheet when needed.
 * Call this function once to set up the sheet structure.
 */
function initializeLoggingSheet() {
  try {
    if (cachedSheet === null) {
      Logger.log("📊 Opening logging sheet (first time)...");
      cachedSheet = SpreadsheetApp.openById(LOGGING_SHEET_ID).getActiveSheet();
    }

    const sheet = cachedSheet;
    const headers = [
      "Timestamp",
      "Email Link",
      "Subject",
      "Sender",
      "Label Applied",
      "Reasoning",
      "Thread ID",
      "Message ID",
    ];

    // Check if headers already exist
    const existingHeaders = sheet
      .getRange(1, 1, 1, headers.length)
      .getValues()[0];
    if (existingHeaders.join("") === "") {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      Logger.log("📊 Logging sheet headers initialized successfully!");
    } else {
      Logger.log("📊 Logging sheet already has headers.");
    }
  } catch (e) {
    console.error(`❌ Error initializing logging sheet: ${e.toString()}`);
  }
}

/**
 * Logs email processing results to the Google Sheet.
 * Uses cached sheet for better performance.
 * @param {GoogleAppsScript.Gmail.GmailMessage} message The email message.
 * @param {string} labelApplied The label that was applied to the email.
 * @param {string} reasoning The AI's reasoning for the decision.
 * @param {GoogleAppsScript.Gmail.GmailThread} thread The email thread.
 */
function logEmailProcessing(message, labelApplied, reasoning, thread) {
  try {
    // Ensure sheet is initialized and cached
    if (cachedSheet === null) {
      initializeLoggingSheet();
    }

    const sheet = cachedSheet;

    // Create Gmail link
    const threadId = thread.getId();
    const messageId = message.getId();
    const gmailLink = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;

    // Prepare row data
    const rowData = [
      new Date(), // Timestamp
      gmailLink, // Email Link
      message.getSubject() || "(No Subject)", // Subject
      message.getFrom(), // Sender
      labelApplied, // Label Applied
      reasoning || "No reasoning provided", // Reasoning
      threadId, // Thread ID
      messageId, // Message ID
    ];

    // Add row to sheet
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, 1, rowData.length).setValues([rowData]);

    // Auto-resize columns for better readability
    sheet.autoResizeColumns(1, rowData.length);

    Logger.log(
      `📝 Logged email processing: ${message.getSubject()} -> ${labelApplied}`
    );
  } catch (e) {
    console.error(`❌ Error logging email processing: ${e.toString()}`);
  }
}

/**
 * Generates a summary report of the current processing session.
 * Uses cached sheet for better performance.
 * This function can be called to get statistics about processed emails.
 */
function generateProcessingSummary() {
  try {
    // Ensure sheet is initialized and cached
    if (cachedSheet === null) {
      initializeLoggingSheet();
    }

    const sheet = cachedSheet;
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      Logger.log("📊 No emails processed in this session.");
      return;
    }

    // Get today's entries
    const today = new Date();
    const todayStr = today.toDateString();
    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues(); // Timestamp, Link, Subject, Sender, Label

    const todayEntries = data.filter((row) => {
      const rowDate = new Date(row[0]);
      return rowDate.toDateString() === todayStr;
    });

    if (todayEntries.length === 0) {
      Logger.log("📊 No emails processed today.");
      return;
    }

    // Count by label
    const labelCounts = {};
    todayEntries.forEach((row) => {
      const label = row[4]; // Label column
      labelCounts[label] = (labelCounts[label] || 0) + 1;
    });

    // Log summary
    Logger.log(`📊 Processing Summary for ${todayStr}:`);
    Logger.log(`📧 Total emails processed: ${todayEntries.length}`);
    Object.entries(labelCounts).forEach(([label, count]) => {
      Logger.log(`   ${label}: ${count}`);
    });
  } catch (e) {
    console.error(`❌ Error generating summary: ${e.toString()}`);
  }
}

/**
 * Simple test function to verify Gemini integration is working.
 * Sends a "hello" message to Gemini and logs the response.
 *
 * @returns {string} The response from Gemini
 */
function testGemini() {
  try {
    console.log("🧪 Testing Gemini integration...");
    console.log("🤖 Sending 'hello' to Gemini...");

    const response = gemini.generate(
      "Hello! Please respond with a friendly greeting and tell me what you can do."
    );

    console.log("✅ Gemini responded successfully!");
    console.log("📝 Response:", response);

    return response;
  } catch (e) {
    console.error("❌ Gemini test failed:", e.toString());
    throw e;
  }
}
