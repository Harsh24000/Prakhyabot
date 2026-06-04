import Groq from "groq-sdk";

// ---------------------------------------------------------------------------
// Groq LLM integration for Mealzy Telegram bot
// ---------------------------------------------------------------------------

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

/**
 * Call the Groq chat completions API.
 * @param {string} systemPrompt - The system-level instruction.
 * @param {string} userPrompt   - The user-level message / context.
 * @param {object} [opts]       - Additional options.
 * @param {boolean} [opts.json] - If true, request JSON response format.
 * @param {number}  [opts.temperature] - Sampling temperature (0-1).
 * @param {number}  [opts.maxTokens]   - Max tokens in response.
 * @returns {Promise<string>} The assistant's reply text.
 */
async function chat(systemPrompt, userPrompt, opts = {}) {
  const { json = false, temperature = 0.7, maxTokens = 1024 } = opts;

  const requestBody = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature,
    max_tokens: maxTokens,
  };

  if (json) {
    requestBody.response_format = { type: "json_object" };
  }

  try {
    const completion = await groq.chat.completions.create(requestBody);
    return completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("[LLM] Groq API error:", err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Public helpers used by the conversation engine
// ---------------------------------------------------------------------------

/**
 * Extract structured field values from a free-form user message.
 *
 * @param {string} extractionPrompt - The filled extraction system prompt.
 * @param {string} userContext      - Context string with section info + user message.
 * @returns {Promise<{extracted: object, missing: string[]}>}
 */
export async function extractFields(extractionPrompt, userContext) {
  const raw = await chat(extractionPrompt, userContext, {
    json: true,
    temperature: 0.1, // low temperature for accurate extraction
    maxTokens: 512,
  });

  try {
    const parsed = JSON.parse(raw);
    return {
      extracted: parsed.extracted ?? {},
      missing: parsed.missing ?? [],
    };
  } catch {
    console.error("[LLM] Failed to parse extraction JSON:", raw);
    return { extracted: {}, missing: [] };
  }
}

/**
 * Generate a conversational bot response.
 *
 * @param {string} responsePrompt - The filled response system prompt.
 * @param {string} context        - Conversation context string.
 * @returns {Promise<string>} The bot's reply message.
 */
export async function generateResponse(responsePrompt, context) {
  return chat(responsePrompt, context, {
    temperature: 0.75,
    maxTokens: 300, // keep replies short for Telegram
  });
}

/**
 * Generate a transition message between sections.
 *
 * @param {string} transitionPrompt - The filled transition system prompt.
 * @param {string} context          - Context about from/to sections.
 * @returns {Promise<string>} The transition message.
 */
export async function generateTransition(transitionPrompt, context) {
  return chat(transitionPrompt, context, {
    temperature: 0.8,
    maxTokens: 350,
  });
}

/**
 * Generate the welcome message.
 *
 * @param {string} welcomePrompt - The filled welcome system prompt.
 * @returns {Promise<string>} The welcome message.
 */
export async function generateWelcome(welcomePrompt) {
  return chat(welcomePrompt, "New user just pressed /start. Generate a welcome message.", {
    temperature: 0.85,
    maxTokens: 250,
  });
}

/**
 * Generate a formatted summary of all onboarding data.
 *
 * @param {string} summaryPrompt - The filled summary system prompt.
 * @param {string} userData      - JSON string of all collected data.
 * @returns {Promise<string>} The formatted summary.
 */
export async function generateSummary(summaryPrompt, userData) {
  return chat(summaryPrompt, userData, {
    temperature: 0.3,
    maxTokens: 2000,
  });
}

// ---------------------------------------------------------------------------
// SMART functions — make the bot intelligent about contradictions & patterns
// ---------------------------------------------------------------------------

/**
 * Detect smart contradictions and patterns in user's data.
 * Analyzes if user's goals match their stated behavior/willingness.
 *
 * @param {string} validationPrompt - The filled smart validation prompt.
 * @param {string} context          - User data and current answer.
 * @returns {Promise<{hasContradiction: boolean, contradiction: string|null, smartObservation: string|null, shouldAsk: string|null}>}
 */
export async function detectSmartPatterns(validationPrompt, context) {
  const raw = await chat(validationPrompt, context, {
    json: true,
    temperature: 0.4, // lower temp for pattern detection
    maxTokens: 400,
  });

  try {
    const parsed = JSON.parse(raw);
    return {
      hasContradiction: parsed.hasContradiction ?? false,
      contradiction: parsed.contradiction ?? null,
      smartObservation: parsed.smartObservation ?? null,
      shouldAsk: parsed.shouldAsk ?? null,
    };
  } catch (err) {
    console.error("[LLM] Failed to parse smart validation JSON:", raw);
    return {
      hasContradiction: false,
      contradiction: null,
      smartObservation: null,
      shouldAsk: null,
    };
  }
}

/**
 * Generate a contextually smart follow-up question.
 * Different from generic questions — this feels tailored to THIS user.
 *
 * @param {string} followUpPrompt - The filled smart follow-up prompt.
 * @param {string} context       - User data and section context.
 * @returns {Promise<string>} The smart follow-up question.
 */
export async function generateSmartFollowUp(followUpPrompt, context) {
  return chat(followUpPrompt, context, {
    temperature: 0.7,
    maxTokens: 150,
  });
}

/**
 * Generate a brief, relevant fitness/nutrition insight.
 * Makes the bot feel knowledgeable and shows it understands their situation.
 *
 * @param {string} insightPrompt - The filled smart insight prompt.
 * @param {string} context       - User data and current answer.
 * @returns {Promise<string>} The insight text (1 sentence).
 */
export async function generateSmartInsight(insightPrompt, context) {
  return chat(insightPrompt, context, {
    temperature: 0.6,
    maxTokens: 150,
  });
}

/**
 * Generate a domain-specific smart follow-up question.
 * Different questions for fitness/nutrition/health/psychology domains.
 *
 * @param {string} domainPrompt - The filled domain-specific prompt.
 * @param {string} context      - User situation and field context.
 * @returns {Promise<string>} The smart follow-up question.
 */
export async function generateSmartDomainQuestion(domainPrompt, context) {
  return chat(domainPrompt, context, {
    temperature: 0.7,
    maxTokens: 150,
  });
}

/**
 * Validate goals vs situation — catch unrealistic goals and contradictions.
 *
 * @param {string} realityCheckPrompt - The filled reality check prompt.
 * @param {string} context            - User's goal, situation, willingness.
 * @returns {Promise<{isRealistic: boolean, issue: string|null, smartQuestion: string|null}>}
 */
export async function checkGoalRealism(realityCheckPrompt, context) {
  const raw = await chat(realityCheckPrompt, context, {
    json: true,
    temperature: 0.5,
    maxTokens: 400,
  });

  try {
    const parsed = JSON.parse(raw);
    return {
      isRealistic: parsed.isRealistic ?? true,
      issue: parsed.issue ?? null,
      smartQuestion: parsed.smartQuestion ?? null,
    };
  } catch (err) {
    console.error("[LLM] Failed to parse reality check JSON:", raw);
    return { isRealistic: true, issue: null, smartQuestion: null };
  }
}

/**
 * Extract data PLUS coaching context from user message.
 * Gets not just fields, but intent and situation.
 *
 * @param {string} contextPrompt - The filled context extraction prompt.
 * @param {string} message       - User message and profile.
 * @returns {Promise<{extracted: object, coachingInsight: string, redFlag: string|null}>}
 */
export async function extractWithContext(contextPrompt, message) {
  const raw = await chat(contextPrompt, message, {
    json: true,
    temperature: 0.4,
    maxTokens: 400,
  });

  try {
    const parsed = JSON.parse(raw);
    return {
      extracted: parsed.extracted ?? {},
      coachingInsight: parsed.coachingInsight ?? "",
      redFlag: parsed.redFlag ?? null,
    };
  } catch (err) {
    console.error("[LLM] Failed to parse context extraction JSON:", raw);
    return { extracted: {}, coachingInsight: "", redFlag: null };
  }
}

/**
 * Generate a smart ask that references user's specific situation.
 *
 * @param {string} smartAskPrompt - The filled smart ask prompt.
 * @param {string} context        - User profile and what was extracted.
 * @returns {Promise<string>} The smart ask message.
 */
export async function generateSmartAsk(smartAskPrompt, context) {
  return chat(smartAskPrompt, context, {
    temperature: 0.75,
    maxTokens: 200,
  });
}
