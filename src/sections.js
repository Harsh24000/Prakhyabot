/**
 * @file sections.js
 * @description Defines all 13 onboarding sections for the Mealzy nutrition/fitness
 * chatbot on Telegram.
 */

const SECTIONS = [
  {
    id: 'about-you',
    name: 'About You',
    description: 'Collect basic personal information — name, age, body metrics, profession, and biological sex.',
    fields: [
      { key: 'fullName', question: "What's your full name?", type: 'text', examples: 'Rahul Sharma', required: true },
      { key: 'age', question: 'Age', type: 'number', examples: '28', required: true },
      { key: 'heightCm', question: 'Current Height (cm)', type: 'number', examples: '170', required: true },
      { key: 'weightKg', question: 'Current Weight (kg)', type: 'number', examples: '70', required: true },
      { key: 'profession', question: "What's your profession?", type: 'text', examples: 'Software Engineer, Doctor, Student', required: true },
      { key: 'biologicalSex', question: 'Biological Sex', type: 'select', options: ['Male', 'Female', 'Other'], required: true },
    ],
    grouping: [['fullName'], ['age', 'profession'], ['heightCm', 'weightKg'], ['biologicalSex']],
    transitionHint: 'Transition from basic info to diet and food preferences',
  },

  {
    id: 'diet-food',
    name: 'Diet & Food',
    description: 'Understand dietary identity and food preferences.',
    fields: [
      { key: 'dietaryPreference', question: "What's your dietary preference?", type: 'select', options: ['Non-Vegetarian', 'Vegetarian', 'Eggetarian', 'Vegan', 'Jain'], required: true },
      { key: 'foodsToAvoid', question: 'Any foods you dislike or avoid?', type: 'multiselect', options: ['Bitter gourd', 'Eggplant', 'Mushroom', 'Okra', 'Capsicum', 'Onion', 'Garlic', 'Fish', 'Egg', 'Dairy'], required: false },
      { key: 'cuisinesEnjoyed', question: 'What cuisines do you enjoy?', type: 'multiselect', options: ['North Indian', 'South Indian', 'Bengali', 'Gujarati', 'Maharashtrian', 'Continental', 'Chinese', 'Italian', 'Mexican', 'Japanese', 'Thai', 'Mediterranean'], required: false },
    ],
    grouping: [['dietaryPreference'], ['foodsToAvoid'], ['cuisinesEnjoyed']],
    transitionHint: 'Move from food preferences to understanding their daily routine',
  },

  {
    id: 'your-day',
    name: 'Your Day',
    description: 'Capture daily schedule, eating patterns, and weekend habits.',
    fields: [
      { key: 'dailyRoutine', question: 'Describe your current daily routine', type: 'longtext', examples: 'Wake up 7am, breakfast 8am, office 9-6pm, gym 7pm, dinner 9pm, sleep 11pm', required: true },
      { key: 'currentDiet', question: 'Describe your current diet', type: 'longtext', examples: 'Breakfast - poha with chai, Lunch - dal chawal, Dinner - roti sabzi', required: true },
      { key: 'averageWeekend', question: 'Describe your average weekend', type: 'longtext', examples: 'Sleep in till 10, brunch out, Netflix afternoon, evening out', required: true },
    ],
    grouping: [['dailyRoutine'], ['currentDiet'], ['averageWeekend']],
    transitionHint: 'Transition from daily routine to health conditions',
  },

  {
    id: 'health',
    name: 'Health',
    description: 'Screen for medical conditions, allergies, medications, and injuries.',
    fields: [
      { key: 'conditions', question: 'Do you have any of these conditions?', type: 'multiselect', options: ['Diabetes', 'Thyroid', 'PCOS/PCOD', 'Hypertension', 'High Cholesterol', 'Fatty Liver', 'None of the above'], required: true },
      { key: 'allergies', question: 'Do you have any allergies or food intolerances?', type: 'longtext', examples: 'Lactose intolerant, allergic to peanuts', required: false },
      { key: 'medications', question: 'Are you currently on any medication?', type: 'longtext', examples: 'Thyroid medication, Vitamin D supplements', required: false },
      { key: 'digestiveIssues', question: 'Do you face any digestive issues?', type: 'text', examples: 'Bloating, acidity, constipation', required: false },
      { key: 'injuries', question: 'Do you have any injuries or physical limitations?', type: 'text', examples: 'Lower back pain, shoulder injury', required: false },
    ],
    grouping: [['conditions'], ['allergies', 'medications'], ['digestiveIssues', 'injuries']],
    transitionHint: 'Move from health to supplements and lifestyle habits',
  },

  {
    id: 'supplements-habits',
    name: 'Supplements & Habits',
    description: 'Understand supplements, protein history, smoking, alcohol, eating-out frequency.',
    fields: [
      { key: 'currentSupplements', question: 'Do you currently use any supplements?', type: 'longtext', examples: 'Multivitamin, fish oil, Vitamin D3', required: false },
      { key: 'proteinSupplementHistory', question: 'Have you used a protein supplement before?', type: 'text', examples: 'Yes, ON Gold Standard for 6 months', required: false },
      { key: 'smoking', question: 'Do you smoke?', type: 'select', options: ['No', 'Occasionally', 'Regularly'], required: true },
      { key: 'alcohol', question: 'Do you drink alcohol?', type: 'select', options: ['No', 'Occasionally', 'Regularly'], required: true },
      { key: 'eatingOutFrequency', question: 'How often do you eat out?', type: 'text', examples: '2-3 times a week, mostly weekends', required: false },
    ],
    grouping: [['currentSupplements', 'proteinSupplementHistory'], ['smoking', 'alcohol'], ['eatingOutFrequency']],
    transitionHint: 'Transition from habits to sleep and stress levels',
  },

  {
    id: 'sleep-stress',
    name: 'Sleep & Stress',
    description: 'Assess sleep quality, stress levels, and mental wellness.',
    fields: [
      { key: 'stressLevel', question: 'How would you rate your daily stress levels?', type: 'scale', options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], required: true },
      { key: 'sleepQuality', question: 'How would you rate your sleep quality?', type: 'scale', options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], required: true },
      { key: 'restlessSleep', question: 'Is your sleep restless?', type: 'yesno', required: true },
      { key: 'wakeUpRefreshed', question: 'Do you wake up feeling refreshed?', type: 'yesno', required: true },
      { key: 'meditate', question: 'Do you meditate?', type: 'yesno', required: true },
      { key: 'majorStressors', question: 'What are your major stressors?', type: 'longtext', examples: 'Work deadlines, financial stress, family issues', required: false },
    ],
    grouping: [['stressLevel', 'sleepQuality'], ['restlessSleep', 'wakeUpRefreshed', 'meditate'], ['majorStressors']],
    transitionHint: 'Move from mental wellness to physical fitness',
  },

  {
    id: 'fitness',
    name: 'Fitness',
    description: 'Gauge current activity level, training experience, workout preferences.',
    fields: [
      { key: 'daysActive', question: 'How many days a week are you physically active?', type: 'number', required: true },
      { key: 'resistanceTraining', question: 'How many years of resistance training experience do you have?', type: 'select', options: ['None - No resistance training', 'Beginner - Less than 6 months', 'Intermediate - 6 months to 2 years', 'Advanced - 2+ years'], required: true },
      { key: 'currentWorkouts', question: 'What do your current workouts look like?', type: 'longtext', examples: 'Push/Pull/Legs 4x/week, 20 min cardio after', required: false },
      { key: 'otherActivities', question: 'What other activities do you enjoy?', type: 'text', examples: 'Cricket, evening walks, swimming', required: false },
      { key: 'sittingHours', question: 'How many hours do you spend sitting per day?', type: 'text', examples: '8-10 hours, desk job', required: false },
      { key: 'workoutLocation', question: 'Where do you prefer to work out?', type: 'select', options: ['Gym', 'Home', 'Both', 'Outdoors'], required: true },
    ],
    grouping: [['daysActive', 'resistanceTraining'], ['currentWorkouts', 'otherActivities'], ['sittingHours', 'workoutLocation']],
    transitionHint: 'Transition from fitness to food and cooking habits',
  },

  {
    id: 'food-cooking',
    name: 'Food & Cooking',
    description: 'Understand meal management, quality extremes, and cravings.',
    fields: [
      { key: 'mealManagement', question: 'Do you have someone who cooks for you?', type: 'longtext', examples: 'Mom cooks lunch and dinner, I make breakfast', required: true },
      { key: 'goodEatingDay', question: 'How would you describe a really good eating day?', type: 'longtext', examples: 'All home-cooked, protein in every meal, no snacking', required: true },
      { key: 'badEatingDay', question: 'How would you describe a really bad eating day?', type: 'longtext', examples: 'Skip breakfast, order pizza, heavy dinner at 11pm', required: true },
      { key: 'foodWeighingScale', question: 'Do you own a food weighing scale?', type: 'yesno', required: true },
      { key: 'foodWishlist', question: 'List the foods you want in your plan', type: 'longtext', examples: 'Paneer, chicken breast, eggs, peanut butter, oats', required: false },
      { key: 'sweetCravings', question: 'Do you struggle with sweet cravings?', type: 'longtext', examples: 'Yes, after dinner around 10pm', required: false },
    ],
    grouping: [['mealManagement'], ['goodEatingDay', 'badEatingDay'], ['foodWeighingScale', 'foodWishlist'], ['sweetCravings']],
    transitionHint: 'Move from cooking habits to their goals and motivation',
  },

  {
    id: 'your-goals',
    name: 'Your Goals',
    description: 'Deep-dive into fitness aspirations, motivation, and barriers.',
    fields: [
      { key: 'fitnessGoals', question: 'Describe your fitness goals', type: 'longtext', examples: 'Lose 10kg body fat, build muscle definition', required: true },
      { key: 'bodyType', question: 'What kind of body are you working toward?', type: 'longtext', examples: 'Lean and athletic, visible abs', required: false },
      { key: 'timeline', question: 'How much time do you want to achieve this in?', type: 'text', examples: '6 months ideally', required: false },
      { key: 'whyAchieve', question: 'Why do you want to achieve this goal?', type: 'longtext', examples: 'Feel confident, have more energy', required: true },
      { key: 'pastAttempts', question: 'Have you tried to achieve this before?', type: 'longtext', examples: 'Tried keto for 3 months, lost 5kg but gained it back', required: false },
      { key: 'coachExperience', question: 'Have you worked with a coach before?', type: 'text', examples: 'Yes, online coach for 2 months', required: false },
      { key: 'biggestBarrier', question: 'What is your biggest barrier?', type: 'longtext', examples: 'Frequent travel, social dinners, sweet tooth', required: true },
      { key: 'performanceGoals', question: 'Do you have any performance goals?', type: 'text', examples: 'Run 5K under 30 min, deadlift 100kg', required: false },
      { key: 'healthAffectingLife', question: 'Does your current health status affect your life quality?', type: 'longtext', examples: 'Low energy after lunch, joint pain', required: false },
      { key: 'feelIfAchieve', question: 'How will you feel if you achieve this?', type: 'longtext', examples: 'Confident, proud, at peace with my body', required: false },
      { key: 'feelIfDont', question: 'How will you feel if you do not?', type: 'longtext', examples: 'Disappointed, frustrated, worried', required: false },
    ],
    grouping: [['fitnessGoals', 'bodyType'], ['timeline', 'whyAchieve'], ['pastAttempts', 'coachExperience'], ['biggestBarrier'], ['performanceGoals', 'healthAffectingLife'], ['feelIfAchieve', 'feelIfDont']],
    transitionHint: 'Transition from goals to commitment level',
  },

  {
    id: 'commitment',
    name: 'Commitment',
    description: 'Gauge willingness to commit to training, diet changes, and lifestyle.',
    fields: [
      { key: 'trainingDaysPerWeek', question: 'How many days per week are you willing to commit to training?', type: 'number', required: true },
      { key: 'willingToReduceEatingOut', question: 'Are you willing to stop or reduce eating out?', type: 'yesno', required: true },
      { key: 'willingToReduceDrinking', question: 'Are you willing to stop or reduce drinking?', type: 'yesno', required: true },
      { key: 'nonNegotiableFoods', question: 'What food groups are you not willing to give up?', type: 'longtext', examples: 'Rice, chai with sugar', required: false },
      { key: 'anythingElse', question: 'Is there anything else you want your coach to know?', type: 'longtext', examples: 'Wedding in 3 months, travelling next month', required: false },
    ],
    grouping: [['trainingDaysPerWeek'], ['willingToReduceEatingOut', 'willingToReduceDrinking'], ['nonNegotiableFoods'], ['anythingElse']],
    transitionHint: 'Move from commitment to body photos',
  },

  {
    id: 'full-body-photos',
    name: 'Full Body Photos',
    description: 'Collect 4 full-body photos for progress tracking.',
    fields: [
      { key: 'photoFront', question: 'Front photo', type: 'photo', required: true },
      { key: 'photoBack', question: 'Back photo', type: 'photo', required: true },
      { key: 'photoLeftSide', question: 'Left Side photo', type: 'photo', required: true },
      { key: 'photoRightSide', question: 'Right Side photo', type: 'photo', required: true },
    ],
    grouping: [['photoFront'], ['photoBack'], ['photoLeftSide'], ['photoRightSide']],
    transitionHint: 'Move from photos to daily activity tracking',
  },

  {
    id: 'daily-activity',
    name: 'Daily Activity',
    description: 'Quick snapshot of daily movement and sleep.',
    fields: [
      { key: 'smartWatch', question: 'Do you use a smart watch or fitness tracker?', type: 'yesno', required: true },
      { key: 'stepsPerDay', question: 'How many steps do you typically walk per day?', type: 'number', examples: '8000', required: true },
      { key: 'sleepHoursPerNight', question: 'How many hours do you typically sleep per night?', type: 'number', examples: '7', required: true },
    ],
    grouping: [['smartWatch', 'stepsPerDay', 'sleepHoursPerNight']],
    transitionHint: 'Final section — review and submit',
  },

  {
    id: 'review-submit',
    name: 'Review & Submit',
    description: 'Summary section for confirmation.',
    fields: [],
    grouping: [],
    transitionHint: '',
  },
];

export default SECTIONS;
