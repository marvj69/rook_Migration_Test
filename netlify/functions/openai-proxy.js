// netlify/functions/openai-proxy.js

// Use node-fetch version 2 if needed in Netlify environment
// You might need to add "node-fetch": "^2.6.0" to your package.json if you have one
// If you don't have a package.json, Netlify's environment might provide fetch, or try this:
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

exports.handler = async function(event, context) {
  // 1. Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // 2. Get the secret API key from environment variables
  const { OPENAI_API_KEY } = process.env;
  if (!OPENAI_API_KEY) {
      console.error("OpenAI API Key not found in environment variables.");
      return { statusCode: 500, body: JSON.stringify({ error: 'Chatbot configuration error.' }) };
  }

  try {
    // 3. Parse the data sent from the frontend (chatbot.js)
    // It should contain { model: "...", messages: [...] }
    const requestData = JSON.parse(event.body);

    // 4. Make the *actual* call to OpenAI from the server function
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add the secret key here
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: requestData.model,     // Use model sent from frontend
        messages: requestData.messages, // Use messages sent from frontend
        max_tokens: 500,
        temperature: 0.7
      })
    });

    // 5. Handle the response from OpenAI
    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API Error:", errorData);
      return { statusCode: response.status, body: JSON.stringify(errorData) };
    }

    const data = await response.json();

    // 6. Send the OpenAI response back to the frontend (chatbot.js)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // Allow your Netlify site to call this function
        'Access-Control-Allow-Origin': '*', // Or be more specific with your Netlify URL if needed
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(data) // Send the whole OpenAI response back
    };

  } catch (error) {
    console.error("Error in Netlify function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process chat message.' })
    };
  }
};
