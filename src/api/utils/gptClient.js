import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function extractItemData(base64Image, optionalText = '') {
  try {
    const messages = [
      {
        role: 'system',
        content: `You are a helpful assistant that extracts structured information from product label images. The format must always be valid JSON with these keys: item_id, title, description, vendor, manufacture_date. Only respond with the JSON. No explanation.`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: optionalText || 'Please extract details from this label.' },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
            },
          },
        ],
      },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.2,
      max_tokens: 500,
    });

    const rawText = response.choices[0].message.content;

    // Try to extract JSON from the response
    const match = rawText.match(/\{[\s\S]*\}/); // matches first {...} block
    if (match) {
      const parsed = JSON.parse(match[0]);
      return parsed;
    } else {
      console.warn('⚠️ Could not find JSON in GPT response.');
      return { raw: rawText };
    }
  } catch (error) {
    console.error('❌ GPT API error:', error);
    throw error;
  }
}
