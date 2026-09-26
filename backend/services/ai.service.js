const { GoogleGenAI } = require('@google/genai');

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    
    if (this.apiKey) {
      this.ai = new GoogleGenAI({
        apiKey: this.apiKey
      });
    }
  }
  
  async generateQuestions({
    subject,
    topic,
    difficulty,
    count = 2
  }) {
    if (!this.ai) {
      throw new Error(
        'Gemini API key is not configured on the server.'
      );
    }
    
    const prompt = `You are a senior examination compiler for Nigerian UTME (JAMB) and WAEC SSCE.

Generate ${count} ${difficulty} level multiple choice questions for Subject: "${subject}", Topic: "${topic}".

Format strictly as a JSON array where each item has:

- "question_text": string
- "difficulty": "${difficulty}"
- "explanation": string
- "options": Array of 4 objects with "option_key" ("A","B","C","D"), "option_text" (string), and "is_correct" (boolean, exactly one true).`;
    
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });
    
    const parsed = JSON.parse(response.text);
    
    return this.validateGeneratedQuestions(parsed);
  }
  
  validateGeneratedQuestions(questions) {
    return questions.filter((q) => {
      if (
        !q.question_text ||
        !Array.isArray(q.options) ||
        q.options.length !== 4
      ) {
        return false;
      }
      
      const correctCount = q.options.filter(
        (o) => o.is_correct === true
      ).length;
      
      return correctCount === 1 && !!q.explanation;
    });
  }
}

module.exports = new AIService();