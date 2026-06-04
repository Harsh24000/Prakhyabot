import { InlineKeyboard } from "grammy";
import SECTIONS from "./sections.js";
import {
  EXTRACTION_PROMPT,
  RESPONSE_PROMPT,
  TRANSITION_PROMPT,
  WELCOME_PROMPT,
  PHOTO_PROMPT,
  SMART_VALIDATION_PROMPT,
  SMART_FOLLOW_UP_PROMPT,
  SMART_INSIGHT_PROMPT,
  SMART_DOMAIN_PROMPT,
  SMART_REALITY_CHECK_PROMPT,
  CONTEXT_AWARE_EXTRACTION_PROMPT,
  SMART_ASK_PROMPT,
} from "./prompts.js";
import {
  extractFields,
  generateResponse,
  generateTransition,
  generateWelcome,
  detectSmartPatterns,
  generateSmartFollowUp,
  generateSmartInsight,
  generateSmartDomainQuestion,
  checkGoalRealism,
  extractWithContext,
  generateSmartAsk,
} from "./llm.js";
import {
  simulateTyping, calculateTypingDelay, splitMessages,
  fillTemplate, formatSummaryForTelegram, delay,
} from "./utils.js";
import { calculateBMR, calculateTDEE, calculateBMI, getBMICategory, getPersonalityTag } from "./calculations.js";
import { sendSticker } from "./stickers.js";
import { SECTION_INSIGHTS, CURIOSITY_HOOKS, PRIVACY_GATES } from "./insights.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOT_NAME        = process.env.BOT_NAME      || "Priya";
const FORWARD_CHAT_ID = process.env.FORWARD_CHAT_ID || null;
const MAX_HISTORY     = 14;
const NUDGE_AFTER_MS  = 2 * 60 * 60 * 1000; // 2 hours

// ---------------------------------------------------------------------------
// Processing lock — prevents the same user's messages being handled
// concurrently, which causes the same response to be sent 5-6 times when
// a user taps several messages quickly.
// ---------------------------------------------------------------------------

const processingLocks = new Set();

async function withLock(chatId, fn) {
  if (processingLocks.has(chatId)) return; // already processing — drop duplicate
  processingLocks.add(chatId);
  try {
    await fn();
  } finally {
    processingLocks.delete(chatId);
  }
}

// ---------------------------------------------------------------------------
// SMART Intent Detection — Understand what users are REALLY doing
// ---------------------------------------------------------------------------

const SKIP_PHRASES = [
  "skip", "dont want", "don't want", "don't wanna", "dont wanna",
  "pass", "move on", "next question", "next one", "skip this",
  "no answer", "not answering", "rather not", "prefer not",
  "idk", "no idea", "not sure", "don't know", "dont know",
];

const PLAYFULNESS_PHRASES = [
  "guess", "lol", "haha", "😄", "😅", "😆", "just kidding", "jk", "nah kidding",
  "you think", "try", "be smart", "figure it out", "make a guess",
];

const EVASION_PHRASES = [
  "why", "why to", "why should", "is it necessary", "do i have to", "do i need to",
  "why do i need", "what's the reason", "why would i", "why does it matter",
];

const HESITATION_PHRASES = [
  "not sure", "kinda", "sort of", "maybe", "i guess", "kind of", "not really",
  "probably", "possibly", "might be", "could be", "think so",
];

function isSkipIntent(message) {
  if (!message) return false;
  const lower = message.toLowerCase().trim();
  return SKIP_PHRASES.some(p => lower.includes(p));
}

/**
 * Detect if user is being PLAYFUL (testing, joking, not refusing)
 * Important: Playfulness ≠ evasion. They might give data after.
 */
function detectPlayfulness(message) {
  if (!message) return false;
  const lower = message.toLowerCase().trim();
  return PLAYFULNESS_PHRASES.some(p => lower.includes(p));
}

/**
 * Detect if user is EVADING (questioning why they should answer)
 * Important: Address the resistance, don't repeat the question.
 */
function detectEvasion(message) {
  if (!message) return false;
  const lower = message.toLowerCase().trim();
  return EVASION_PHRASES.some(p => lower.includes(p));
}

/**
 * Detect if user is HESITANT (uncertain, not refusal)
 * Important: Show confidence in why you need it.
 */
function detectHesitation(message) {
  if (!message) return false;
  const lower = message.toLowerCase().trim();
  return HESITATION_PHRASES.some(p => lower.includes(p));
}

// Emoji reactions allowed by Telegram Bot API
const REACTIONS = {
  love:      "❤️",
  fire:      "🔥",
  clap:      "👏",
  hug:       "🫂",
  thumbsup:  "👍",
  celebrate: "🎉",
  mindblown: "🤩",
  think:     "🤔",
};

// ---------------------------------------------------------------------------
// In-memory state store
// ---------------------------------------------------------------------------

/** @type {Map<number, object>} */
const userStates = new Map();

function getState(chatId) {
  if (!userStates.has(chatId)) {
    userStates.set(chatId, {
      chatId,
      currentSectionIndex: 0,
      currentGroupIndex: 0,
      data: {},
      messageHistory: [],
      awaitingPhoto: null,
      completed: false,
      committed: false,           // has user tapped "Let's do it!"
      startedAt: Date.now(),
      lastActivity: Date.now(),
      nudgeSentAt: null,
      multiSelectTemp: {},
      tdeeShown: false,           // TDEE card shown after section 1
      midFormSummaryShown: false, // 50% snapshot shown
      insightsShown: new Set(),   // which section insights have fired
      gatesShown: new Set(),      // which privacy gates have been shown
      pendingGateSection: null,   // section waiting behind a privacy gate
      reminderScheduledAt: null,  // if user chose "remind me later"
    });
  }
  const state = userStates.get(chatId);
  state.lastActivity = Date.now();
  return state;
}

function resetState(chatId) { userStates.delete(chatId); }

function addToHistory(state, role, text) {
  state.messageHistory.push(`${role}: ${text}`);
  if (state.messageHistory.length > MAX_HISTORY) {
    state.messageHistory = state.messageHistory.slice(-MAX_HISTORY);
  }
}

// ---------------------------------------------------------------------------
// Section / group helpers
// ---------------------------------------------------------------------------

function getCurrentSection(state)  { return SECTIONS[state.currentSectionIndex] ?? null; }

function getCurrentGroup(state) {
  const s = getCurrentSection(state);
  return s?.grouping?.[state.currentGroupIndex] ?? null;
}

