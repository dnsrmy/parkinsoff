export const SESSION_QUESTIONNAIRE = [
  {
    id: 'sleep_hours',
    label: 'How did you sleep last night?',
    type: 'select',
    options: ['Less than 6 hours', '6–7 hours', '8 hours or more'],
    valueMap: {
      'Less than 6 hours': 4,
      '6–7 hours': 6.5,
      '8 hours or more': 8,
    },
  },
  {
    id: 'had_caffeine',
    label: 'Have you had caffeine today (coffee, tea, energy drink)?',
    type: 'boolean',
  },
  {
    id: 'had_alcohol',
    label: 'Did you consume alcohol in the last 24 hours?',
    type: 'boolean',
  },
  {
    id: 'environment',
    label: 'Is your testing environment noisy or disturbing?',
    type: 'boolean',
  },
  {
    id: 'age_65_or_older',
    label: 'Are you 65 years of age or older?',
    type: 'boolean',
  },
];
