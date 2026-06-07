-- ============================================================================
-- Real Purely Plant product specifications, parsed from the owner-supplied
-- documents:
--   QCSP-IMB-001 v.01 (Cannabis flos - Intermediate Bulk & sFP)  26 May 2026
--   QCSP-FP-001  v.01 (Cannabis flos - Finished Product / pharmacy) 26 May 2026
-- Both carry the SAME 18-parameter analytical panel (Ph. Eur. monograph 3028)
-- and the SAME THC-dominant grade tiers I-V; they differ in packaging and the
-- product-code prefix (PP-sFP- vs PP-FP-).
--
-- Idempotent: safe to re-run. Load AFTER db/schema.sql.
-- Wrapped in one transaction so the ON COMMIT DROP temp tables survive until
-- the final COMMIT (psql runs statements autocommit otherwise).
-- ============================================================================
BEGIN;

-- ---- canonical parameter ontology -----------------------------------------
INSERT INTO parameter_dictionary(canonical_key,display_name,category,canonical_unit) VALUES
 ('APPEARANCE','Appearance','physical',NULL),
 ('ID_THC_CBD','Identification (THC & CBD)','identity',NULL),
 ('THC_TOTAL','Total Delta-9-THC (assay)','cannabinoids','% w/w'),
 ('CBD_TOTAL','Total CBD (assay)','cannabinoids','% w/w'),
 ('CBN','Cannabinol (CBN)','cannabinoids','% w/w'),
 ('LOD','Loss on Drying','physical','% w/w'),
 ('FOREIGN_MATTER','Foreign Matter','physical','% w/w'),
 ('TAMC','Total Aerobic Microbial Count','microbiology','CFU/g'),
 ('TYMC','Total Yeast & Mould Count','microbiology','CFU/g'),
 ('BTGN','Bile-tolerant gram-negative bacteria','microbiology','CFU/g'),
 ('E_COLI','Escherichia coli','microbiology',NULL),
 ('SALMONELLA','Salmonella','microbiology',NULL),
 ('AFLATOXINS_TOTAL','Total Aflatoxins (B1+B2+G1+G2)','mycotoxins','ug/kg'),
 ('Pb','Lead (Pb)','heavy_metals','mg/kg'),
 ('Cd','Cadmium (Cd)','heavy_metals','mg/kg'),
 ('As','Arsenic (As)','heavy_metals','mg/kg'),
 ('Hg','Mercury (Hg)','heavy_metals','mg/kg'),
 ('PESTICIDES','Pesticides','pesticides',NULL)
ON CONFLICT (canonical_key) DO NOTHING;

-- ---- the two specs --------------------------------------------------------
INSERT INTO product_spec(spec_code,version,category,title,is_active,effective_from) VALUES
 ('QCSP-IMB-001','v.01','IMB','Cannabis flos - Intermediate Bulk & sFP (Ph. Eur. 3028)', true,'2026-05-26'),
 ('QCSP-FP-001','v.01','FP','Cannabis flos - Finished Product, pharmacy dispensing (Ph. Eur. 3028)', true,'2026-05-26')
ON CONFLICT (spec_code,version) DO NOTHING;

