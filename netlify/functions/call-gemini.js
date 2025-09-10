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

    // Initialize the Generative Model.
    // Use the gemini-1.0-pro model for this kind of text-based analysis.
    const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });

    // Send the prompt to the Gemini API.
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Return the successful response from the AI.
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: text,
    };
  } catch (error) {
    // **IMPROVED ERROR HANDLING**
    // Log the full, detailed error to the Netlify function logs for debugging.
    console.error("Detailed error calling Gemini API:", error);

    // Return a more specific error message to the frontend.
    // This will help us see the exact problem in the browser's developer console.
    return {
      statusCode: 500,
      body: JSON.stringify({ 
          error: "Failed to fetch analysis from AI.",
          details: error.message || "An unknown error occurred on the server."
      }),
    };
  }
};

