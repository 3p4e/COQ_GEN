-- ===========================================================================
-- Planner demo seed (apps/planner). Idempotent — safe to re-run.
-- Load AFTER db/schema.sql (or `make migrate`). Passwords are bcrypt via pgcrypto
-- gen_salt('bf'); demo password for every user is:  Password123!
-- This is the FIRST fixture to populate app_user.
-- ===========================================================================
BEGIN;

-- ── Departments (GrowFlow-flavored, bilingual EN/MK) ──────────────────────
INSERT INTO planner_department(key, name_en, name_mk, icon, color, position) VALUES
  ('clone',  'Cloning & Nursery', 'Клонирање и расадник', 'leaf',   '#15A86B', 1),
  ('veg',    'Vegetation',        'Вегетација',           'leaf',   '#3FA34D', 2),
  ('flower', 'Flowering',         'Цветање',              'sun',    '#FF7A1A', 3),
  ('irr',    'Irrigation',        'Наводнување',          'droplet','#0EA5A5', 4),
  ('prod',   'Production',        'Производство',          'box',    '#2F6BFF', 5),
  ('qc',     'Quality Control',   'Контрола на квалитет', 'flask',  '#7A5BE0', 6),
  ('qa',     'QA / QP',           'ОК / КвЛ',             'shield', '#C2410C', 7),
  ('whin',   'Warehouse In',      'Магацин (влез)',       'box',    '#0891B2', 8),
  ('whout',  'Warehouse Out',     'Магацин (излез)',      'box',    '#D6336C', 9),
  ('sec',    'Security',          'Обезбедување',         'shield', '#566884', 10),
  ('maint',  'Maintenance',       'Одржување',            'wrench', '#5A6B82', 11)
ON CONFLICT (key) DO NOTHING;

-- Handoff chain (clone→veg→flower→prod→qc→qa→whout).
UPDATE planner_department s SET handoff_to_id = d.id
FROM planner_department d
WHERE d.key = (CASE s.key
  WHEN 'clone' THEN 'veg'  WHEN 'veg' THEN 'flower' WHEN 'flower' THEN 'prod'
  WHEN 'prod'  THEN 'qc'   WHEN 'qc'  THEN 'qa'     WHEN 'qa'     THEN 'whout'
  WHEN 'irr'   THEN 'prod' WHEN 'whin' THEN 'prod'  WHEN 'maint'  THEN 'irr'
  ELSE NULL END);

-- ── Users (bcrypt password = Password123!) ────────────────────────────────
-- On re-run, refresh the password/role/dept so the demo login always works.
INSERT INTO app_user(username, full_name, role, email, dept_id, password_hash, is_active)
SELECT v.username, v.full_name, v.role, v.email,
       (SELECT id FROM planner_department WHERE key = v.dept_key),
       crypt('Password123!', gen_salt('bf')), TRUE
FROM (VALUES
  ('marko',    'Marko Petrov',     'hod',       'marko@growflow.eu',    'veg'),
  ('elena',    'Elena Stojanova',  'hod',       'elena@growflow.eu',    'qc'),
  ('dimitar',  'Dimitar Ilievski', 'hod',       'dimitar@growflow.eu',  'prod'),
  ('sofija',   'Sofija Trajkova',  'qa',        'sofija@growflow.eu',   'qa'),
  ('jana',     'Jana Kostova',     'qp',        'jana@growflow.eu',     'qa'),
  ('viktor',   'Viktor Angelov',   'operator',  'viktor@growflow.eu',   'irr'),
  ('ana',      'Ana Nikolova',     'operator',  'ana@growflow.eu',      'veg'),
  ('goran',    'Goran Markovski',  'operator',  'goran@growflow.eu',    'maint'),
  ('victoria', 'Victoria Exec',    'executive', 'victoria@growflow.eu', NULL),
  ('admin',    'System Admin',     'admin',     'admin@growflow.eu',    NULL)
) AS v(username, full_name, role, email, dept_key)
ON CONFLICT (username) DO UPDATE
   SET full_name     = EXCLUDED.full_name,
       role          = EXCLUDED.role,
       email         = EXCLUDED.email,
       dept_id       = EXCLUDED.dept_id,
       password_hash = EXCLUDED.password_hash,
       is_active     = TRUE;

-- ── Tasks for the current week (Monday) ───────────────────────────────────
-- Helper expressions: department id by key, user id by username, this Monday.
-- Insert-if-absent guard on (week_start, title).
INSERT INTO planner_task(department_id, title, owner_id, status, priority, week_start, days, room, batch, tags, description, blocker)
SELECT d.id, v.title,
       (SELECT id FROM app_user WHERE username = v.owner),
       v.status, v.priority, date_trunc('week', current_date)::date,
       v.days, v.room, v.batch, v.tags, v.description, v.blocker
