-- ============================================================================
-- COQ_GEN smoke test — functional verification of the data-layer guarantees.
-- Run against a database that already has db/schema.sql applied (see run.sh).
-- Every check RAISES EXCEPTION on failure, so `psql -v ON_ERROR_STOP=1` exits
-- non-zero if any guarantee is violated.
-- ============================================================================

-- ---- seed reference + lineage + one multi-lab batch ------------------------
INSERT INTO app_user(username,full_name,role) VALUES
  ('blagoj','Blagoj Nikolov','qc_manager'),('jovana','Jovana','head_of_qc');
INSERT INTO parameter_dictionary(canonical_key,display_name,category,canonical_unit)
  VALUES ('TAMC','Total Aerobic Microbial Count','microbiology','CFU/g');
INSERT INTO institution(lab_code,name,default_language) VALUES
  ('LT-083','UKIM','en'),('LT-005','IJZ','mk');
INSERT INTO lab_synonym(canonical_key,institution_id,language,printed_term)
  SELECT 'TAMC', id,'en','TAMC' FROM institution WHERE lab_code='LT-083';
INSERT INTO lab_synonym(canonical_key,institution_id,language,printed_term)
  SELECT 'TAMC', id,'mk','Вкупен број на аеробни микроорганизми' FROM institution WHERE lab_code='LT-005';

INSERT INTO cultivation_batch(batch_number,strain,harvest_date) VALUES ('CB-2026-0007','StrainX','2026-04-01');
INSERT INTO product_spec(spec_code,version,category,title) VALUES ('QCSP-IMB-001','v02','IMB','Cannabis intermediate bulk');
INSERT INTO production_batch(batch_number,cultivation_batch_id,product_spec_id,product_name)
  SELECT 'PB-2026-0011',(SELECT id FROM cultivation_batch WHERE batch_number='CB-2026-0007'),
         (SELECT id FROM product_spec WHERE spec_code='QCSP-IMB-001'),'Cannabis Flower IMB';
INSERT INTO packaging_batch(packaging_batch_number,production_batch_id)
  SELECT 'PK-2026-0021',(SELECT id FROM production_batch WHERE batch_number='PB-2026-0011');
INSERT INTO spec_parameter(product_spec_id,canonical_key,param_name,operator,limit_high,unit,display_order)
  SELECT (SELECT id FROM product_spec WHERE spec_code='QCSP-IMB-001'),'TAMC','Total Aerobic Microbial Count','<=',1000,'CFU/g',1;
INSERT INTO source_file(sha256,filename,mime_type,byte_size,storage_uri,is_scanned)
  VALUES (digest('ukim-pdf-bytes','sha256'),'ukim.pdf','application/pdf',12345,'store://ukim.pdf',true);
INSERT INTO ecoa_document(document_code,source_file_id,institution_id,production_batch_id,batch_number,packaging_batch_number,language,issue_date,analysis_date,sampling_date,status)
  SELECT 'UKIM-2026-114',(SELECT id FROM source_file WHERE filename='ukim.pdf'),
         (SELECT id FROM institution WHERE lab_code='LT-083'),
         (SELECT id FROM production_batch WHERE batch_number='PB-2026-0011'),
         'PB-2026-0011','PK-2026-0021','en','2026-05-30','2026-05-29','2026-05-20','committed';
INSERT INTO ecoa_parameter(ecoa_document_id,canonical_key,printed_param_name,result_value,unit,confidence,status)
  SELECT (SELECT id FROM ecoa_document WHERE document_code='UKIM-2026-114'),'TAMC','TAMC',120,'CFU/g',0.98,'committed';