function getCurrentGroupFields(state) {
  const s = getCurrentSection(state);
  const g = getCurrentGroup(state);
  if (!s || !g) return [];
  return s.fields.filter(f => g.includes(f.key));
}

function getMissingFieldsInGroup(state) {
  return getCurrentGroupFields(state).filter(f => {
    const v = state.data[f.key];
    return v === undefined || v === null || v === "";
  });
}

function isSectionComplete(state) {
  const s = getCurrentSection(state);
  if (!s || s.id === "review-submit") return true;
  return s.fields.every(f => !f.required || (state.data[f.key] != null && state.data[f.key] !== ""));
}

function isGroupComplete(state) {
  const fields = getCurrentGroupFields(state);
  if (!fields.length) return true;
  return fields.filter(f => f.required).every(f => {
    const v = state.data[f.key];
    return v !== undefined && v !== null && v !== "";
  });
}

function advance(state) {
  const s = getCurrentSection(state);
  if (!s) return "complete";
  if (s.grouping && state.currentGroupIndex < s.grouping.length - 1) {
    state.currentGroupIndex++;
    return "next-group";
  }
  if (state.currentSectionIndex < SECTIONS.length - 1) {
    state.currentSectionIndex++;
    state.currentGroupIndex = 0;
    return "next-section";
  }
  state.completed = true;
  return "complete";
}

// ---------------------------------------------------------------------------
// Progress helpers
// ---------------------------------------------------------------------------

function getProgressText(state) {
  const total = SECTIONS.length - 1;
  const pct   = Math.min(100, Math.round((state.currentSectionIndex / total) * 100));
  const filled = Math.round(pct / 10);
  const bar    = "▓".repeat(filled) + "░".repeat(10 - filled);
  return `${bar} ${pct}%  •  Section ${state.currentSectionIndex + 1} of ${total}`;
}

function checkMilestone(prevIdx, nextIdx) {
  const total = SECTIONS.length - 1;
  const prev  = Math.round((prevIdx / total) * 100);
  const next  = Math.round((nextIdx / total) * 100);
  if (prev < 25 && next >= 25) return "🎉 25% done — off to a great start!";
  if (prev < 50 && next >= 50) return "🔥 halfway there! you're on a roll — keep going!";
  if (prev < 75 && next >= 75) return "💪 75% done — almost there, just a bit more!";
  return null;
}

// ---------------------------------------------------------------------------
// Inline keyboard builders
// ---------------------------------------------------------------------------

function buildYesNoKeyboard(fieldKey) {
  return new InlineKeyboard()
    .text("✅  Yes", `yn|${fieldKey}|1`)
    .text("❌  No",  `yn|${fieldKey}|0`);
}

function buildSelectKeyboard(fieldKey, options) {
  const kb = new InlineKeyboard();
  options.forEach((opt, i) => {
    if (i > 0 && i % 2 === 0) kb.row();
    kb.text(opt, `sel|${fieldKey}|${i}`);
  });
  return kb;
}

function buildMultiSelectKeyboard(fieldKey, options, selected) {
  const kb = new InlineKeyboard();
  options.forEach((opt, i) => {
    kb.text(`${selected.includes(opt) ? "✅" : "◻️"}  ${opt}`, `ms|${fieldKey}|${i}`).row();
  });
  kb.text("✓  Done selecting", `msd|${fieldKey}`);
  return kb;
}

function findFieldByKey(key) {
  for (const section of SECTIONS) {
    const f = section.fields.find(f => f.key === key);
    if (f) return f;
  }
  return null;
}

function getKeyboardForField(field) {
  if (!field) return null;
  if (field.type === "yesno") return buildYesNoKeyboard(field.key);
  if (field.type === "select" && field.options?.length)
    return buildSelectKeyboard(field.key, field.options);
  if (field.type === "multiselect" && field.options?.length)
    return buildMultiSelectKeyboard(field.key, field.options, []);
  return null;
}

// ---------------------------------------------------------------------------
// LLM context builders
// ---------------------------------------------------------------------------

function buildFieldDefinitions(fields) {
  return fields.map(f => {
    let d = `- ${f.key} (${f.type}): "${f.question}"`;
    if (f.options)  d += ` | Options: ${JSON.stringify(f.options)}`;
    if (f.examples) d += ` | Example: ${f.examples}`;
    return d;
  }).join("\n");
}

function buildCollectedData(state, fields) {
  const out = {};
  for (const f of fields) {
    if (state.data[f.key] != null) out[f.key] = state.data[f.key];
  }
  return JSON.stringify(out);
}

function buildUserProfile(state) {
  const p = {};
  for (const [k, v] of Object.entries(state.data)) {
    if (v != null && v !== "" && v !== "skipped") p[k] = v;
  }
  return JSON.stringify(p, null, 2);
}

function buildConversationHistory(state, count = 6) {
  return state.messageHistory.slice(-count).join("\n");
}

// ---------------------------------------------------------------------------
// React to a user message with an emoji (Telegram Bot API 7.0+)
// Silently fails if the API doesn't support it.
// ---------------------------------------------------------------------------

async function reactToMessage(ctx, emoji) {
  try {
    await ctx.api.setMessageReaction(
      ctx.chat.id,
      ctx.message.message_id,
      [{ type: "emoji", emoji }]
    );
  } catch {
    // reactions not critical — ignore failures silently
  }
}

// ---------------------------------------------------------------------------
// Pick a contextual reaction based on user's message / section
// ---------------------------------------------------------------------------

function pickReaction(userMessage, sectionId) {
  const lower = (userMessage || "").toLowerCase();

  if (/photo|pic|image/.test(lower)) return REACTIONS.love;
  if (/stress|anxious|overwhelm|tough|hard|difficult/.test(lower)) return REACTIONS.hug;
  if (/gym|workout|train|run|cardio|lift/.test(lower)) return REACTIONS.fire;
  if (/can't|don't|never|fail|gave up|stop/.test(lower)) return REACTIONS.clap;
  if (sectionId === "your-goals") return REACTIONS.mindblown;
  if (sectionId === "sleep-stress" && /8|9|10/.test(lower)) return REACTIONS.fire;

  // Default light positive reaction
  return REACTIONS.thumbsup;
}

// ---------------------------------------------------------------------------
// TDEE insight card — shown once after "About You" section completes
// ---------------------------------------------------------------------------

