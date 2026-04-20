-- Sample data for Puncher Manager demos
-- Passwords are placeholders; the Spring Boot app seeds the real Super Admin via BCrypt.
-- If loading manually, generate BCrypt for "admin123" / "demo123" and replace below.

-- Optional: truncate order (run only on empty dev DB)
-- TRUNCATE notifications, attendance_records, punches, teams, users, departments RESTART IDENTITY CASCADE;

-- Departments (admin_id filled after users exist – see note in README; app seed is easier)
INSERT INTO departments (id, name, description, created_at, admin_id) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Engineering', 'Product development', NOW(), NULL),
  ('11111111-1111-1111-1111-111111111102', 'Operations', 'Day-to-day operations', NOW(), NULL);

-- Users: passwords must be BCrypt – use application seed or:
-- INSERT uses dummy hash; replace with output of BCryptPasswordEncoder for "demo123"
-- Example BCrypt for "demo123": $2a$10$YourHashHere

-- Placeholder – prefer running the backend once; it creates superadmin@puncher.com
-- Demo users (UUIDs fixed for FK references in teams):
-- DEPT_MANAGER Eng: 22222222-2222-2222-2222-222222222201
-- TEAM_LEADER:     22222222-2222-2222-2222-222222222202
-- EMPLOYEE:        22222222-2222-2222-2222-222222222203

/*
After first backend startup, you can INSERT additional rows from the admin UI,
or run SQL with real bcrypt hashes from:
  https://bcrypt-generator.com/  (cost 10)
*/
