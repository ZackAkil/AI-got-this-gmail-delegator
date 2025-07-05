/**
 * Creates a new Gemini instance with automatic service detection.
 *
 * @param {string} model - The Gemini model to use (e.g., "gemini-2.0-flash", "gemini-2.5-flash")
 * @param {string|Object} credentials - Either an API key (string) for AI Studio or a service account object for Vertex AI
 * @returns {Gemini} A configured Gemini instance
 *
 * @example
 * // Using AI Studio API with API key
 * const gemini = BuildGemini("gemini-2.0-flash", "your-api-key-here");
 *
 * @example
 * // Using Vertex AI with service account
 * const gemini = BuildGemini("gemini-2.0-flash", SERVICE_ACCOUNT);
 */
function BuildGemini(model, credentials) {
  return new Gemini(model, credentials);
}

/**
 * Gemini class that automatically detects and uses the appropriate AI service.
 * Supports both AI Studio API (with API key) and Vertex AI (with service account).
 *
 * @class Gemini
 */
class Gemini {
  /**
   * Creates a new Gemini instance with automatic credential detection.
   *
   * @param {string} model - The Gemini model to use
   * @param {string|Object} credentials - API key (string) or service account (object)
   * @throws {Error} When credentials are invalid or missing required properties
   *
   * @example
   * // API Key for AI Studio
   * const gemini = new Gemini("gemini-2.0-flash", "your-api-key");
   *
   * @example
   * // Service Account for Vertex AI
   * const gemini = new Gemini("gemini-2.0-flash", {project_id: "my-project", ...});
   */
  constructor(model, credentials) {
    this.model = model;
    this.credentials = credentials;

    // 🕵️ Auto-detect credential type and set up appropriate service
    if (typeof credentials === "string") {
      // API key for AI Studio
      this.serviceType = "ai-studio";
      this.apiKey = credentials;
      console.log("🔑 Using AI Studio API with API key");
    } else if (typeof credentials === "object" && credentials.project_id) {
      // Service account for Vertex AI
      this.serviceType = "vertex-ai";
      this.service = getService(credentials);
      this.projectId = credentials.project_id;
      this.region = "us-central1";
      console.log("☁️ Using Vertex AI with service account");
    } else {
      throw new Error(
        "❌ Invalid credentials. Must be API key (string) or service account (object)"
      );
    }
  }

  /**
   * Generates content using the appropriate AI service based on credential type.
   *
   * @param {string} prompt - The text prompt to send to the AI model
   * @returns {string} The generated text response from the AI model
   * @throws {Error} When the API request fails or returns an error
   *
   * @example
   * const response = gemini.generate("Explain quantum computing in simple terms");
   * console.log(response); // "Quantum computing uses quantum bits..."
   */
  generate(prompt) {
    console.log(
      `🚀 Calling Gemini on ${
        this.serviceType === "ai-studio" ? "AI Studio" : "Vertex AI"
      }`
    );

    if (this.serviceType === "ai-studio") {
      return this.generateWithAIStudio(prompt);
    } else {
      return this.generateWithVertexAI(prompt);
    }
  }

  /**
   * Generates content using the AI Studio API with an API key.
   *
   * @param {string} prompt - The text prompt to send to the AI model
   * @returns {string} The generated text response
   * @throws {Error} When the API request fails or returns an error
   * @private
   */
  generateWithAIStudio(prompt) {
    console.log("🎯 Using AI Studio API endpoint");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

    const payload = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    };

    const options = {
      method: "POST",
      headers: {
        "x-goog-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    console.log("📡 Making request to AI Studio API...");
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseContent = JSON.parse(response.getContentText());

    console.log(`📊 AI Studio Response code: ${responseCode}`);

    if (responseCode !== 200) {
      console.error(
        `❌ AI Studio API error: ${JSON.stringify(responseContent)}`
      );
      throw new Error(
        `AI Studio API error: ${
          responseContent.error?.message || "Unknown error"
        }`
      );
    }

    return this.parseAIStudioResponse(responseContent);
  }

  /**
   * Generates content using the Vertex AI API with a service account.
   *
   * @param {string} prompt - The text prompt to send to the AI model
   * @returns {string} The generated text response
   * @throws {Error} When the service account lacks access or the API request fails
   * @private
   */
  generateWithVertexAI(prompt) {
    console.log("🎯 Using Vertex AI API endpoint");

    const token = this.service.getAccessToken();

    if (!this.service.hasAccess()) {
      console.error(
        "❌ Service account access error: ",
        this.service.getLastError()
      );
      return;
    }

    const url = `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.region}/publishers/google/models/${this.model}:generateContent`;

    const payload = {
      contents: {
        role: "user",
        parts: {
          text: prompt,
        },
      },
      safety_settings: {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_LOW_AND_ABOVE",
      },
      generation_config: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
      },
    };

    const options = {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
      },
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    console.log("📡 Making request to Vertex AI API...");
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseContent = JSON.parse(response.getContentText());

    console.log(`📊 Vertex AI Response code: ${responseCode}`);
    return this.parseVertexAIResponse(responseContent);
  }

  /**
   * Parses the response from the AI Studio API.
   *
   * @param {Object} response - The raw response object from AI Studio API
   * @returns {string} The extracted text content from the response
   * @throws {Error} When the response format is unexpected or invalid
   * @private
   */
  parseAIStudioResponse(response) {
    console.log("🔍 Parsing AI Studio response");
    if (
      response.candidates &&
      response.candidates[0] &&
      response.candidates[0].content
    ) {
      return response.candidates[0].content.parts[0].text.trim();
    } else {
      console.error(
        "❌ Unexpected AI Studio response format:",
        JSON.stringify(response)
      );
      throw new Error("Invalid AI Studio response format");
    }
  }

  /**
   * Parses the response from the Vertex AI API.
   *
   * @param {Object} response - The raw response object from Vertex AI API
   * @returns {string} The extracted text content from the response
   * @private
   */
  parseVertexAIResponse(response) {
    console.log("🔍 Parsing Vertex AI response");
    return response.candidates[0].content.parts[0].text.trim();
  }
}
