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
  | "lang.spanish"
  | "team.title"
  | "team.scopePrefix"
  | "team.scope.superAdmin"
  | "team.scope.admin"
  | "team.scope.deptManager"
  | "team.scope.teamLeader"
  | "label.department"
  | "label.team"
  | "label.date"
  | "label.from"
  | "label.to"
  | "label.search"
  | "action.clear"
  | "action.exportCsv"
  | "attendance.overview"
  | "attendance.range"
  | "attendance.noTeams"
  | "attendance.noMatches"
  | "table.date"
  | "table.employee"
  | "table.status"
  | "table.schedule"
  | "table.deptManager"
  | "table.teamLeader"
  | "table.punches";

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
    "team.title": "Team attendance",
    "team.scopePrefix": "View employee attendance by scope:",
    "team.scope.superAdmin": "All departments (select below)",
    "team.scope.admin": "Departments you manage (select below)",
    "team.scope.deptManager": "Your department’s teams",
    "team.scope.teamLeader": "Your team only",
    "label.department": "Department",
    "label.team": "Team",
    "label.date": "Date",
    "label.from": "From",
    "label.to": "To",
    "label.search": "Search",
    "action.clear": "Clear",
    "action.exportCsv": "Export CSV",
    "attendance.overview": "Overview (all teams)",
    "attendance.range": "Range (up to 2 months)",
    "attendance.noTeams": "No teams available for your scope.",
    "attendance.noMatches": "No matching employees.",
    "table.date": "Date",
    "table.employee": "Employee",
    "table.status": "Status",
    "table.schedule": "Schedule",
    "table.deptManager": "Dept manager",
    "table.teamLeader": "Team leader",
    "table.punches": "Punches",
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
    "team.title": "Présences équipe",
    "team.scopePrefix": "Voir les présences selon votre périmètre :",
    "team.scope.superAdmin": "Tous les départements (sélectionner ci-dessous)",
    "team.scope.admin": "Départements que vous gérez (sélectionner ci-dessous)",
    "team.scope.deptManager": "Équipes de votre département",
    "team.scope.teamLeader": "Votre équipe uniquement",
    "label.department": "Département",
    "label.team": "Équipe",
    "label.date": "Date",
    "label.from": "Du",
    "label.to": "Au",
    "label.search": "Rechercher",
    "action.clear": "Effacer",
    "action.exportCsv": "Exporter CSV",
    "attendance.overview": "Vue d’ensemble (toutes les équipes)",
    "attendance.range": "Période (jusqu’à 2 mois)",
    "attendance.noTeams": "Aucune équipe disponible dans votre périmètre.",
    "attendance.noMatches": "Aucun employé correspondant.",
    "table.date": "Date",
    "table.employee": "Employé",
    "table.status": "Statut",
    "table.schedule": "Planning",
    "table.deptManager": "Resp. département",
    "table.teamLeader": "Chef d’équipe",
    "table.punches": "Pointages",
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
    "team.title": "Asistencia del equipo",
    "team.scopePrefix": "Ver asistencia por alcance:",
    "team.scope.superAdmin": "Todos los departamentos (seleccionar abajo)",
    "team.scope.admin": "Departamentos que gestionas (seleccionar abajo)",
    "team.scope.deptManager": "Equipos de tu departamento",
    "team.scope.teamLeader": "Solo tu equipo",
    "label.department": "Departamento",
    "label.team": "Equipo",
    "label.date": "Fecha",
    "label.from": "Desde",
    "label.to": "Hasta",
    "label.search": "Buscar",
    "action.clear": "Limpiar",
    "action.exportCsv": "Exportar CSV",
    "attendance.overview": "Resumen (todos los equipos)",
    "attendance.range": "Rango (hasta 2 meses)",
    "attendance.noTeams": "No hay equipos disponibles en tu alcance.",
    "attendance.noMatches": "No hay empleados coincidentes.",
    "table.date": "Fecha",
    "table.employee": "Empleado",
    "table.status": "Estado",
    "table.schedule": "Horario",
    "table.deptManager": "Jefe de depto.",
    "table.teamLeader": "Líder de equipo",
    "table.punches": "Marcajes",
  },
};

export function t(lang: Language, key: I18nKey): string {
  return dict[lang][key] ?? dict.en[key] ?? key;
}