async function sendTDEEInsight(ctx, state) {
  if (state.tdeeShown) return;
  state.tdeeShown = true;

  const { weightKg, heightCm, age, biologicalSex } = state.data;
  const bmr  = calculateBMR(weightKg, heightCm, age, biologicalSex);
  const tdee = calculateTDEE(bmr);
  const bmi  = calculateBMI(weightKg, heightCm);
  const bmiCat = getBMICategory(bmi);

  if (!bmr || !tdee) return;

  await delay(600);
  await simulateTyping(ctx, 1800);

  const msg =
    `quick calc while we chat —\n\n` +
    `🔢 your maintenance calories: *~${tdee.toLocaleString()} kcal/day*\n` +
    `that's what your body burns just existing\n\n` +
    (bmi ? `📊 BMI: *${bmi}* (${bmiCat})\n\n` : "") +
    `we'll put you in a smart deficit/surplus based on your goals\n` +
    `this number will be refined once I know your full activity level`;

  await ctx.reply(msg, { parse_mode: "Markdown" });
  addToHistory(state, "Bot", "[Sent TDEE insight card]");
}

// ---------------------------------------------------------------------------
// Mid-form snapshot — shown once around the 50% mark
// ---------------------------------------------------------------------------

async function sendMidFormSnapshot(ctx, state) {
  if (state.midFormSummaryShown) return;
  state.midFormSummaryShown = true;

  const { fullName, dietaryPreference, profession, daysActive, fitnessGoals } = state.data;
  if (!fullName && !dietaryPreference) return; // not enough data yet

  const lines = [];
  if (dietaryPreference) lines.push(`• ${dietaryPreference.toLowerCase()}`);
  if (profession)        lines.push(`• ${profession.toLowerCase()}`);
  if (daysActive)        lines.push(`• active ${daysActive} days/week`);
  if (fitnessGoals)      lines.push(`• goal: ${String(fitnessGoals).slice(0, 60)}...`);

  if (!lines.length) return;

  await delay(400);
  await ctx.reply(
    `so far I know you're:\n${lines.join("\n")}\n\nyou're actually in a really workable spot 💪\nlet's keep going`
  );
  addToHistory(state, "Bot", "[Sent mid-form snapshot]");
}

// ---------------------------------------------------------------------------
// Section insight + curiosity hook
// ---------------------------------------------------------------------------

async function sendSectionInsightAndHook(ctx, state, completedSectionId) {
  if (state.insightsShown.has(completedSectionId)) return;
  state.insightsShown.add(completedSectionId);

  // Section insight
  const insightFn = SECTION_INSIGHTS[completedSectionId];
  if (insightFn) {
    const insight = typeof insightFn === "function" ? insightFn(state.data) : insightFn;
    if (insight) {
      await delay(700);
      await simulateTyping(ctx, 1200);
      await ctx.reply(insight);
      addToHistory(state, "Bot", `[Insight: ${completedSectionId}]`);
    }
  }

  // Curiosity hook (teaser for next section)
  const hook = CURIOSITY_HOOKS[completedSectionId];
  if (hook) {
    await delay(500);
    await simulateTyping(ctx, 900);
    await ctx.reply(hook);
    addToHistory(state, "Bot", `[Hook: ${completedSectionId}]`);
  }
}

// ---------------------------------------------------------------------------
// Privacy gate — shown before sensitive sections
// ---------------------------------------------------------------------------

async function maybeShowPrivacyGate(ctx, state, nextSectionId) {
  const gate = PRIVACY_GATES[nextSectionId];
  if (!gate) return false;
  if (state.gatesShown.has(nextSectionId)) return false;

  state.gatesShown.add(nextSectionId);
  state.pendingGateSection = nextSectionId;

  await delay(400);
  const kb = new InlineKeyboard().text(gate.buttonText, gate.callbackData);
  await ctx.reply(gate.message, { reply_markup: kb });
  addToHistory(state, "Bot", `[Privacy gate: ${nextSectionId}]`);
  return true; // caller should return after this — gate is blocking
}

// ---------------------------------------------------------------------------
// Personality tag + next steps — shown at the very end
// ---------------------------------------------------------------------------

async function sendClosingSequence(ctx, state) {
  const { tag, description } = getPersonalityTag(state.data);

  await delay(800);
  await simulateTyping(ctx, 1500);
  await ctx.reply(
    `based on everything you've told me —\n\n` +
    `you're what we call *${tag}*\n` +
    `${description}`,
    { parse_mode: "Markdown" }
  );

  await delay(600);
  await simulateTyping(ctx, 1000);
  await ctx.reply(
    `here's exactly what happens next:\n\n` +
    `1️⃣  your coach reviews your profile today\n` +
    `2️⃣  you'll hear back within 24 hours\n` +
    `3️⃣  your personalised plan lands within 48 hours\n\n` +
    `we'll reach out on WhatsApp — keep an eye out 🙏`
  );

  await delay(1200);
  await sendSticker(ctx, "celebrate");

  await delay(800);
  await ctx.reply(
    `one last thing — if you have a friend who's been putting this off, now's the time 😄\n\n` +
    `just share this bot with them and they'll get the same personalised experience`
  );

  addToHistory(state, "Bot", "[Closing sequence sent]");
}

// ---------------------------------------------------------------------------
// Core: process after any field update (text OR button tap)
// ---------------------------------------------------------------------------

