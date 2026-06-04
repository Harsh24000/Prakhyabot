/**
 * Mid-flow insights, curiosity hooks, and privacy gates.
 * These make the bot feel intelligent and deliver value during onboarding,
 * which is the #1 driver of form completion.
 */

// ---------------------------------------------------------------------------
// Section insights — shown AFTER each section completes
// Return null to skip for that section.
// ---------------------------------------------------------------------------

export const SECTION_INSIGHTS = {
  'about-you': null, // TDEE shown instead — handled in conversation.js

  'diet-food': (data) => {
    if (data.dietaryPreference === 'Vegetarian' || data.dietaryPreference === 'Vegan') {
      return "quick heads up — most vegetarians in India are protein-deficient by 30-40g/day without even realising it\nyour plan will specifically fix that 💪";
    }
    if (data.dietaryPreference === 'Non-Vegetarian') {
      return "non-veg is actually an advantage for your goals — chicken, eggs, fish make hitting protein targets way easier";
    }
    return null;
  },

  'your-day': (_data) =>
    "most people think their diet is the problem — it usually isn't\nit's the routine *around* food that's the real issue\nyou just helped me see yours 🙌",

  'health': (data) => {
    const conditions = Array.isArray(data.conditions) ? data.conditions : [data.conditions];
    if (conditions.some(c => c?.includes('Thyroid') || c?.includes('PCOS'))) {
      return "thyroid and PCOS can make weight loss feel impossible — but it's not\nyour plan will account for this specifically, not just give you generic advice";
    }
    if (conditions.includes('None of the above')) {
      return "no major conditions is honestly a big deal\nmeans we can be more aggressive with your plan without health contraindications 🎯";
    }
    return null;
  },

  'supplements-habits': (data) => {
    if (data.alcohol === 'Regularly' || data.smoking === 'Regularly') {
      return "no judgement — but alcohol and smoking do affect recovery and fat loss significantly\nyour coach will work around this realistically, not pretend it doesn't exist";
    }
    return "good — now I have a clear picture of your current habits\nthis helps us build something sustainable, not another 30-day plan that doesn't stick";
  },

  'sleep-stress': (data) => {
    const stress = parseInt(data.stressLevel) || 0;
    const sleep = parseFloat(data.sleepHoursPerNight) || 7;
    if (stress >= 7) {
      return "cortisol from chronic stress literally signals your body to store fat, especially around the belly\nfixing your stress response is part of fat loss — not separate from it";
    }
    if (sleep < 6) {
      return "people sleeping under 6hrs lose 55% less fat than those on 7-8hrs, even on the exact same diet\nthis is the most underrated part of your plan";
    }
    return "sleep and stress are the most underrated parts of any fitness plan\nyour coach factors both in — most plans ignore this completely 🙏";
  },

  'fitness': (data) => {
    const days = parseInt(data.daysActive) || 0;
    if (days >= 4) return "already active — that's genuinely rare\nmost people start at zero so you're already ahead 🔥";
    if (days === 0) return "starting from zero is actually ideal — no bad habits to undo\nyour plan will be built to slot perfectly into your current life";
    return "consistency beats intensity every time\nyour current activity level gives us a solid baseline to build from";
  },

  'food-cooking': (data) => {
    if (data.foodWeighingScale === true) {
      return "people who weigh their food lose 2x more than those who eyeball it — no joke\nyou're already set up for success with that scale 🎯";
    }
    return "now I know exactly what we're working with\nyour plan will be designed around your real life, not some ideal version of it";
  },

  'your-goals': (_data) =>
    "this section is the most important thing we just did\nthe *why* behind your goal determines whether you actually stick to it\nyour coach will come back to what you just shared 🙏",

  'commitment': (_data) => null,

  'daily-activity': (data) => {
    const steps = parseInt(data.stepsPerDay) || 0;
    if (steps < 5000) {
      return "going from 3k to 8k steps burns ~200 extra kcal/day — that's 6kg in a year just from walking\nwe'll set a step goal in your plan";
    }
    if (steps >= 8000) {
      return "solid step count 💪 NEAT (non-exercise movement) accounts for up to 30% of your total calorie burn\nyou're already using it well";
    }
    return null;
  },
};

// ---------------------------------------------------------------------------
// Curiosity hooks — teasers sent BEFORE the transition to the next section
// ---------------------------------------------------------------------------

export const CURIOSITY_HOOKS = {
  'about-you':         "next — diet and food preferences\nthis is usually where people realise why their previous attempts didn't stick 👀",
  'diet-food':         "now I want to understand your day-to-day\nmost people massively underestimate how much their routine affects their progress",
  'your-day':          "quick health check next — nothing scary, just need to make sure your plan is safe for your body specifically 🙏",
  'health':            "next part is habits — be honest, zero judgement here 😄",
  'supplements-habits':"sleep and stress next — shortest section but honestly the most underrated part of any fitness plan",
  'sleep-stress':      "now fitness — I want to understand exactly where you're starting from so we don't over or under-plan",
  'fitness':           "almost halfway! food and cooking next — this is where your plan gets really personalised 🍽️",
  'food-cooking':      "goals next — most people find this section hardest to answer but it's also the most important one 🎯",
  'your-goals':        "last real section before photos — just a few quick commitment questions, basically done",
  'commitment':        null, // photo intro handles this
  'full-body-photos':  null, // daily activity transition handles this
  'daily-activity':    null, // goes straight to review
};

// ---------------------------------------------------------------------------
// Privacy gates — shown BEFORE sensitive sections
// ---------------------------------------------------------------------------

export const PRIVACY_GATES = {
  'health': {
    message:
      "quick note before this section —\n\n" +
      "🔒 everything you share here is between you and your coach only\n" +
      "we need this to make sure your plan is safe for *your* body, not just generic\n\n" +
      "nothing leaves the platform. ever.",
    buttonText: "Got it, continue →",
    callbackData: "gate_continue_health",
  },
};
