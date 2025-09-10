// netlify/functions/call-gemini.js

// The 'node-fetch' import has been removed.
// Netlify functions run on Node.js 18+, which has fetch built-in globally.

exports.handler = async function(event) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { prompt } = JSON.parse(event.body);
        const apiKey = process.env.GEMINI_API_KEY;

        // Ensure the API key is available
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set in Netlify environment variables.');
        }
        
        // Use a v1beta model that supports JSON mode for structured output
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                // Crucial for forcing the model to output valid JSON
                response_mime_type: "application/json",
            },
        };

        // We can now use the native 'fetch' provided by the environment
        const geminiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        // Handle errors from the Gemini API
        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error('Gemini API Error:', errorBody);
            return {
                statusCode: geminiResponse.status,
                body: JSON.stringify({ error: `Gemini API failed: ${errorBody}` }),
            };
        }

        const result = await geminiResponse.json();
        
        // Extract the clean JSON text from Gemini's nested response structure
        // This ensures we send only the valid JSON report back to the frontend
        const cleanJsonText = result.candidates[0].content.parts[0].text;

        return {
            statusCode: 200,
            // Set the header to indicate the response is JSON
            headers: {
                "Content-Type": "application/json",
            },
            // Return the clean JSON string directly
            body: cleanJsonText, 
        };

    } catch (error) {
        console.error('Error in Netlify function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