async function processAfterFieldUpdate(ctx, state, extracted = {}) {
  const section = getCurrentSection(state);
  if (!section) { await ctx.reply("Something went wrong. Type /restart to start over."); return; }
  if (section.id === "review-submit") return;

  // Mid-form snapshot at ~50%
  const totalSections = SECTIONS.length - 1;
  const pct = Math.round((state.currentSectionIndex / totalSections) * 100);
  if (pct >= 45 && pct <= 55 && !state.midFormSummaryShown) {
    await sendMidFormSnapshot(ctx, state);
  }

  // Auto-advance through completed groups / sections
  while (isGroupComplete(state)) {
    const currentSection = getCurrentSection(state);
    if (!currentSection) break;

    if (isSectionComplete(state)) {
      const prevIndex = state.currentSectionIndex;
      const completedId = currentSection.id;

      // Fire insight + hook for completed section
      await sendSectionInsightAndHook(ctx, state, completedId);

      const advancement = advance(state);

      if (advancement === "complete") {
        await showReview(ctx, state);
        return;
      }

      if (advancement === "next-section") {
        const nextSection = getCurrentSection(state);

        // Milestone celebration
        const milestone = checkMilestone(prevIndex, state.currentSectionIndex);
        if (milestone) {
          await delay(400);
          await ctx.reply(milestone);
          if (state.currentSectionIndex === Math.round(totalSections / 2)) {
            await sendSticker(ctx, "fire");
          }
          await delay(500);
        }

        // TDEE insight after About You
        if (prevIndex === 0) {
          await sendTDEEInsight(ctx, state);
        }

        if (nextSection?.id === "full-body-photos") {
          await sendPhotoSectionIntro(ctx, state);
          return;
        }
        if (nextSection?.id === "review-submit") {
          await showReview(ctx, state);
          return;
        }

        // Privacy gate check
        const blocked = await maybeShowPrivacyGate(ctx, state, nextSection.id);
        if (blocked) return; // wait for gate callback

        // Transition message
        const nextGroupFields = getCurrentGroupFields(state);
        const transCtx = fillTemplate(TRANSITION_PROMPT, {
          botName: BOT_NAME,
          fromSection: currentSection.name,
          toSection: nextSection.name,
          toSectionDescription: nextSection.description,
          userProfile: buildUserProfile(state),
          conversationHistory: buildConversationHistory(state, 4),
          firstQuestions: buildFieldDefinitions(nextGroupFields),
        });

        await simulateTyping(ctx, calculateTypingDelay("transition"));
        let transMsg = `alright, moving on to ${nextSection.name.toLowerCase()} now`;
        try { transMsg = await generateTransition(transCtx, "Generate the transition message."); } catch {}

        const firstMissing = nextGroupFields.find(f => !state.data[f.key]);
        await sendBotMessage(ctx, state, transMsg, getKeyboardForField(firstMissing));

        // Progress bar
        await delay(300);
        await ctx.reply(`📊  ${getProgressText(state)}`);
        return;
      }

      continue; // next-group in same section
    }

    // Group complete but section not — advance to next group
    if (currentSection.grouping && state.currentGroupIndex < currentSection.grouping.length - 1) {
      state.currentGroupIndex++;
    } else {
      break;
    }
  }

  // Generate SMART conversational response for remaining missing fields
  const activeSection = getCurrentSection(state);
  const currentMissing = getMissingFieldsInGroup(state);

  await simulateTyping(ctx, calculateTypingDelay("response"));

  let response = currentMissing.length > 0 ? currentMissing[0].question : "Got it!";

  // ════════════════════════════════════════════════════════════════════════
  // TIER 1: Smart Response with Initial Reaction
  // ════════════════════════════════════════════════════════════════════════
  try {
    const responseCtx = fillTemplate(RESPONSE_PROMPT, {
      botName: BOT_NAME,
      sectionName: activeSection.name,
      sectionDescription: activeSection.description,
      extractedFields: JSON.stringify(extracted),
      missingFields: buildFieldDefinitions(currentMissing),
      userProfile: buildUserProfile(state),
      conversationHistory: buildConversationHistory(state),
    });

    response = await generateResponse(responseCtx, "Generate your next message.");
  } catch (err) {
    console.error("[Response] Generation failed:", err.message);
  }

  // ════════════════════════════════════════════════════════════════════════
  // TIER 2: Detect Patterns and Contradictions
  // ════════════════════════════════════════════════════════════════════════
  if (Object.keys(extracted).length > 0) {
    try {
      const smartValidationCtx = fillTemplate(SMART_VALIDATION_PROMPT, {
        userProfile: buildUserProfile(state),
        currentAnswer: JSON.stringify(extracted),
        sectionName: activeSection.name,
      });

      const smartPattern = await detectSmartPatterns(smartValidationCtx, "Analyze for contradictions and patterns.");

      if (smartPattern.smartObservation && !response.includes(smartPattern.smartObservation)) {
        response = response + "\n\n" + smartPattern.smartObservation;
      }
    } catch (err) {
      console.error("[Smart] Pattern detection failed:", err.message);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // TIER 3: Domain-Specific Smart Follow-Up (if still missing fields)
  // ════════════════════════════════════════════════════════════════════════
  if (currentMissing.length > 0 && Object.keys(extracted).length > 0) {
    try {
      const nextField = currentMissing[0];
      const domainCtx = fillTemplate(SMART_DOMAIN_PROMPT, {
        userProfile: buildUserProfile(state),
        fieldName: nextField.key,
        fieldDescription: nextField.question,
        currentAnswer: JSON.stringify(extracted),
      });

      const smartQuestion = await generateSmartDomainQuestion(domainCtx, "Generate domain-specific smart follow-up.");
      if (smartQuestion && smartQuestion.trim() && !response.includes(smartQuestion)) {
        // Replace last line of response with smarter question
        const lines = response.split("\n");
        lines[lines.length - 1] = smartQuestion;
        response = lines.join("\n");
      }
    } catch (err) {
      console.error("[Domain] Question generation failed:", err.message);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // TIER 4: Micro-Insights About Their Situation
  // ════════════════════════════════════════════════════════════════════════
  if (Object.keys(extracted).length > 0 && Math.random() < 0.45) { // 45% chance
    try {
      const insightCtx = fillTemplate(SMART_INSIGHT_PROMPT, {
        userProfile: buildUserProfile(state),
        currentAnswer: JSON.stringify(extracted),
        sectionName: activeSection.name,
      });

      const insight = await generateSmartInsight(insightCtx, "Share relevant insight.");
      if (insight && insight.trim() && !response.toLowerCase().includes(insight.toLowerCase())) {
        response = response + "\n" + insight;
      }
    } catch (err) {
      console.error("[Insight] Generation failed:", err.message);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // TIER 5: Reality Check for Goals (if goal section)
  // ════════════════════════════════════════════════════════════════════════
  if (activeSection.id === "your-goals" && Object.keys(extracted).length > 0) {
    try {
      const goalRealism = fillTemplate(SMART_REALITY_CHECK_PROMPT, {
        userProfile: buildUserProfile(state),
        userGoal: JSON.stringify(extracted),
        userSituation: buildUserProfile(state),
        userWillingness: JSON.stringify(state.data), // What they've said they'll do
      });

      const realityCheck = await checkGoalRealism(goalRealism, "Evaluate goal vs situation.");
      if (!realityCheck.isRealistic && realityCheck.smartQuestion) {
        response = response + "\n\n" + realityCheck.smartQuestion;
      }
    } catch (err) {
      console.error("[Reality] Check failed:", err.message);
    }
  }

  await sendBotMessage(ctx, state, response, getKeyboardForField(currentMissing[0]));
}

// ---------------------------------------------------------------------------
// Command: /start — shows commitment device first
// ---------------------------------------------------------------------------

export async function handleStart(ctx) {
  const chatId = ctx.chat.id;
  resetState(chatId);
  getState(chatId); // init state

  await simulateTyping(ctx, 1000);

  const kb = new InlineKeyboard()
    .text("✅  Let's do it!", "commit_start").row()
    .text("⏰  Remind me later", "commit_remind");

  await ctx.reply(
    `hey! 👋 I'm ${BOT_NAME} from the Mealzy coaching team\n\n` +
    `I'm going to ask you a few questions to build your personalised nutrition + fitness plan\n` +
    `takes about *8-10 minutes* — the more honest you are, the better your plan\n\n` +
    `over 2,400 people have done this already ⚡`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
}

// ---------------------------------------------------------------------------
// Command: /restart
// ---------------------------------------------------------------------------

export async function handleRestart(ctx) {
  resetState(ctx.chat.id);
  await ctx.reply("no worries, let's start fresh! 🔄");
  await handleStart(ctx);
}

// ---------------------------------------------------------------------------
// Command: /status
// ---------------------------------------------------------------------------

export async function handleStatus(ctx) {
  const state = getState(ctx.chat.id);
  if (state.completed) {
    await ctx.reply("you've already finished onboarding! 🎉\ntype /restart if you want to start over");
    return;
  }
  const current = getCurrentSection(state);
  await ctx.reply(
    `📊 *Your Progress*\n\nCurrently on: *${current?.name ?? "Unknown"}*\n\n${getProgressText(state)}\n\nkeep going, you're doing great! 💪`,
    { parse_mode: "Markdown" }
  );
}

// ---------------------------------------------------------------------------
// Command: /pause
// ---------------------------------------------------------------------------

export async function handlePause(ctx) {
  const state = getState(ctx.chat.id);
  if (state.completed) { await ctx.reply("you've already finished! 🎉"); return; }
  await ctx.reply(
    `no worries, take your time 😊\n\n` +
    `I'll be right here — just send any message to pick up where you left off\n\n` +
    `📊  ${getProgressText(state)}\n\n` +
    `I'll also nudge you in a couple of hours if you haven't come back 🙂`
  );
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

export async function handleMessage(ctx) {
  const chatId = ctx.chat.id;
  // ── Lock: drop the message if we're already processing one for this user ──
  await withLock(chatId, async () => {
    const state       = getState(chatId);
    const userMessage = ctx.message?.text?.trim();
    if (!userMessage) return;

    if (!state.committed) {
      await ctx.reply("tap *Let's do it!* above to get started 😊", { parse_mode: "Markdown" });
      return;
    }

    if (state.completed) {
      await ctx.reply("you've already completed onboarding! 🎉\ntype /restart if you want to do it again");
      return;
    }

    if (state.awaitingPhoto) {
      await simulateTyping(ctx, 800);
      await ctx.reply("I'm waiting for your photo 📸  just send it and I'll save it!");
      return;
    }

    // React to message
    await reactToMessage(ctx, pickReaction(userMessage, getCurrentSection(state)?.id));

    addToHistory(state, "User", userMessage);

    const section = getCurrentSection(state);
    if (!section) { await ctx.reply("something went wrong. type /restart to start over."); return; }

    if (section.id === "review-submit") {
      await handleReviewResponse(ctx, state, userMessage);
      return;
    }

    // ── SMART Intent Detection ────────────────────────────────────────────
    // Important: Playfulness and evasion are NOT refusals, handle differently
    const isPlayful = detectPlayfulness(userMessage);
    const isEvading = detectEvasion(userMessage);
    const isHesitant = detectHesitation(userMessage);

    // ── Skip / refusal detection ───────────────────────────────────────────
    if (isSkipIntent(userMessage)) {
      const missingFields = getMissingFieldsInGroup(state);
      const allOptional   = missingFields.every(f => !f.required);

      if (allOptional && missingFields.length > 0) {
        // Mark optional fields as explicitly skipped and move on
        missingFields.forEach(f => { state.data[f.key] = null; });
        await simulateTyping(ctx, 700);
        await ctx.reply("no worries, skipping that one! 😊");
        await processAfterFieldUpdate(ctx, state, {});
        return;
      }

      if (!allOptional) {
        // Required field — be warm but firm
        await simulateTyping(ctx, 900);
        await ctx.reply(
          "totally get it — but I do need this one to build your plan properly 🙏\n" +
          "even a rough answer works, it doesn't have to be exact!"
        );
        return;
      }
    }

    // ── Handle EVASION smartly (address the resistance, not the data) ──────
    if (isEvading && !isPlayful) {
      const missingFields = getMissingFieldsInGroup(state);
      if (missingFields.length > 0) {
        const field = missingFields[0];
        let response = "";

        if (field.key === "fullName") {
          response = "honestly yeah, knowing your name helps me personalize your plan — promise it's not for no reason 🙏";
        } else if (field.key.includes("Health") || field.key.includes("Condition")) {
          response = "i get why you'd ask — but this one actually matters for your safety and results. helps me make sure your plan works for YOUR body";
        } else {
          response = "i hear you, but the better i know you, the better your plan. these details actually matter 👍";
        }

        await simulateTyping(ctx, 800);
        await ctx.reply(response);
        addToHistory(state, "Bot", response);
        return; // Don't extract yet, let them respond to the reasoning
      }
    }

    // ── Extract fields ─────────────────────────────────────────────────────
    const allSectionFields    = section.fields.filter(f => f.type !== "photo");
    const fieldsForExtraction = allSectionFields.length > 0 ? allSectionFields : getCurrentGroupFields(state);

    const extractionCtx = [
      `Current section: ${section.name}`,
      `Fields to extract:\n${buildFieldDefinitions(fieldsForExtraction)}`,
      `Already collected: ${buildCollectedData(state, fieldsForExtraction)}`,
      `User message: ${userMessage}`,
    ].join("\n\n");

    let extracted = {};
    try {
      const result = await extractFields(EXTRACTION_PROMPT, extractionCtx);
      extracted = result.extracted;
    } catch (err) {
      console.error("[Conversation] Extraction failed:", err.message);
    }

    for (const [key, value] of Object.entries(extracted)) {
      if (value != null && value !== "") state.data[key] = value;
    }

    await processAfterFieldUpdate(ctx, state, extracted);
  });
}

// ---------------------------------------------------------------------------
// Voice message handler — transcribes or asks user to type
// ---------------------------------------------------------------------------

export async function handleVoice(ctx) {
  const chatId = ctx.chat.id;
  await withLock(chatId, async () => {
    const state = getState(chatId);

    if (!state.committed || state.completed) return;
    if (state.awaitingPhoto) {
      await ctx.reply("I'm waiting for your photo 📸  just send it and I'll save it!");
      return;
    }

    // Try Groq Whisper transcription if enabled
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && process.env.VOICE_TRANSCRIPTION_ENABLED === "true") {
      try {
        await simulateTyping(ctx, 1000);
        await ctx.reply("give me a sec, transcribing that... 🎙️");

        // Download voice file from Telegram
        const voice   = ctx.message.voice;
        const file    = await ctx.api.getFile(voice.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

        const { default: fetch } = await import("node-fetch");
        const audioRes  = await fetch(fileUrl);
        const audioBlob = await audioRes.blob();

        const { default: Groq } = await import("groq-sdk");
        const groq = new Groq({ apiKey: groqKey });
        const transcription = await groq.audio.transcriptions.create({
          file: new File([audioBlob], "voice.ogg", { type: "audio/ogg" }),
          model: "whisper-large-v3",
        });

        const text = transcription.text?.trim();
        if (text) {
          await ctx.reply(`🎙 *Transcribed:* "${text}"`, { parse_mode: "Markdown" });
          // Process transcribed text as if user typed it
          ctx.message.text = text;
          addToHistory(state, "User", text);
          await reactToMessage(ctx, REACTIONS.thumbsup);

          const section = getCurrentSection(state);
          if (!section || section.id === "review-submit") return;

          const allSectionFields    = section.fields.filter(f => f.type !== "photo");
          const fieldsForExtraction = allSectionFields.length > 0 ? allSectionFields : getCurrentGroupFields(state);
          const extractionCtx = [
            `Current section: ${section.name}`,
            `Fields to extract:\n${buildFieldDefinitions(fieldsForExtraction)}`,
            `Already collected: ${buildCollectedData(state, fieldsForExtraction)}`,
            `User message: ${text}`,
          ].join("\n\n");

          let extracted = {};
          try {
            const result = await extractFields(EXTRACTION_PROMPT, extractionCtx);
            extracted = result.extracted;
          } catch {}
          for (const [key, value] of Object.entries(extracted)) {
            if (value != null && value !== "") state.data[key] = value;
          }
          await processAfterFieldUpdate(ctx, state, extracted);
          return;
        }
      } catch (err) {
        console.error("[Voice] Transcription failed:", err.message);
      }
    }

    // Fallback — ask user to type
    await simulateTyping(ctx, 700);
    await ctx.reply("I can't process voice notes just yet 😅\ncould you type that out? I promise it's the last time I ask for that 🙏");
  });
}

// ---------------------------------------------------------------------------
// Callback query handler — all inline keyboard buttons
// ---------------------------------------------------------------------------

export async function handleCallbackQuery(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;
  await ctx.answerCallbackQuery(); // always answer immediately to stop spinner

  const chatId = ctx.chat.id;

  await withLock(chatId, async () => {
  const state  = getState(chatId);

  // ── Commitment device ──────────────────────────────────────────────────────

  if (data === "commit_start") {
    state.committed = true;
    try { await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }); } catch {}
    await sendSticker(ctx, "wave");
    await simulateTyping(ctx, 1500);
    let welcomeMsg = `hey! I'm ${BOT_NAME} from Mealzy 😊\nthis is just a casual chat so I can personalise your plan — no forms, I promise\nfirst — what's your name?`;
    try {
      welcomeMsg = await generateWelcome(fillTemplate(WELCOME_PROMPT, { botName: BOT_NAME }));
    } catch {}
    await sendBotMessage(ctx, state, welcomeMsg);
    return;
  }

  if (data === "commit_remind") {
    try { await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }); } catch {}
    const kb = new InlineKeyboard()
      .text("In 1 hour",        "remind_1h")
      .text("Tonight 8pm",     "remind_8pm").row()
      .text("Tomorrow morning", "remind_tomorrow");
    await ctx.reply("sure! when should I remind you?", { reply_markup: kb });
    return;
  }

  if (data === "remind_1h" || data === "remind_8pm" || data === "remind_tomorrow") {
    const labels = { remind_1h: "1 hour", remind_8pm: "tonight at 8pm", remind_tomorrow: "tomorrow morning" };
    try { await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }); } catch {}
    state.reminderScheduledAt = Date.now();
    await ctx.reply(
      `perfect — I'll message you in ${labels[data]} 🙂\n\n` +
      `your spot is saved, just come back whenever you're ready`
    );
    return;
  }

  // ── Privacy gates ──────────────────────────────────────────────────────────

  if (data === "gate_continue_health") {
    try { await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }); } catch {}
    state.pendingGateSection = null;

    // Generate transition into health section
    const nextSection = getCurrentSection(state);
    if (nextSection) {
      const nextGroupFields = getCurrentGroupFields(state);
      const prevSection = SECTIONS[state.currentSectionIndex - 1];
      const transCtx = fillTemplate(TRANSITION_PROMPT, {
        botName: BOT_NAME,
        fromSection: prevSection?.name || "previous section",
        toSection: nextSection.name,
        toSectionDescription: nextSection.description,
        userProfile: buildUserProfile(state),
        conversationHistory: buildConversationHistory(state, 4),
        firstQuestions: buildFieldDefinitions(nextGroupFields),
      });
      await simulateTyping(ctx, 1200);
      let transMsg = `okay let's go through your health info quickly`;
      try { transMsg = await generateTransition(transCtx, "Generate transition."); } catch {}
      const firstMissing = nextGroupFields.find(f => !state.data[f.key]);
      await sendBotMessage(ctx, state, transMsg, getKeyboardForField(firstMissing));
      await delay(300);
      await ctx.reply(`📊  ${getProgressText(state)}`);
    }
    return;
  }

  // ── Yes / No ───────────────────────────────────────────────────────────────

  if (data.startsWith("yn|")) {
    const [, fieldKey, rawVal] = data.split("|");
    const val = rawVal === "1";
    state.data[fieldKey] = val;
    addToHistory(state, "User", val ? "Yes" : "No");
    await simulateTyping(ctx, 600);
    await processAfterFieldUpdate(ctx, state, { [fieldKey]: val });
    return;
  }

  // ── Single select ──────────────────────────────────────────────────────────

  if (data.startsWith("sel|")) {
    const [, fieldKey, rawIdx] = data.split("|");
    const field = findFieldByKey(fieldKey);
    if (field?.options) {
      const chosen = field.options[parseInt(rawIdx)];
      state.data[fieldKey] = chosen;
      addToHistory(state, "User", chosen);
      await simulateTyping(ctx, 600);
      await processAfterFieldUpdate(ctx, state, { [fieldKey]: chosen });
    }
    return;
  }

  // ── Multi-select toggle ────────────────────────────────────────────────────

  if (data.startsWith("ms|")) {
    const [, fieldKey, rawIdx] = data.split("|");
    const field = findFieldByKey(fieldKey);
    if (field?.options) {
      const option = field.options[parseInt(rawIdx)];
      if (!state.multiSelectTemp[fieldKey]) state.multiSelectTemp[fieldKey] = [];
      const cur = state.multiSelectTemp[fieldKey];
      const idx = cur.indexOf(option);
      if (idx >= 0) cur.splice(idx, 1); else cur.push(option);
      try {
        await ctx.editMessageReplyMarkup({
          reply_markup: buildMultiSelectKeyboard(fieldKey, field.options, cur),
        });
      } catch {}
    }
    return;
  }

  // ── Multi-select Done ──────────────────────────────────────────────────────

  if (data.startsWith("msd|")) {
    const fieldKey = data.split("|")[1];
    const selections = state.multiSelectTemp[fieldKey] || [];
    state.data[fieldKey] = selections;
    delete state.multiSelectTemp[fieldKey];
    addToHistory(state, "User", selections.length > 0 ? selections.join(", ") : "None");
    try { await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }); } catch {}
    await simulateTyping(ctx, 600);
    await processAfterFieldUpdate(ctx, state, { [fieldKey]: selections });
    return;
  }

  // ── Skip photos ────────────────────────────────────────────────────────────

  if (data === "skip_photos") {
    state.awaitingPhoto = null;
    ["photoFront", "photoBack", "photoLeftSide", "photoRightSide"].forEach(k => {
      if (!state.data[k]) state.data[k] = "skipped";
    });
    await ctx.reply("no problem! you can always send photos directly to your coach later 📸\nlet's keep going!");

    const advancement = advance(state);
    const nextSection = getCurrentSection(state);

    if (advancement === "complete" || nextSection?.id === "review-submit") {
      await showReview(ctx, state);
      return;
    }
    if (nextSection) {
      const ngf = getCurrentGroupFields(state);
      await simulateTyping(ctx, 1200);
      let transMsg = `alright, moving on to ${nextSection.name.toLowerCase()}!`;
      try {
        const tc = fillTemplate(TRANSITION_PROMPT, {
          botName: BOT_NAME,
          fromSection: "Full Body Photos",
          toSection: nextSection.name,
          toSectionDescription: nextSection.description,
          userProfile: buildUserProfile(state),
          conversationHistory: buildConversationHistory(state, 4),
          firstQuestions: buildFieldDefinitions(ngf),
        });
        transMsg = await generateTransition(tc, "Generate transition.");
      } catch {}
      const firstMissing = ngf.find(f => !state.data[f.key]);
      await sendBotMessage(ctx, state, transMsg, getKeyboardForField(firstMissing));
      await delay(300);
      await ctx.reply(`📊  ${getProgressText(state)}`);
    }
    return;
  }

  // ── Review: confirm submit ─────────────────────────────────────────────────

  if (data === "confirm_submit") {
    await handleConfirmSubmit(ctx, state);
    return;
  }

  // ── Review: edit request ───────────────────────────────────────────────────

  if (data === "edit_request") {
    try { await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }); } catch {}
    await ctx.reply(
      "sure! just tell me what you'd like to change\n" +
      "e.g. \"my weight is actually 72\" or \"I'm vegetarian not vegan\" 😊\n\n" +
      "or type /restart to redo everything from scratch"
    );
    addToHistory(state, "Bot", "Asked user what they want to change at review.");
    return;
  }

  }); // end withLock
}

