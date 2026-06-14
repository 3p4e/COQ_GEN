-- ============================================================================
-- Planner smoke test — functional verification of the data-layer guarantees.
-- Run against a database that already has server/db/schema.sql applied (see run.sh).
-- Every check RAISES EXCEPTION on failure, so psql -v ON_ERROR_STOP=1 exits non-zero.
-- ============================================================================

-- T1: departments, tasks, defaults, subtasks, board grouping, dept FK
DO $$
DECLARE dept UUID; usr UUID; tsk UUID; n INT; comp TIMESTAMPTZ; st TEXT;
BEGIN
  INSERT INTO planner_department(key,name_en,name_mk,position)
    VALUES ('smoke_qc','Quality Control','Контрола','1') RETURNING id INTO dept;
  INSERT INTO app_user(username,full_name,role,email,dept_id,password_hash)
    VALUES ('smoke_op','Smoke Operator','operator','smoke@op.eu',dept,
            crypt('Password123!', gen_salt('bf'))) RETURNING id INTO usr;

  INSERT INTO planner_task(department_id,title,owner_id,week_start,days,tags)
    VALUES (dept,'Smoke task',usr, date_trunc('week',current_date)::date, ARRAY['Mon','Tue'], ARRAY['EU-GMP'])
    RETURNING id, status, completed_at INTO tsk, st, comp;
  IF st <> 'pending' THEN RAISE EXCEPTION 'FAIL T1: default status expected pending, got %', st; END IF;
  IF comp IS NOT NULL THEN RAISE EXCEPTION 'FAIL T1: completed_at should default NULL'; END IF;

  INSERT INTO planner_subtask(task_id,text,position) VALUES (tsk,'step 1',0),(tsk,'step 2',1);
  SELECT count(*) INTO n FROM planner_subtask WHERE task_id = tsk;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL T1: expected 2 subtasks, got %', n; END IF;

  SELECT count(*) INTO n FROM planner_task t
    WHERE t.week_start = date_trunc('week',current_date)::date AND t.status = 'pending';
  IF n < 1 THEN RAISE EXCEPTION 'FAIL T1: board grouping returned no pending tasks'; END IF;

  SELECT count(*) INTO n FROM app_user u JOIN planner_department d ON d.id = u.dept_id WHERE u.id = usr;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL T1: app_user.dept_id FK did not resolve'; END IF;
  RAISE NOTICE 'PASS T1: tables, defaults, subtasks, board grouping, dept FK OK';
END $$;

-- T2: bcrypt password verifies via pgcrypto, weekly report unique + embedding vector
DO $$
DECLARE usr UUID; rep UUID; ok BOOLEAN; n INT;
BEGIN
  SELECT id INTO usr FROM app_user WHERE username = 'smoke_op';
  SELECT (password_hash = crypt('Password123!', password_hash)) INTO ok FROM app_user WHERE id = usr;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL T2: bcrypt password did not verify'; END IF;

  INSERT INTO planner_weekly_report(user_id, week_start, completed_summary, status)
    VALUES (usr, date_trunc('week',current_date)::date, 'did things', 'submitted') RETURNING id INTO rep;
  BEGIN
    INSERT INTO planner_weekly_report(user_id, week_start, completed_summary)
      VALUES (usr, date_trunc('week',current_date)::date, 'dup');
    RAISE EXCEPTION 'FAIL T2: UNIQUE(user_id, week_start) was not enforced';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  INSERT INTO planner_report_embedding(report_id, chunk_text, embedding)
    SELECT rep, 'did things',
           CAST('['||array_to_string(array(SELECT '0' FROM generate_series(1,1536)),',')||']' AS vector);
  SELECT vector_dims(embedding) INTO n FROM planner_report_embedding WHERE report_id = rep;
  IF n <> 1536 THEN RAISE EXCEPTION 'FAIL T2: embedding dim expected 1536, got %', n; END IF;
  RAISE NOTICE 'PASS T2: bcrypt verify, weekly-report uniqueness, vector(1536) OK';
END $$;

\echo '---- ALL SMOKE CHECKS PASSED ----'
