# RAPPORT DE STAGE — PROJET DE FIN D'ÉTUDES (PFE)

## Puncher Manager : plateforme de gestion des présences, déploiement cloud et analyse des données

---

**Étudiant :** [Prénom NOM]  
**Formation :** [Licence / Master — spécialité]  
**Établissement :** [Nom de l'université ou de l'école]  
**Encadrant académique :** [Nom]  
**Encadrant professionnel :** [Nom]  
**Organisme d'accueil :** [Entreprise ou projet personnel]  
**Période du stage :** [Date de début] — [Date de fin]  
**Année universitaire :** 2025–2026

---

## Remerciements

Je tiens à remercier [encadrant académique] pour son accompagnement et ses conseils tout au long de ce projet. Je remercie également [encadrant professionnel / équipe] pour la confiance accordée et l'orientation technique.

Mes remerciements s'adressent enfin à [famille, collègues, enseignants] pour leur soutien durant la réalisation de ce Projet de Fin d'Études.

---

## Résumé

Ce rapport présente la conception, le développement et le déploiement de **Puncher Manager**, une application web full-stack dédiée à la **gestion des présences**, des **plannings hebdomadaires** et du **suivi d'équipe** en entreprise.

Le système repose sur une architecture moderne : **backend Spring Boot 3** (Java 17), **frontend Next.js 14**, base de données **PostgreSQL**, sécurité **JWT** et gestion des rôles (Super Admin, Admin, Responsable de département, Chef d'équipe, Employé). L'application a été déployée sur **Amazon Web Services** (ECS Fargate, RDS, Application Load Balancer) avec une chaîne **CI/CD** automatisée via **GitHub Actions** et **Terraform**.

Par ailleurs, un volet **Business Intelligence** a été réalisé avec **Power BI Desktop**, connecté à la base PostgreSQL privée sur AWS via un **tunnel SSH** et un **bastion EC2**. Des jeux de données analytiques ont été générés, et un module d'**alertes automatiques** (retards et absences) a été intégré pour notifier les employés et les managers par e-mail et notifications in-app.

**Mots-clés :** gestion des présences, Spring Boot, Next.js, AWS, CI/CD, Power BI, PostgreSQL, DevOps, Business Intelligence.

---

## Table des matières

1. [Introduction](#1-introduction)
2. [Contexte et problématique](#2-contexte-et-problématique)
3. [Objectifs du projet](#3-objectifs-du-projet)
4. [État de l'art et choix technologiques](#4-état-de-lart-et-choix-technologiques)
5. [Analyse fonctionnelle](#5-analyse-fonctionnelle)
6. [Architecture technique](#6-architecture-technique)
7. [Réalisation — Backend](#7-réalisation--backend)
8. [Réalisation — Frontend](#8-réalisation--frontend)
9. [Déploiement cloud et DevOps](#9-déploiement-cloud-et-devops)
10. [Business Intelligence avec Power BI](#10-business-intelligence-avec-power-bi)
11. [Module d'alertes automatisées](#11-module-dalertes-automatisées)
12. [Tests et validation](#12-tests-et-validation)
13. [Difficultés rencontrées et solutions](#13-difficultés-rencontrées-et-solutions)
14. [Bilan personnel et compétences acquises](#14-bilan-personnel-et-compétences-acquises)
15. [Perspectives d'évolution](#15-perspectives-dévolution)
16. [Conclusion](#16-conclusion)
17. [Annexes](#17-annexes)
18. [Bibliographie et webographie](#18-bibliographie-et-webographie)

---

## 1. Introduction

La gestion des présences est un enjeu central pour les organisations : elle impacte la productivité, la conformité réglementaire et la relation manager–collaborateur. Les solutions existantes sont souvent coûteuses, peu flexibles ou difficiles à intégrer dans un environnement cloud moderne.

Le projet **Puncher Manager** répond à ce besoin en proposant une application **sur mesure**, **sécurisée** et **déployable en production**, tout en intégrant des capacités d'**analyse** (tableaux de bord, export, Power BI) et d'**automatisation** (alertes en cas de retards ou d'absences répétés).

Ce rapport documente l'ensemble du travail réalisé dans le cadre du stage / PFE : de l'analyse des besoins jusqu'au déploiement sur AWS et à l'exploitation des données pour la prise de décision.

---

## 2. Contexte et problématique

### 2.1 Contexte

Les entreprises doivent suivre quotidiennement :

- les **pointages** (arrivée, pauses, déjeuner, départ) ;
- la **conformité au planning** (horaires prévus vs horaires réels) ;
- les **retards** et **absences** ;
- la **communication** entre managers et équipes (notifications, validation des plannings).

Une solution informatique doit donc couvrir à la fois l'**opérationnel** (saisie des présences), le **pilotage** (tableaux de bord managers) et l'**analyse** (reporting, BI).

### 2.2 Problématique

Comment concevoir et déployer une plateforme de gestion des présences qui soit :

1. **Fiable** — données cohérentes, règles métier respectées ;
2. **Sécurisée** — authentification, rôles, base de données non exposée publiquement ;
3. **Scalable** — architecture cloud containerisée ;
4. **Analysable** — connexion BI sans compromettre la sécurité du RDS ;
5. **Automatisée** — déploiement continu et alertes proactives ?

---

## 3. Objectifs du projet

### 3.1 Objectif principal

Développer et mettre en production **Puncher Manager**, une application complète de gestion des présences et des plannings.

### 3.2 Objectifs spécifiques

| Objectif | Indicateur de réussite |
|----------|----------------------|
| Authentification et rôles | 5 rôles fonctionnels avec périmètres d'accès |
| Pointage employé | Séquence de pointages validée (WORK_START → LOGOUT) |
| Suivi d'équipe | Vue attendance par équipe, département, plage de dates |
| Planning hebdomadaire | Création, confirmation employé, notifications |
| Export | CSV / Excel des présences |
| Déploiement AWS | Application accessible via URL publique (ALB) |
| CI/CD | Pipeline automatique sur push `main` |
| Power BI | Connexion ODBC à RDS privé via tunnel SSH |
| Données analytics | Jeu de données fictif (départements, équipes, ABSENT) |
| Alertes | Règles de risque retards/absences avec e-mail et notifications |

---

## 4. État de l'art et choix technologiques

### 4.1 Stack applicative

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Backend | Spring Boot 3, Java 17 | Écosystème mature, JPA, sécurité, planification |
| Base de données | PostgreSQL 16 | Relationnel, robuste, compatible RDS |
| Frontend | Next.js 14, React 18 | App Router, SSR/CSR, écosystème riche |
| UI | Tailwind CSS, Zustand | Interface moderne, état global léger |
| API | REST + SSE | HTTP classique + notifications temps réel |
| Auth | JWT (HMAC) | Stateless, adapté aux SPA |
| Conteneurisation | Docker | Images reproductibles pour ECS |
| IaC | Terraform | Infrastructure versionnée et reproductible |
| CI/CD | GitHub Actions | Intégration native au dépôt Git |
| BI | Power BI + ODBC PostgreSQL | Standard entreprise pour l'analyse |

### 4.2 Comparaison avec des alternatives

- **Feuille Excel** : peu scalable, pas de workflow multi-utilisateurs.
- **SaaS propriétaire** : coût, personnalisation limitée.
- **Développement sur mesure** : flexibilité maximale, apprentissage DevOps/BI intégré au PFE.

Le choix du développement sur mesure permet de maîtriser l'architecture de bout en bout, un atout majeur pour un rapport de stage technique.

---

## 5. Analyse fonctionnelle

### 5.1 Acteurs

| Acteur | Rôle |
|--------|------|
| **Super Admin** | Configuration globale, tous les accès |
| **Admin** | Gestion organisation, analytics étendus |
| **Responsable de département** | Périmètre département |
| **Chef d'équipe** | Périmètre équipe, notifications |
| **Employé** | Pointage, historique, confirmation planning |

### 5.2 Fonctionnalités principales

**Module Pointage**

- Enregistrement séquentiel : WORK_START, pauses, déjeuner, LOGOUT.
- Historique personnel par plage de dates.
- Calcul du statut (à l'heure / en retard) à partir du planning.

**Module Présences équipe**

- Vue par jour ou par plage (jusqu'à 2 mois).
- Filtres : département, équipe, recherche employé.
- Comparaison planning vs pointages (indicateurs ✓ / ⚠).
- Export CSV et Excel.

**Module Planning**

- Planning hebdomadaire (dimanche → samedi).
- Confirmation par l'employé.
- Notifications et e-mails (SMTP).

**Module Notifications**

- Messages ciblés (équipe, département, employé).
- Flux SSE pour mises à jour en temps réel.
- Alertes de risque attendance (nouveau module).

**Module Analytics**

- KPIs : présence, retards, absences.
- Agrégations journalières, hebdomadaires, mensuelles.

### 5.3 Modèle de données (synthèse)

Entités principales : `users`, `departments`, `teams`, `punches`, `attendance_records`, `weekly_schedules`, `weekly_schedule_days`, `schedule_confirmations`, `notifications`, `attendance_risk_alerts`, `company_settings`.

Relations clés :

- Un département contient plusieurs équipes.
- Un employé appartient à un département et optionnellement à une équipe.
- Les pointages et les enregistrements de présence sont liés à l'utilisateur.
- Un enregistrement de présence par employé et par jour (`UNIQUE user_id, record_date`).

---

## 6. Architecture technique

### 6.1 Architecture logique

```text
┌─────────────┐     HTTPS/JWT      ┌──────────────────┐
│  Navigateur │ ◄────────────────► │  Next.js (UI)    │
│  (React)    │                    │  Port 3000       │
└──────┬──────┘                    └────────┬─────────┘
       │                                    │
       │              REST / SSE            │
       ▼                                    ▼
┌─────────────────────────────────────────────────────┐
│           Spring Boot API (Port 8080)              │
│  Auth · Punch · Attendance · Schedule · Notification │
│  AttendanceRisk · Export · Analytics                 │
└────────────────────────┬────────────────────────────┘
                         │ JDBC
                         ▼
              ┌─────────────────────┐
              │  PostgreSQL (RDS)   │
              │  Base privée (VPC)  │
              └─────────────────────┘
```

### 6.2 Architecture de déploiement AWS

```text
Internet
    │
    ▼
Application Load Balancer (HTTP :80)
    ├── /api/*  ──► ECS Fargate (backend)
    └── /*      ──► ECS Fargate (frontend)
                           │
                           ▼
                    RDS PostgreSQL (subnet privé)
                           ▲
                    EC2 Bastion (tunnel SSH)
                           ▲
                    Power BI Desktop (poste local)
```

### 6.3 Sécurité

- RDS **non accessible** depuis Internet (`publicly_accessible = false`).
- Security Groups : ECS → RDS (5432), Bastion → RDS, SSH limité à l'IP du développeur.
- JWT pour toutes les routes API (sauf login et documentation).
- Mots de passe hashés (BCrypt).

---

## 7. Réalisation — Backend

### 7.1 Services métier clés

| Service | Responsabilité |
|---------|----------------|
| `PunchService` | Validation de la séquence de pointages |
| `AttendanceService` | Calcul des présences, analytics, exports |
| `PlanningService` | Planning confirmé par jour |
| `ScheduleService` | CRUD plannings hebdomadaires |
| `NotificationService` | Notifications in-app + SSE |
| `MailService` | E-mails (planning, alertes risque) |
| `AttendanceRiskService` | Évaluation des règles de risque |

### 7.2 Règles métier — Présence

Le statut quotidien provient de deux sources :

1. **`attendance_records`** — enregistrement persistant après LOGOUT ou marquage ABSENT (job nocturne).
2. **Calcul dérivé** — à partir des pointages et du planning si aucun enregistrement n'existe encore (journée en cours).

Cette double logique garantit une interface réactive tout en conservant une table d'analyse pour Power BI.

### 7.3 Planification

- `AbsenceEvaluationScheduler` : exécution quotidienne à 02h00 — marque ABSENT si planning prévu sans pointage.
- `AttendanceRiskScheduler` : exécution quotidienne à 08h00 — évalue les règles d'alerte.

### 7.4 API REST (extraits)

- `POST /api/auth/login`
- `POST /api/punch`
- `GET /api/attendance/team/{teamId}?from=&to=`
- `GET /api/attendance/analytics`
- `POST /api/attendance/risk/evaluate` (déclenchement manuel admin)
- `GET /api/notification/stream` (SSE)

---

## 8. Réalisation — Frontend

### 8.1 Structure

Application **Next.js 14** (App Router) avec pages :

- `/login` — authentification
- `/dashboard` — tableau de bord par rôle
- `/punch`, `/history` — employé
- `/team` — présences équipe (filtres, export)
- `/analytics` — KPIs et graphiques
- `/notifications` — messagerie et alertes
- `/admin/*` — gestion RH (employés, équipes, départements, planning, paramètres)

### 8.2 Design system

Une refonte UI professionnelle a été menée :

- Police **Inter**, palette **slate + emerald**
- Composants réutilisables : `Card`, `Button`, `Input`, `PageHeader`, `Badge`
- Sidebar moderne, barre supérieure sticky, page de connexion en split-screen
- Thèmes de fond et mode sombre

### 8.3 État applicatif

- **Zustand** : authentification, thème UI, langue (i18n FR/EN/ES).
- **Axios** : client HTTP avec intercepteurs JWT et indicateur de chargement global.

---

## 9. Déploiement cloud et DevOps

### 9.1 Pipeline CI/CD (GitHub Actions)

Sur chaque push vers `main` :

1. **Tests** — backend (JUnit), frontend (Vitest).
2. **Build Docker** — images backend et frontend.
3. **Push Docker Hub** — tags versionnés.
4. **Déploiement ECS** — mise à jour des services Fargate.

Secrets GitHub : `DOCKERHUB_*`, `AWS_*`, `PRODUCTION_APP_URL`.

### 9.2 Infrastructure Terraform

Ressources provisionnées :

- VPC (sous-réseaux publics / privés)
- RDS PostgreSQL
- ECS Cluster + Task Definitions (backend, frontend)
- Application Load Balancer
- Security Groups et IAM

### 9.3 URL de production

Exemple : `http://puncher-manager-alb-165407361.eu-west-1.elb.amazonaws.com`

---

## 10. Business Intelligence avec Power BI

### 10.1 Problème

La base RDS étant **privée**, Power BI Desktop ne peut pas s'y connecter directement.

### 10.2 Solution retenue

Architecture professionnelle **bastion + tunnel SSH + ODBC** :

```text
Power BI Desktop
       ↓ ODBC (DSN PuncherAWS)
localhost:5433
       ↓ Tunnel SSH chiffré
EC2 Gateway (bastion public)
       ↓ Port 5432 (VPC privé)
RDS PostgreSQL (puncher_db)
```

### 10.3 Configuration

- Driver **PostgreSQL ODBC 64-bit**
- DSN : serveur `localhost`, port `5433`, base `puncher_db`
- Tunnel : `ssh -L 5433:<RDS_ENDPOINT>:5432 ec2-user@<IP_EC2>`

### 10.4 Modèle analytique

| Type | Tables |
|------|--------|
| Dimensions | `users`, `teams`, `departments` |
| Faits | `punches`, `attendance_records`, `attendance_risk_alerts` |
| Planning | `weekly_schedules`, `weekly_schedule_days` |

### 10.5 Analyses réalisables

- Taux de retard / ponctualité par équipe et département
- Évolution mensuelle des absences
- Classement des employés par minutes de retard
- Corrélation alertes envoyées vs comportement attendance
- Durée de travail (WORK_START → LOGOUT)

### 10.6 Jeu de données analytics

Un **seeder** dédié génère :

- 3 départements analytics (RH, Opérations, Sales & Marketing)
- 6 équipes, 24 employés fictifs (`ANALYTICS-*`)
- ~2 mois de pointages et `attendance_records`
- Jours **ABSENT** pour alimenter les graphiques d'absentéisme

---

## 11. Module d'alertes automatisées

### 11.1 Objectif

Prévenir les employés et managers lorsque des seuils de retards ou d'absences sont dépassés — approche **rule-based** (auditable, conforme RGPD métier).

### 11.2 Règles implémentées

| Condition | Niveau | Action employé | Action manager |
|-----------|--------|----------------|----------------|
| 3 retards en 7 jours | Avertissement | Rappel amical | — |
| 5 retards en 30 jours | Risque moyen | E-mail coaching | — |
| 10+ retards en 30 jours | Risque élevé | E-mail formel | Notification + e-mail |
| 2 absences en 30 jours | Avertissement | Alerte absence | — |
| 4+ absences en 30 jours | Risque élevé | — | Notification + e-mail |

### 11.3 Mécanismes techniques

- Table `attendance_risk_alerts` — traçabilité et anti-spam (cooldown par règle)
- `AttendanceRiskScheduler` — exécution quotidienne
- `MailService` — templates e-mail
- `NotificationService` — type `ATTENDANCE_RISK`
- Endpoint manuel : `POST /api/attendance/risk/evaluate`

---

## 12. Tests et validation

### 12.1 Tests automatisés

- **Backend** : tests unitaires (services Department, Attendance analytics, AttendanceRisk).
- **Frontend** : tests Vitest (pagination, tri attendance).

### 12.2 Tests manuels

| Scénario | Résultat attendu |
|----------|------------------|
| Login par rôle | Accès menus conformes au rôle |
| Séquence pointage invalide | Erreur 400 |
| Présences 2 mois, toutes équipes | Données cohérentes avec pointages |
| Export Excel | Fichier téléchargé |
| Tunnel SSH + psql | Connexion RDS OK |
| Power BI refresh | Tables visibles |
| Evaluate risk | Alertes créées en base |

### 12.3 Validation déploiement

- Pipeline CI/CD vert sur `main`
- Application accessible via ALB
- Backend connecté au RDS en production

---

## 13. Difficultés rencontrées et solutions

| Difficulté | Solution |
|------------|----------|
| RDS privé inaccessible depuis Power BI | Bastion EC2 + tunnel SSH + ODBC localhost |
| Connecteur PostgreSQL natif Power BI (SSL) | Driver ODBC 64-bit |
| `attendance_records` peu remplie vs UI | Seeder avec `evaluateAfterLogout` + doc explicative |
| Transaction seeder annulée au rollback | `TransactionTemplate` par étape + commit analytics org |
| Frontend build Docker (`public/` manquant) | `RUN mkdir -p public` dans Dockerfile |
| API frontend pointant vers localhost en prod | Rebuild avec `PRODUCTION_APP_URL` |
| Docker Hub 401 | Token avec scope **Write** |

---

## 14. Bilan personnel et compétences acquises

### 14.1 Compétences techniques

- **Développement full-stack** : API REST, SPA React, ORM JPA
- **Sécurité** : JWT, rôles, VPC, Security Groups
- **DevOps** : Docker, Terraform, ECS, GitHub Actions
- **Bases de données** : modélisation relationnelle, PostgreSQL, seeding
- **Business Intelligence** : Power BI, modèle en étoile, ODBC
- **Automatisation** : schedulers Spring, alertes e-mail

### 14.2 Compétences transversales

- Rédaction de documentation technique (guides CI/CD, Power BI, seed)
- Résolution de problèmes réseau cloud
- Approche professionnelle : sécurité avant exposition publique de la base

### 14.3 Apports du stage

Ce projet dépasse le simple CRUD : il intègre **déploiement production**, **analyse de données** et **automatisation RH**, ce qui en fait un PFE complet et valorisable sur un CV.

---

## 15. Perspectives d'évolution

| Axe | Description |
|-----|-------------|
| HTTPS / domaine custom | Certificat ACM sur l'ALB |
| Flyway / Liquibase | Migrations versionnées (remplacer `ddl-auto: update`) |
| Vue SQL `attendance_report_v` | Aligner Power BI sur la logique UI |
| IA (optionnel) | Personnalisation du ton des e-mails d'alerte |
| Application mobile | Pointage sur smartphone |
| Multi-tenant | Plusieurs entreprises sur une instance |
| Tableau de bord Power BI Service | Publication cloud avec gateway certifiée |

---

## 16. Conclusion

Le projet **Puncher Manager** démontre la faisabilité d'une solution de gestion des présences **moderne**, **sécurisée** et **déployée en production** sur AWS. Les modules développés couvrent l'ensemble de la chaîne de valeur : saisie opérationnelle, pilotage managers, export, analyse BI et alertes automatiques.

La connexion Power BI à une base RDS privée via un bastion illustre une approche **professionnelle** de l'accès aux données en environnement cloud. Le pipeline CI/CD garantit des déploiements reproductibles et traçables.

Ce stage / PFE a permis de consolider des compétences en **ingénierie logicielle**, **cloud** et **analyse de données**, directement applicables en contexte professionnel.

---

## 17. Annexes

### Annexe A — Identifiants de démonstration

| Compte | E-mail | Mot de passe | Rôle |
|--------|--------|--------------|------|
| Super Admin | superadmin@puncher.com | admin123 | SUPER_ADMIN |
| Employé | employee@puncher.com | demo123 | EMPLOYEE |
| Analytics (ex.) | nina.ontime.hr1@analytics.demo | demo123 | EMPLOYEE |

### Annexe B — Commandes utiles

**Tunnel SSH vers RDS :**

```powershell
ssh -i "chemin\vers\cle.pem" -L 5433:<RDS_ENDPOINT>:5432 ec2-user@<IP_EC2>
```

**Seeding analytics (AWS via tunnel) :**

```powershell
cd backend
$env:DB_HOST="localhost"
$env:DB_PORT="5433"
$env:DB_NAME="puncher_db"
$env:DB_USER="postgres"
$env:DB_PASSWORD="<mot_de_passe>"
$env:SPRING_APPLICATION_JSON='{"puncher":{"seed":{"enabled":true,"analytics":true}}}'
mvn spring-boot:run
```

**Déclencher les alertes de risque :**

```powershell
# Après login JWT en tant que SUPER_ADMIN
POST /api/attendance/risk/evaluate
```

### Annexe C — Structure du dépôt

```text
Puncher Manager/
├── backend/          # API Spring Boot
├── frontend/         # Next.js 14
├── database/         # schema.sql, seed docs
├── deploy/aws/       # Terraform, guides AWS, Power BI
├── docs/             # Documentation projet
└── .github/workflows/  # CI/CD
```

### Annexe D — Captures d'écran (à insérer)

> [Capture 1 : Page de connexion]  
> [Capture 2 : Dashboard employé]  
> [Capture 3 : Présences équipe — vue 2 mois]  
> [Capture 4 : Analytics KPIs]  
> [Capture 5 : Power BI — graphique retards par département]  
> [Capture 6 : Architecture AWS (schéma)]

---

## 18. Bibliographie et webographie

- Spring Boot Documentation — https://spring.io/projects/spring-boot  
- Next.js Documentation — https://nextjs.org/docs  
- PostgreSQL Documentation — https://www.postgresql.org/docs/  
- Amazon Web Services — ECS, RDS, VPC — https://docs.aws.amazon.com/  
- Terraform Documentation — https://developer.hashicorp.com/terraform/docs  
- Microsoft Power BI — https://learn.microsoft.com/power-bi/  
- GitHub Actions — https://docs.github.com/actions  
- OWASP — Bonnes pratiques sécurité applications web — https://owasp.org/

---

*Document généré dans le cadre du Projet de Fin d'Études — Puncher Manager.*  
*Dépôt source : [DESELMAAR/puncher-manager] — à adapter selon votre contexte institutionnel.*