// ---------------------------------------------------------------------------
// Photo handler
// ---------------------------------------------------------------------------

export async function handlePhoto(ctx) {
  const chatId = ctx.chat.id;
  const state  = getState(chatId);

  if (!state.awaitingPhoto) {
    await simulateTyping(ctx, 600);
    await ctx.reply("thanks for the photo! but I'm not expecting one right now 😅\nlet's continue our chat!");
    return;
  }

  const photos = ctx.message?.photo;
  if (!photos?.length) {
    await ctx.reply("hmm, I couldn't get that photo. could you try sending it again?");
    return;
  }

  // React to photo with love
  await reactToMessage(ctx, REACTIONS.love);

  const bestPhoto = photos[photos.length - 1];
  const photoKey  = state.awaitingPhoto;
  state.data[photoKey] = bestPhoto.file_id;
  state.awaitingPhoto  = null;
  addToHistory(state, "User", `[Sent ${photoKey} photo]`);

  const photoFields = ["photoFront", "photoBack", "photoLeftSide", "photoRightSide"];
  const nextPhotoKey = photoFields[photoFields.indexOf(photoKey) + 1];

  if (nextPhotoKey) {
    state.awaitingPhoto = nextPhotoKey;
    await simulateTyping(ctx, 1000);
    const typeKey = nextPhotoKey.replace("photo", "").replace(/^./, c => c.toLowerCase());
    const msg = PHOTO_PROMPT(typeKey);
    const skipKb = new InlineKeyboard().text("Skip remaining photos →", "skip_photos");
    await ctx.reply(msg, { reply_markup: skipKb });
    addToHistory(state, "Bot", msg);
  } else {
    await simulateTyping(ctx, 1000);
    await sendSticker(ctx, "muscle");
    await sendBotMessage(ctx, state, "all 4 photos received! 📸 you're doing great, almost there!");

    const advancement = advance(state);
    const nextSection = getCurrentSection(state);

    if (nextSection?.id === "review-submit") { await showReview(ctx, state); return; }

    if (advancement === "next-section" && nextSection) {
      const ngf = getCurrentGroupFields(state);
      await simulateTyping(ctx, 1500);
      let transMsg = `photos saved! now just a few quick questions about ${nextSection.name.toLowerCase()}...`;
      try {
        const tc = fillTemplate(TRANSITION_PROMPT, {
          botName: BOT_NAME,
          fromSection: "Full Body Photos",
          toSection: nextSection.name,
          toSectionDescription: nextSection.description,
          userProfile: buildUserProfile(state),
          conversationHistory: buildConversationHistory(state, 4),
          firstQuestions: buildFieldDefinitions(ngf),
        });
        transMsg = await generateTransition(tc, "Generate transition.");
      } catch {}
      const firstMissing = ngf.find(f => !state.data[f.key]);
      await sendBotMessage(ctx, state, transMsg, getKeyboardForField(firstMissing));
      await delay(300);
      await ctx.reply(`📊  ${getProgressText(state)}`);
    } else if (advancement === "complete") {
      await showReview(ctx, state);
    }
  }
}