-- ---- shared analytical panel (18 parameters) ------------------------------
CREATE TEMP TABLE _p(ord int, ckey text, pname text, method text, op text, lo numeric, hi numeric, ltxt text, unit text) ON COMMIT DROP;
INSERT INTO _p VALUES
 (1,'APPEARANCE','Appearance','Visual / Ph. Eur. mon. 3028',NULL,NULL,NULL,'Green to brown female inflorescence, characteristic aromatic odour',NULL),
 (2,'ID_THC_CBD','Identification (THC & CBD)','Ph. Eur. 2.2.29 HPLC / DAB',NULL,NULL,NULL,'Retention times correspond to reference standards',NULL),
 (3,'THC_TOTAL','Assay - Total Delta-9-THC','Ph. Eur. 2.2.29 HPLC / DAB','range',NULL,NULL,'Per grade acceptance range (see spec_grade)','% w/w'),
 (4,'CBD_TOTAL','Assay - Total CBD','Ph. Eur. 2.2.29 HPLC / DAB','<',NULL,1.0,'< 1.0% w/w','% w/w'),
 (5,'CBN','Related Substances - CBN','Ph. Eur. 2.2.29 HPLC / DAB','<',NULL,1.0,'< 1.0% w/w','% w/w'),
 (6,'LOD','Loss on Drying','Ph. Eur. 2.2.32 (11.5 Cannabis Flos mon. 3028)','<',NULL,12.0,'< 12.0% w/w','% w/w'),
 (7,'FOREIGN_MATTER','Foreign Matter','Ph. Eur. 2.8.2','<',NULL,2.0,'< 2.0% w/w','% w/w'),
 (8,'TAMC','TAMC','Ph. Eur. 2.6.12 / 5.1.8 Cat. C','<=',NULL,100000,'<= 10^5 CFU/g','CFU/g'),
 (9,'TYMC','TYMC','Ph. Eur. 2.6.12 / 5.1.8 Cat. C','<=',NULL,10000,'<= 10^4 CFU/g','CFU/g'),
 (10,'BTGN','Bile-tolerant gram-neg. bacteria','Ph. Eur. 2.6.12 / 5.1.8 Cat. C','<=',NULL,10000,'<= 10^4 CFU/g','CFU/g'),
 (11,'E_COLI','Escherichia coli','Ph. Eur. 2.6.12 / 5.1.8 Cat. C',NULL,NULL,NULL,'Absent / g',NULL),
 (12,'SALMONELLA','Salmonella','Ph. Eur. 2.6.31 / 5.1.8 Cat. C',NULL,NULL,NULL,'Absent / 25 g',NULL),
 (13,'AFLATOXINS_TOTAL','Total Aflatoxins (B1+B2+G1+G2)','Ph. Eur. 2.8.18 / AflaTest','<',NULL,4,'< 4 ug/kg','ug/kg'),
 (14,'Pb','Lead (Pb)','Ph. Eur. 2.4.27 / ICP-MS','<=',NULL,0.5,'<= 0.5 mg/kg','mg/kg'),
 (15,'Cd','Cadmium (Cd)','Ph. Eur. 2.4.27 / ICP-MS','<=',NULL,0.3,'<= 0.3 mg/kg','mg/kg'),
 (16,'As','Arsenic (As)','Ph. Eur. 2.4.27 / ICP-MS','<=',NULL,0.2,'<= 0.2 mg/kg','mg/kg'),
 (17,'Hg','Mercury (Hg)','Ph. Eur. 2.4.27 / ICP-MS','<=',NULL,0.1,'<= 0.1 mg/kg','mg/kg'),
 (18,'PESTICIDES','Pesticides','(a) Ph. Eur. 2.8.13 / MKC EN 15662:2020 GC-MS/MS & LC-MS/MS; (b) CUMCS-GAP/GMP equivalency',NULL,NULL,NULL,
     '(a) < Ph. Eur. Table 2.8.13-1, total <= 0.5 mg/kg; (b) Cat.1 banned: ND, Cat.2 < CUMCS action limits, default <= 0.01 mg/kg',NULL);

INSERT INTO spec_parameter(product_spec_id,canonical_key,param_name,method,operator,limit_low,limit_high,limit_text,unit,is_mandatory,display_order)
SELECT s.id, p.ckey, p.pname, p.method, p.op, p.lo, p.hi, p.ltxt, p.unit, true, p.ord
FROM _p p CROSS JOIN product_spec s
WHERE s.spec_code IN ('QCSP-IMB-001','QCSP-FP-001') AND s.version='v.01'
ON CONFLICT (product_spec_id, param_name) DO NOTHING;

-- ---- THC-dominant grade tiers (I-V) ---------------------------------------
CREATE TEMP TABLE _g(ord int, grade text, desig text, code_imb text, code_fp text,
                     target numeric, tol text, lo numeric, hi numeric, cbd numeric) ON COMMIT DROP;
INSERT INTO _g VALUES
 (1,'I',  'THC27','PP-sFP-THC27:CBD1','PP-FP-THC27:CBD1',27.0,'+/-2%',25.0,28.9,1.0),
 (2,'II', 'THC23','PP-sFP-THC23:CBD1','PP-FP-THC23:CBD1',23.0,'+/-2%',21.0,24.9,1.0),
 (3,'III','THC19','PP-sFP-THC19:CBD1','PP-FP-THC19:CBD1',19.0,'+/-2%',17.0,20.9,1.0),
 (4,'IV', 'THC15','PP-sFP-THC15:CBD1','PP-FP-THC15:CBD1',15.0,'+/-2%',13.0,16.9,1.0),
 (5,'V',  'THC9', 'PP-sFP-THC9:CBD1', 'PP-FP-THC9:CBD1',  9.0,'+/-4%', 5.0,12.9,1.0);

INSERT INTO spec_grade(product_spec_id,grade,designation,product_code,thc_target,thc_tolerance,thc_low,thc_high,cbd_max,display_order)
SELECT s.id, g.grade, g.desig,
       CASE WHEN s.spec_code='QCSP-IMB-001' THEN g.code_imb ELSE g.code_fp END,
       g.target, g.tol, g.lo, g.hi, g.cbd, g.ord
FROM _g g CROSS JOIN product_spec s
WHERE s.spec_code IN ('QCSP-IMB-001','QCSP-FP-001') AND s.version='v.01'
ON CONFLICT (product_spec_id, grade) DO NOTHING;

COMMIT;
