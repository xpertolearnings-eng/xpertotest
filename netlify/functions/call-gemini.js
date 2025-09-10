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

    // **FIX**: Removed the 'generationConfig' object entirely. The API version
    // being used does not support the 'response_mime_type' parameter, which was
    // causing the 400 Bad Request error. We will now rely solely on prompt
    // engineering to ensure the AI returns valid JSON.
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    // Send the prompt to the Gemini API.
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // The frontend's 'parseGeminiResponse' function will handle cleaning this text.
    return {
      statusCode: 200,
      headers: {
        // The content type is text/plain because the AI might include markdown.
        "Content-Type": "text/plain",
      },
      body: text,
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