// ---------------------------------------------------------------------------
// Photo section intro
// ---------------------------------------------------------------------------

async function sendPhotoSectionIntro(ctx, state) {
  await simulateTyping(ctx, 1500);

  // Privacy notice before photos
  await ctx.reply(
    "before we do photos —\n\n" +
    "📸 stored encrypted\n" +
    "🔒 only your coach can view them\n" +
    "❌ never shared or used for marketing\n\n" +
    "coaches who see photos give 3x more accurate plans\n" +
    "totally your call though 🙏"
  );
  await delay(800);

  const msg =
    "okay! I need 4 full-body photos 📸\n\n" +
    "stand at arm's length, full-length shots\n" +
    "a casual mirror selfie is perfect — no need to pose\n\n" +
    "let's start with a *front-facing* photo";

  state.awaitingPhoto = "photoFront";
  const skipKb = new InlineKeyboard().text("Skip photos for now →", "skip_photos");
  await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: skipKb });
  addToHistory(state, "Bot", msg);
}

// ---------------------------------------------------------------------------
// Review & Submit
// ---------------------------------------------------------------------------

async function showReview(ctx, state) {
  state.currentSectionIndex = SECTIONS.length - 1;
  state.currentGroupIndex   = 0;

  await simulateTyping(ctx, 2000);
  const summary  = formatSummaryForTelegram(state.data, SECTIONS);
  const messages = splitMessages(summary, 4000);

  await ctx.reply("that's everything! here's a summary of what you've told me 👇");
  await delay(800);

  for (const msg of messages) {
    await simulateTyping(ctx, 1000);
    try { await ctx.reply(msg, { parse_mode: "HTML" }); } catch { await ctx.reply(msg); }
    await delay(500);
  }

  await delay(600);
  const confirmKb = new InlineKeyboard()
    .text("✅  Looks good — submit!", "confirm_submit").row()
    .text("✏️  I want to change something", "edit_request");

  await ctx.reply("does everything look correct? 🧐", { reply_markup: confirmKb });
  addToHistory(state, "Bot", "[Showed summary — awaiting confirmation]");
}

