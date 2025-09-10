// This file acts as a secure backend intermediary for the Gemini API.
// It receives a prompt from the frontend, adds the necessary API key,
// and forwards the request to the Google Generative Language API.

// Import the GoogleGenerativeAI library.
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access your API key from environment variables for security.
// You must set this in your Netlify project settings.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.handler = async function (event, context) {
  // Only allow POST requests.
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // Parse the incoming request body to get the prompt.
    const { prompt } = JSON.parse(event.body);

    if (!prompt) {
      return { statusCode: 400, body: "Bad Request: Prompt is missing." };
    }

    // Use the 'latest' version for potential speed improvements and add a generationConfig.
    // Explicitly requesting JSON output makes the model faster and more reliable.
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      generationConfig: {
        // **FIX**: Corrected parameter name from responseMimeType to response_mime_type.
        response_mime_type: "application/json",
      },
    });

    // Send the prompt to the Gemini API.
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // The model is now configured to return a raw JSON string.
    // We can pass this directly to the frontend.
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: text, // The body is now a clean JSON string.
    };
  } catch (error) {
    // Log the full, detailed error to the Netlify function logs for debugging.
    console.error("Detailed error calling Gemini API:", error);

    // Return a more specific error message to the frontend.
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to fetch analysis from AI.",
        details: error.message || "An unknown error occurred on the server.",
      }),
    };
  }
};