FROM (VALUES
  ('clone', 'Take 240 cuttings — Gorilla Glue #4', 'ana',    'done',     'medium',  ARRAY['Mon'],        'Nursery A', 'GG4', ARRAY['EU-GMP'],            'Cut 240 clones from mother GG4-M3; dip + dome.', NULL),
  ('veg',   'Transplant to 11L pots — Veg Room 2',  'marko',  'working',  'high',    ARRAY['Tue','Wed'],  'Veg 2',     'GG4', ARRAY['EU-GMP'],            'Up-pot rooted GG4 clones to 11L coco.',          NULL),
  ('irr',   'Calibrate EC/pH dosing — Line 3',      'viktor', 'stuck',    'critical',ARRAY['Mon'],        'Fertigation','',   ARRAY['MK-GMP'],            'Calibrate EC 2.2 mS, pH 5.8 on line 3.',         'Dosing pump #3 fault — maintenance ticket open'),
  ('flower','Flip Flower Room 3 to 12/12',          'marko',  'review',   'high',    ARRAY['Wed'],        'Flower 3',  'GG4', ARRAY[]::text[],            'Switch photoperiod; confirm blackout.',          NULL),
  ('prod',  'Trim & wet-weigh — Batch GG4-2401',    'dimitar','working',  'high',    ARRAY['Thu','Fri'],  'Trim Hall', 'GG4', ARRAY['EU-GMP'],            'Machine + hand trim; reconcile harvest log.',    NULL),
  ('qc',    'Microbial + potency sampling — GG4',   'elena',  'stuck',    'critical',ARRAY['Thu'],        'Lab',       'GG4', ARRAY['EU-GMP','sampling'], 'Pull 4-zone samples; TYMC/TAMC + HPLC.',         'Awaiting HPLC reagent — procurement notified'),
  ('qa',    'Batch record review — GG4-2401',        'sofija', 'pending',  'high',    ARRAY['Fri'],        'QA Office', 'GG4', ARRAY['EU-GMP'],            '',                                               NULL),
  ('maint', 'Repair dosing pump #3 (Irrigation)',   'goran',  'working',  'critical',ARRAY['Mon'],        'Fertigation','',   ARRAY[]::text[],            'Strip, reseal and test-prime pump #3.',          NULL)
) AS v(dept, title, owner, status, priority, days, room, batch, tags, description, blocker)
JOIN planner_department d ON d.key = v.dept
WHERE NOT EXISTS (
  SELECT 1 FROM planner_task t
  WHERE t.week_start = date_trunc('week', current_date)::date AND t.title = v.title
);

-- ── A couple of subtasks, a progress note, a dependency, a handoff ────────
INSERT INTO planner_subtask(task_id, text, done, position)
SELECT t.id, s.text, s.done, s.position
FROM (VALUES
  ('Transplant to 11L pots — Veg Room 2', 'Stage substrate',  TRUE,  0),
  ('Transplant to 11L pots — Veg Room 2', 'Up-pot 120 plants', FALSE, 1),
  ('Transplant to 11L pots — Veg Room 2', 'Update plant map',  FALSE, 2),
  ('Microbial + potency sampling — GG4',  'Pull 4-zone samples', TRUE,  0),
  ('Microbial + potency sampling — GG4',  'Microbial plates',    FALSE, 1),
  ('Microbial + potency sampling — GG4',  'HPLC potency',        FALSE, 2)
) AS s(title, text, done, position)
JOIN planner_task t
  ON t.title = s.title AND t.week_start = date_trunc('week', current_date)::date
WHERE NOT EXISTS (
  SELECT 1 FROM planner_subtask x WHERE x.task_id = t.id AND x.text = s.text
);

-- Progress note on the stuck QC task.
INSERT INTO planner_progress_note(task_id, day, note, author_id)
SELECT t.id, 'Thu', 'Samples pulled. HPLC down to reagent — flagged procurement.',
       (SELECT id FROM app_user WHERE username = 'elena')
FROM planner_task t
WHERE t.title = 'Microbial + potency sampling — GG4'
  AND t.week_start = date_trunc('week', current_date)::date
  AND NOT EXISTS (SELECT 1 FROM planner_progress_note n WHERE n.task_id = t.id);

-- Dependency: QA review depends on QC sampling.
INSERT INTO planner_task_dependency(task_id, depends_on_task_id)
SELECT a.id, b.id
FROM planner_task a, planner_task b
WHERE a.title = 'Batch record review — GG4-2401'
  AND b.title = 'Microbial + potency sampling — GG4'
  AND a.week_start = date_trunc('week', current_date)::date
  AND b.week_start = date_trunc('week', current_date)::date
ON CONFLICT DO NOTHING;

-- Handoff: production hands GG4 over to QC.
INSERT INTO planner_handoff(task_id, to_department_id, requested_by)
SELECT t.id, (SELECT id FROM planner_department WHERE key = 'qc'),
       (SELECT id FROM app_user WHERE username = 'dimitar')
FROM planner_task t
WHERE t.title = 'Trim & wet-weigh — Batch GG4-2401'
  AND t.week_start = date_trunc('week', current_date)::date
  AND NOT EXISTS (SELECT 1 FROM planner_handoff h WHERE h.task_id = t.id);

-- ── A couple of submitted weekly reports (current week) ───────────────────
INSERT INTO planner_weekly_report(user_id, week_start, completed_summary, progress_summary, next_week_plan, status, submitted_at)
SELECT (SELECT id FROM app_user WHERE username = v.username),
       date_trunc('week', current_date)::date, v.completed, v.progress, v.next_plan, 'submitted', now()
FROM (VALUES
  ('marko',   'Cut 240 GG4 clones; began 11L up-pot in Veg 2.',
              'Up-pot ~60% done; substrate staged.',
              'Finish up-pot, flip Flower 3 to 12/12, update plant map.'),
  ('elena',   'Pulled 4-zone GG4 samples; plated microbials.',
              'HPLC potency blocked on reagent (procurement notified).',
              'Run HPLC once reagent lands; release GG4 micro results.')
) AS v(username, completed, progress, next_plan)
ON CONFLICT (user_id, week_start) DO NOTHING;

COMMIT;