async function handleConfirmSubmit(ctx, state) {
  if (state.completed) return;
  state.completed = true;

  try { await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }); } catch {}

  await simulateTyping(ctx, 1200);
  await ctx.reply(
    `you're all set! 🎉\n\n` +
    `thanks for taking the time to chat, ${state.data.fullName || ""}!\n` +
    `your coach will review everything and be in touch soon\n\n` +
    `welcome to the Mealzy family! 💚`
  );

  // Personality tag + next steps + referral
  await sendClosingSequence(ctx, state);

  // Forward to coach
  if (FORWARD_CHAT_ID) {
    try {
      const summary = formatSummaryForTelegram(state.data, SECTIONS);
      const header =
        `🆕 <b>New Onboarding Completed</b>\n` +
        `User: ${state.data.fullName || "Unknown"}\n` +
        `Telegram ID: ${state.chatId}\n` +
        `Date: ${new Date().toLocaleString("en-IN")}\n\n`;

      for (const msg of splitMessages(header + summary, 4000)) {
        try { await ctx.api.sendMessage(FORWARD_CHAT_ID, msg, { parse_mode: "HTML" }); }
        catch { await ctx.api.sendMessage(FORWARD_CHAT_ID, msg); }
      }

      for (const key of ["photoFront", "photoBack", "photoLeftSide", "photoRightSide"]) {
        if (state.data[key] && state.data[key] !== "skipped") {
          try {
            const label = key.replace("photo", "").replace(/([A-Z])/g, " $1").trim();
            await ctx.api.sendPhoto(FORWARD_CHAT_ID, state.data[key], {
              caption: `📸 ${label} — ${state.data.fullName || "User"}`,
            });
          } catch (err) { console.error(`[Forward] Photo ${key}:`, err.message); }
        }
      }
    } catch (err) { console.error("[Forward] Failed:", err.message); }
  }

  addToHistory(state, "Bot", "[Onboarding completed]");
}

