import type { Language } from "@/store/i18nStore";

export type I18nKey =
  | "nav.dashboard"
  | "nav.punch"
  | "nav.myPunches"
  | "nav.notifications"
  | "nav.teamAttendance"
  | "nav.weeklySchedule"
  | "nav.departments"
  | "nav.teams"
  | "nav.staffRoles"
  | "nav.employees"
  | "nav.settings"
  | "action.refresh"
  | "action.logout"
  | "theme.dark"
  | "theme.light"
  | "theme.bg"
  | "theme.bg.default"
  | "theme.bg.rose"
  | "theme.bg.ocean"
  | "theme.bg.forest"
  | "theme.bg.sunset"
  | "theme.bg.violet"
  | "lang.english"
  | "lang.french"
  | "lang.spanish";

const dict: Record<Language, Record<I18nKey, string>> = {
  en: {
    "nav.dashboard": "Dashboard",
    "nav.punch": "Punch",
    "nav.myPunches": "My punches",
    "nav.notifications": "Notifications",
    "nav.teamAttendance": "Attendance",
    "nav.weeklySchedule": "Weekly schedule",
    "nav.departments": "Departments",
    "nav.teams": "Teams",
    "nav.staffRoles": "Staff & roles",
    "nav.employees": "Employees",
    "nav.settings": "Settings",
    "action.refresh": "Refresh",
    "action.logout": "Log out",
    "theme.dark": "Dark",
    "theme.light": "Light",
    "theme.bg": "Bg",
    "theme.bg.default": "Default",
    "theme.bg.rose": "Rose",
    "theme.bg.ocean": "Ocean",
    "theme.bg.forest": "Forest",
    "theme.bg.sunset": "Sunset",
    "theme.bg.violet": "Violet",
    "lang.english": "English",
    "lang.french": "Français",
    "lang.spanish": "Español",
  },
  fr: {
    "nav.dashboard": "Tableau de bord",
    "nav.punch": "Pointage",
    "nav.myPunches": "Mes pointages",
    "nav.notifications": "Notifications",
    "nav.teamAttendance": "Présences",
    "nav.weeklySchedule": "Planning hebdomadaire",
    "nav.departments": "Départements",
    "nav.teams": "Équipes",
    "nav.staffRoles": "Personnel & rôles",
    "nav.employees": "Employés",
    "nav.settings": "Paramètres",
    "action.refresh": "Actualiser",
    "action.logout": "Déconnexion",
    "theme.dark": "Sombre",
    "theme.light": "Clair",
    "theme.bg": "Fond",
    "theme.bg.default": "Par défaut",
    "theme.bg.rose": "Rose",
    "theme.bg.ocean": "Océan",
    "theme.bg.forest": "Forêt",
    "theme.bg.sunset": "Coucher de soleil",
    "theme.bg.violet": "Violet",
    "lang.english": "English",
    "lang.french": "Français",
    "lang.spanish": "Español",
  },
  es: {
    "nav.dashboard": "Panel",
    "nav.punch": "Fichar",
    "nav.myPunches": "Mis fichajes",
    "nav.notifications": "Notificaciones",
    "nav.teamAttendance": "Asistencia",
    "nav.weeklySchedule": "Horario semanal",
    "nav.departments": "Departamentos",
    "nav.teams": "Equipos",
    "nav.staffRoles": "Personal y roles",
    "nav.employees": "Empleados",
    "nav.settings": "Ajustes",
    "action.refresh": "Actualizar",
    "action.logout": "Cerrar sesión",
    "theme.dark": "Oscuro",
    "theme.light": "Claro",
    "theme.bg": "Fondo",
    "theme.bg.default": "Predeterminado",
    "theme.bg.rose": "Rosa",
    "theme.bg.ocean": "Océano",
    "theme.bg.forest": "Bosque",
    "theme.bg.sunset": "Atardecer",
    "theme.bg.violet": "Violeta",
    "lang.english": "English",
    "lang.french": "Français",
    "lang.spanish": "Español",
  },
};

export function t(lang: Language, key: I18nKey): string {
  return dict[lang][key] ?? dict.en[key] ?? key;
}

