// Configuración de horas de trabajo
export const WORKING_HOURS = {
  DEFAULT_ENTRY_TIME: '06:30',
  DEFAULT_EXIT_TIME: '16:00',
  DEFAULT_LUNCH_DURATION: 30, // minutos
  DEFAULT_WORKING_HOURS: 8,
  
  // Horarios especiales por área
  POSTCOSECHA: {
    ENTRY_TIME: '07:00',
    EXIT_TIME: '17:00'
  }
};

// Tasas de horas extras
export const EXTRA_HOURS_RATES = {
  NIGHT: 0.25,        // 25% - 19:00 a 06:00
  SUPPLEMENTARY: 0.5,  // 50% - L-V después de jornada
  EXTRAORDINARY: 1.0   // 100% - Sábados, domingos y feriados
};

// Tipos de alimentación
export const FOOD_TYPES = {
  D: 'Desayuno',
  DR: 'Desayuno Reforzado',
  R1: 'Refrigerio',
  MR: 'Merienda',
  S: 'Seco',
  A: 'Almuerzo'
};

// Roles del sistema
export const ROLES = {
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER'
};

// Configuración de período mensual
export const MONTHLY_PERIOD = {
  START_DAY: 26,
  END_DAY: 25
};