async function handleReviewResponse(ctx, state, userMessage) {
  const lower = userMessage.toLowerCase();
  const yes = ["yes","yeah","yep","looks good","perfect","confirm","submit","done","ok","okay","haan","ha","sahi","theek","👍","all good"];
  if (yes.some(w => lower.includes(w))) {
    await handleConfirmSubmit(ctx, state);
  } else {
    await simulateTyping(ctx, 1000);
    await ctx.reply(
      "no problem! just tell me what you'd like to update\n" +
      "e.g. \"my weight is 72kg\" or \"I'm actually vegetarian\" 😊\n\n" +
      "or type /restart to redo everything"
    );
    addToHistory(state, "Bot", "Asked user what they want to change.");
  }
}

// ---------------------------------------------------------------------------
// Nudge system
// ---------------------------------------------------------------------------

export async function nudgeInactiveUsers(bot) {
  const now = Date.now();
  for (const [chatId, state] of userStates.entries()) {
    if (state.completed) continue;
    if (!state.committed) continue; // don't nudge uncommitted users
    if (state.nudgeSentAt && now - state.nudgeSentAt < 24 * 60 * 60 * 1000) continue;
    if (now - state.lastActivity < NUDGE_AFTER_MS) continue;

    try {
      const name = state.data.fullName ? `, ${state.data.fullName.split(" ")[0]}` : "";
      await bot.api.sendMessage(
        chatId,
        `hey${name}! 👋\n\n` +
        `you were in the middle of your Mealzy onboarding — just checking in!\n\n` +
        `📊  ${getProgressText(state)}\n\n` +
        `just send any message to pick up right where you left off 😊`
      );
      state.nudgeSentAt = now;
      console.log(`[Nudge] Sent to ${chatId}`);
    } catch (err) {
      console.error(`[Nudge] Failed for ${chatId}:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Utility: send message with optional keyboard
// ---------------------------------------------------------------------------

async function sendBotMessage(ctx, state, text, replyMarkup = null) {
  const chunks = splitMessages(text, 4000);
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await simulateTyping(ctx, calculateTypingDelay(chunks[i]));
    const opts = {};
    if (i === chunks.length - 1 && replyMarkup) opts.reply_markup = replyMarkup;
    await ctx.reply(chunks[i], opts);
    if (i < chunks.length - 1) await delay(400);
  }
  addToHistory(state, "Bot", text);
}
