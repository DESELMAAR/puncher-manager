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
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  read_flag BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT chk_notification_target CHECK (
    (receiver_id IS NOT NULL AND team_id IS NULL)
    OR (receiver_id IS NULL AND team_id IS NOT NULL)
  )
);

CREATE INDEX idx_notifications_receiver ON notifications (receiver_id, read_flag, created_at DESC);
CREATE INDEX idx_notifications_team ON notifications (team_id, read_flag, created_at DESC);