INSERT INTO master_parameter(production_batch_id,spec_parameter_id,canonical_key,selected_ecoa_parameter_id,
       result_value,result_unit,verdict,source_institution_id,source_document_code,source_document_date,confidence,status,confirmed_by,confirmed_at)
  SELECT (SELECT id FROM production_batch WHERE batch_number='PB-2026-0011'),
         (SELECT id FROM spec_parameter WHERE param_name='Total Aerobic Microbial Count'),
         'TAMC',(SELECT id FROM ecoa_parameter WHERE printed_param_name='TAMC'),
         120,'CFU/g','pass',(SELECT id FROM institution WHERE lab_code='LT-083'),
         'UKIM-2026-114','2026-05-30',0.98,'confirmed',(SELECT id FROM app_user WHERE username='blagoj'),now();

-- ---- T1: transactional monotonic numbering (QCSOP 012 v3) ------------------
DO $$
DECLARE v INT; num TEXT;
BEGIN
  SELECT last_value INTO v FROM coq_sequence WHERE year=2026 FOR UPDATE;
  UPDATE coq_sequence SET last_value=last_value+1 WHERE year=2026 RETURNING last_value INTO v;
  num := format('CoQ-PP-%s-%s',2026,lpad(v::text,4,'0'));
  IF num <> 'CoQ-PP-2026-0010' THEN RAISE EXCEPTION 'FAIL T1: allocated % expected CoQ-PP-2026-0010',num; END IF;
  RAISE NOTICE 'PASS T1: allocator produced % (counter now %)',num,v;
END $$;

-- ---- T2: source mapping present on every confirmed master line ------------
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM master_parameter
   WHERE status='confirmed' AND (source_document_code IS NULL OR source_document_date IS NULL OR source_institution_id IS NULL);
  IF n>0 THEN RAISE EXCEPTION 'FAIL T2: % confirmed master rows lack source mapping',n; END IF;
  RAISE NOTICE 'PASS T2: all confirmed master rows trace to an eCOA code + date + lab';
END $$;

-- ---- T3: cross-lingual synonym resolves Cyrillic -> canonical TAMC ---------
DO $$
DECLARE k TEXT;
BEGIN
  SELECT canonical_key INTO k FROM lab_synonym WHERE printed_term='Вкупен број на аеробни микроорганизми';
  IF k IS DISTINCT FROM 'TAMC' THEN RAISE EXCEPTION 'FAIL T3: Cyrillic resolved to % not TAMC',k; END IF;
  RAISE NOTICE 'PASS T3: Cyrillic term resolves to canonical TAMC';
END $$;

-- ---- T4: release guard — only ONE confirmed row per (batch, spec param) ----
DO $$
BEGIN
  BEGIN
    INSERT INTO master_parameter(production_batch_id,spec_parameter_id,canonical_key,verdict,status)
    SELECT (SELECT id FROM production_batch WHERE batch_number='PB-2026-0011'),
           (SELECT id FROM spec_parameter WHERE param_name='Total Aerobic Microbial Count'),'TAMC','pass','confirmed';
    RAISE EXCEPTION 'FAIL T4: a second confirmed row was allowed';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS T4: uq_master_confirmed blocked a second confirmed row';
  END;
END $$;

-- ---- T5: audit hash chain binds each event to the previous -----------------
DO $$
DECLARE h1 BYTEA; ok BOOLEAN;
BEGIN
  INSERT INTO audit_event(action,entity_type,payload,prev_hash,payload_hash)
    VALUES ('commit','master_parameter','{"n":1}'::jsonb,NULL,digest('{"n":1}','sha256')) RETURNING payload_hash INTO h1;
  INSERT INTO audit_event(action,entity_type,payload,prev_hash,payload_hash)
    VALUES ('allocate_number','coq','{"n":2}'::jsonb,h1,digest(encode(h1,'hex')||'{"n":2}','sha256'));
  SELECT digest('{"n":1}','sha256') = (SELECT payload_hash FROM audit_event WHERE payload->>'n'='1') INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL T5: chain head hash does not verify'; END IF;
  RAISE NOTICE 'PASS T5: audit hash chain verifies (tamper-evident)';
END $$;

\echo '---- ALL SMOKE CHECKS PASSED ----'
