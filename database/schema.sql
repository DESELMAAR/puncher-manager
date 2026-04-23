-- Puncher Manager – PostgreSQL schema (VARCHAR enums for JPA compatibility)
-- CREATE DATABASE puncher_manager;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  admin_id UUID NULL
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  employee_id VARCHAR(64) NOT NULL UNIQUE,
  phone_number VARCHAR(64),
  hiring_date DATE,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  role VARCHAR(32) NOT NULL,
  department_id UUID NULL REFERENCES departments (id) ON DELETE SET NULL,
  team_id UUID NULL,
  CONSTRAINT chk_user_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE')),
  CONSTRAINT chk_user_role CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'EMPLOYEE')),
  CONSTRAINT chk_super_admin_no_team CHECK (
    (role = 'SUPER_ADMIN' AND team_id IS NULL) OR role != 'SUPER_ADMIN'
  )
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_employee_id ON users (employee_id);
CREATE INDEX idx_users_department ON users (department_id);
CREATE INDEX idx_users_team ON users (team_id);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments (id) ON DELETE CASCADE,
  team_leader_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX idx_teams_department ON teams (department_id);
CREATE INDEX idx_teams_leader ON teams (team_leader_id);

ALTER TABLE users
  ADD CONSTRAINT fk_users_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE SET NULL;

ALTER TABLE departments
  ADD CONSTRAINT fk_departments_admin FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE SET NULL;

CREATE TABLE punches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  punch_type VARCHAR(32) NOT NULL,
  punched_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT chk_punch_type CHECK (punch_type IN (
    'WORK_START', 'BREAK1_START', 'BREAK1_END', 'LUNCH_START', 'LUNCH_END',
    'BREAK2_START', 'BREAK2_END', 'LOGOUT'
  ))
);

CREATE INDEX idx_punches_user_time ON punches (user_id, punched_at DESC);

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id VARCHAR(64) NOT NULL,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  status VARCHAR(32) NOT NULL,
  expected_start TIME NULL,
  actual_start TIME NULL,
  minutes_late INT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_attendance_status CHECK (status IN ('ON_TIME', 'LATE', 'ABSENT')),
  CONSTRAINT uq_attendance_user_date UNIQUE (user_id, record_date)
);

CREATE INDEX idx_attendance_employee_date ON attendance_records (employee_id, record_date);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  receiver_id UUID NULL REFERENCES users (id) ON DELETE CASCADE,
  team_id UUID NULL REFERENCES teams (id) ON DELETE CASCADE,
  notification_type VARCHAR(32) NOT NULL DEFAULT 'MESSAGE',
  message TEXT NOT NULL,
  payload_json TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  read_flag BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT chk_notification_target CHECK (
    (receiver_id IS NOT NULL AND team_id IS NULL)
    OR (receiver_id IS NULL AND team_id IS NOT NULL)
  ),
  CONSTRAINT chk_notification_type CHECK (notification_type IN ('MESSAGE', 'SCHEDULE_CONFIRM', 'SCHEDULE_RESPONSE'))
);

CREATE INDEX idx_notifications_receiver ON notifications (receiver_id, read_flag, created_at DESC);
CREATE INDEX idx_notifications_team ON notifications (team_id, read_flag, created_at DESC);

-- Weekly schedules (Sun→Sat) + confirmations

CREATE TABLE weekly_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_weekly_schedule_employee_week UNIQUE (employee_user_id, week_start)
);

CREATE INDEX idx_weekly_schedules_employee_week ON weekly_schedules (employee_user_id, week_start DESC);
CREATE INDEX idx_weekly_schedules_creator ON weekly_schedules (created_by_user_id, created_at DESC);

CREATE TABLE weekly_schedule_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES weekly_schedules (id) ON DELETE CASCADE,
  day_of_week INT NOT NULL,
  day_off BOOLEAN NOT NULL DEFAULT FALSE,
  start_time TIME NULL,
  end_time TIME NULL,
  CONSTRAINT chk_weekly_schedule_dow CHECK (day_of_week >= 0 AND day_of_week <= 6),
  CONSTRAINT uq_weekly_schedule_day UNIQUE (schedule_id, day_of_week)
);

CREATE INDEX idx_weekly_schedule_days_schedule ON weekly_schedule_days (schedule_id);

CREATE TABLE schedule_confirmations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES weekly_schedules (id) ON DELETE CASCADE,
  employee_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  comment TEXT NULL,
  responded_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_schedule_confirmation_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CORRECTION_REQUESTED')),
  CONSTRAINT uq_schedule_confirmation_schedule_employee UNIQUE (schedule_id, employee_user_id)
);

CREATE INDEX idx_schedule_confirmations_employee ON schedule_confirmations (employee_user_id, updated_at DESC);
CREATE INDEX idx_schedule_confirmations_status ON schedule_confirmations (status, updated_at DESC);

-- Company settings (singleton-style)

CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(255) NULL,
  postal_address TEXT NULL,
  department_label VARCHAR(255) NULL,
  site_location VARCHAR(255) NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_company_settings_updated_at ON company_settings (updated_at DESC);
