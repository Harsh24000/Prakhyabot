/**
 * Health & fitness calculations for Mealzy onboarding bot.
 * BMR: Mifflin-St Jeor equation (most accurate for general population)
 */

export function calculateBMR(weightKg, heightCm, age, biologicalSex) {
  const w = parseFloat(weightKg);
  const h = parseFloat(heightCm);
  const a = parseFloat(age);
  if (isNaN(w) || isNaN(h) || isNaN(a)) return null;

  if (biologicalSex === 'Male') {
    return Math.round(10 * w + 6.25 * h - 5 * a + 5);
  }
  return Math.round(10 * w + 6.25 * h - 5 * a - 161);
}

export function calculateTDEE(bmr, activityLevel = 'sedentary') {
  if (!bmr) return null;
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    veryActive: 1.9,
  };
  return Math.round(bmr * (multipliers[activityLevel] || 1.2));
}

export function calculateBMI(weightKg, heightCm) {
  const h = parseFloat(heightCm) / 100;
  const w = parseFloat(weightKg);
  if (isNaN(h) || isNaN(w) || h === 0) return null;
  return parseFloat((w / (h * h)).toFixed(1));
}

export function getBMICategory(bmi) {
  if (!bmi) return null;
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'healthy range';
  if (bmi < 30) return 'slightly above normal';
  return 'above normal';
}

/**
 * Personality tag based on collected onboarding data.
 */
export function getPersonalityTag(data) {
  const {
    resistanceTraining, daysActive, stressLevel,
    dietaryPreference, pastAttempts,
  } = data;

  const isAdvanced = resistanceTraining?.toLowerCase().includes('advanced');
  const isIntermediate = resistanceTraining?.toLowerCase().includes('intermediate');
  const isActive = parseInt(daysActive) >= 4;
  const isHighStress = parseInt(stressLevel) >= 7;
  const isVeg = dietaryPreference === 'Vegetarian' || dietaryPreference === 'Vegan';
  const hasTried = pastAttempts && String(pastAttempts).length > 20;

  if ((isAdvanced || isIntermediate) && isActive) {
    return {
      tag: 'The Dedicated Athlete 🏋️',
      description: "you've already built the discipline — you just need the right direction to break through your plateau",
    };
  }
  if (isHighStress && !isActive) {
    return {
      tag: 'The Overwhelmed Go-Getter 🚀',
      description: "you want results badly but life keeps getting in the way — that's literally what we specialise in fixing",
    };
  }
  if (hasTried) {
    return {
      tag: 'The Smart Restarter 🔄',
      description: "knowing what hasn't worked is actually an advantage — we won't repeat those mistakes",
    };
  }
  if (isVeg) {
    return {
      tag: 'The Mindful Mover 🌱',
      description: "conscious choices all around — we'll make your nutrition work even harder for your goals",
    };
  }
  return {
    tag: 'The Consistent Starter 🏃',
    description: "you know what to do — you just need the right structure to finally make it stick. that's the whole point of this",
  };
}
