/**
 * HUMAN BOT - Talk like a real 26-year-old girl texting, not a bot
 * Focus: Natural conversation, warmth, personality, zero corporate vibes
 */

/**
 * Get a HUMAN response that sounds like someone actually texting
 */
export function getHumanResponse(userMessage, userName, userProfile, currentField, lastExtracted) {
  const msg = userMessage.toLowerCase().trim();

  // ═══════════════════════════════════════════════════════════════════
  // HANDLE PLAYFULNESS - Don't ignore it, ENGAGE with it
  // ═══════════════════════════════════════════════════════════════════

  if (msg === "guess" || msg === "guess my name" || msg === "pls guess") {
    return `lol okay you're testing me 😄 come on yaar, what's your actual name? first and last`;
  }

  if (msg.includes("guess") && msg.length < 15) {
    return `haha alright alright, you're funny 😄 but seriously, what's your name?`;
  }

  // ═══════════════════════════════════════════════════════════════════
  // ACKNOWLEDGE WHAT THEY SAID, THEN ASK NEXT
  // ═══════════════════════════════════════════════════════════════════

  // They gave their name
  if (currentField && currentField.key === "fullName" && msg.length > 2 && !msg.includes("why") && !msg.includes("guess")) {
    const extractedName = extractNameFromMessage(msg);
    if (extractedName) {
      return `nice ${extractedName}! 👍 how old are you?`;
    }
  }

  // They gave age
  if (currentField && currentField.key === "age" && /^\d+$/.test(msg)) {
    return `${msg}? cool, got it. what's your height in cm?`;
  }

  // They said they work/profession
  if (msg.includes("work") || msg.includes("job") || msg.includes("software") || msg.includes("engineer")) {
    if (userName) {
      return `alright so ${userName} you've got that going on 💼 when do you usually have time to work out? early mornings, lunch, evenings?`;
    }
    return `okay so you work — got it. when do you usually have time for anything fitness-related? mornings, evenings?`;
  }

  // They said they're busy
  if (msg.includes("busy") || msg.includes("no time") || msg.includes("tight schedule")) {
    return `yeah that's real, a lot of people are. but like, is it 9-5 work, or actual busy with family and stuff?`;
  }

  // They mentioned sleep
  if (msg.includes("sleep") || msg.includes("hour")) {
    const hours = extractNumber(msg);
    if (hours) {
      if (hours < 6) {
        return `${hours} hours? that's rough yaar. that's actually really important for your plan — cortisol hits different when you're exhausted`;
      }
      if (hours >= 8) {
        return `${hours} hours? that's solid! means recovery is good, we can definitely work with that`;
      }
      return `${hours} hours okay, that's normal-ish. helps me understand your rhythm`;
    }
  }

  // They mentioned stress
  if (msg.includes("stress") || msg.includes("anxiety") || msg.includes("pressure")) {
    return `yeah stress is real. on a scale of 1-10, how stressed are you actually? like 3 or 8?`;
  }

  // They said diet/food stuff
  if (msg.includes("veg") || msg.includes("meat") || msg.includes("diet") || msg.includes("food")) {
    if (msg.includes("veg")) {
      return `okay vegetarian — but do you eat eggs? matters for protein targets`;
    }
    if (msg.includes("non-veg") || msg.includes("non veg")) {
      return `non-veg is good, makes protein targets way easier 👍`;
    }
    return `alright so that's your food situation. do you actually cook or mostly eat out?`;
  }

  // They said they don't cook
  if (msg.includes("don't cook") || msg.includes("no time to cook") || msg.includes("can't cook")) {
    return `yeah that's common, a lot of people don't. so you eat out mostly, or like delivery and ready-made?`;
  }

  // They mentioned their goal
  if (msg.includes("lose") && msg.includes("kg")) {
    const kg = extractNumber(msg);
    if (kg) {
      return `${kg}kg — okay got it. realistic timeline for you is how long? 3 months, 6 months?`;
    }
  }

  if (msg.includes("abs") || msg.includes("muscle") || msg.includes("fit")) {
    return `okay so that's the goal. what's making you want that? like confidence, dating, health, competition?`;
  }

  // They asked WHY
  if (msg.includes("why") && (msg.includes("why tell") || msg.includes("why should") || msg.includes("necessary"))) {
    return `fair question 😄 knowing you helps me make your plan personal, not generic. that's it`;
  }

  // They're being vague
  if (msg === "okay" || msg === "yeah" || msg === "sure" || msg === "maybe") {
    return `haha okay but like... what's the actual answer? 😄`;
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEFAULT: Acknowledge + Ask next smart question
  // ═══════════════════════════════════════════════════════════════════

  if (userName && currentField) {
    const fieldKey = currentField.key;

    // Make it personal
    if (fieldKey === "weightKg") {
      return `${userName}, what's your current weight in kg?`;
    }
    if (fieldKey === "heightCm") {
      return `how tall are you in cm?`;
    }
    if (fieldKey === "profession") {
      return `what do you do for work?`;
    }
    if (fieldKey === "daysActive") {
      return `how many days a week do you actually work out? be honest`;
    }
    if (fieldKey === "stressLevel") {
      return `on a scale of 1-10, stress level?`;
    }
    if (fieldKey === "sleepHoursPerNight") {
      return `how many hours do you sleep usually?`;
    }
  }

  // Fallback - just be warm
  return `alright got it 👍 what's next?`;
}

/**
 * Extract name from message like "harsh rathi" or just "harsh"
 */
function extractNameFromMessage(msg) {
  // Remove common words
  const cleaned = msg
    .replace(/guess|my|name|is|it's|it is|call|called|i'm/gi, "")
    .trim();

  if (cleaned.length > 0) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return null;
}

/**
 * Extract number from message like "70 kg" or "around 70"
 */
function extractNumber(msg) {
  const match = msg.match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

/**
 * Check if this is a real answer (not evasion/playfulness/skip)
 */
export function isRealAnswer(msg, fieldKey) {
  const lower = msg.toLowerCase();

  // Skip phrases
  if (/skip|idk|no idea|not sure|don't know|rather not|pass/.test(lower)) {
    return false;
  }

  // Evasion (why, necessary, etc)
  if (/^why|necessary|should i|do i have|need to$/.test(lower)) {
    return false;
  }

  // Just one word of playfulness
  if (/^guess$|^lol$|^haha$|^jk$/.test(lower) && msg.length < 10) {
    return false;
  }

  // If there's actual content, it's real
  if (msg.length > 2) {
    return true;
  }

  return false;
}

/**
 * Give insight only when relevant (don't overdo it)
 */
export function giveRelevantInsight(msg, fieldKey) {
  const lower = msg.toLowerCase();

  // Sleep insight
  if ((fieldKey === "sleepHoursPerNight" || lower.includes("sleep")) && lower.includes("4")) {
    return "you're losing way more fat on 7+ hours sleep — it actually changes metabolism";
  }

  if ((fieldKey === "sleepHoursPerNight" || lower.includes("sleep")) && lower.includes("5")) {
    return "5 hours is rough — sleep literally affects fat loss. try to get 7+ if you can";
  }

  // Stress insight
  if ((fieldKey === "stressLevel" || lower.includes("stress")) && (lower.includes("8") || lower.includes("9"))) {
    return "that stress level means cortisol is probably holding your fat — we need to address that";
  }

  // Vegetarian insight
  if (lower.includes("vegetarian")) {
    return "veg is totally fine but protein needs to be smart — we'll figure that out";
  }

  // Busy/no time insight
  if ((lower.includes("busy") || lower.includes("no time")) && fieldKey === "daysActive") {
    return "most busy people still find 20-30 mins a few days a week — it's about fitting your life, not changing it";
  }

  // No cooking insight
  if (lower.includes("don't cook") || lower.includes("no time to cook")) {
    return "people who don't cook usually underestimate portions — we'll work around that";
  }

  return null;
}

/**
 * Special handling for EVASION (why they're asking why)
 */
export function handleEvasion(fieldKey) {
  if (fieldKey === "fullName") {
    return `honestly yeah, knowing your name helps me make your plan actually personal — promise it's not random`;
  }

  if (fieldKey === "age" || fieldKey === "weightKg" || fieldKey === "heightCm") {
    return `these ones help me calculate calories and stuff specific to YOU, not generic`;
  }

  if (fieldKey === "sleepHoursPerNight") {
    return `sleep is like 50% of fat loss — cortisol is real. need to know this`;
  }

  if (fieldKey === "stressLevel") {
    return `stress literally makes your body hold fat. not being dramatic, that's biology`;
  }

  if (fieldKey === "profession" || fieldKey === "daysActive") {
    return `helps me understand your life so the plan actually fits, not some idealized version`;
  }

  return `the better i know you, the better your plan 👍`;
}

/**
 * Make sure next question references what they said
 */
export function makeContextualQuestion(fieldKey, userProfile, lastThing) {
  const profession = userProfile.profession || "";
  const age = userProfile.age || 0;
  const isStudent = profession.toLowerCase().includes("student");
  const isDesk = profession.toLowerCase().includes("desk") || profession.toLowerCase().includes("office");

  // If they mentioned desk job, ask about exercise timing specifically
  if (isDesk && fieldKey === "daysActive") {
    return `with a desk job, when do you actually train? mornings before work, lunch break, evenings?`;
  }

  // If young/student, ask about college stress
  if (isStudent && fieldKey === "stressLevel") {
    return `college usually stresses people out — where are you at? 1-10?`;
  }

  // Default questions that still feel personal
  const defaults = {
    fullName: "what's your full name? first and last",
    age: "how old are you?",
    heightCm: "how tall? in cm",
    weightKg: "current weight in kg?",
    profession: "what do you do?",
    stressLevel: "stress level 1-10?",
    sleepHoursPerNight: "hours you sleep usually?",
    daysActive: "how many days a week do you work out?",
    dietaryPreference: "veg, non-veg, or vegan?",
  };

  return defaults[fieldKey] || "tell me about that?";
}
