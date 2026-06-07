-- Demo batch for exercising the generator/issue engine end-to-end against the real
-- Variation F template. Load AFTER db/schema.sql + tests/fixtures/seed_real_specs.sql.
-- Idempotent-ish (uses ON CONFLICT DO NOTHING on natural keys). Not used by CI.
BEGIN;

INSERT INTO institution(lab_code,name,address,credentials,default_language) VALUES
 ('PP-QC','Purely Plant QC Laboratory','Petrovec, North Macedonia','Internal QC (MK GMP)','en'),
 ('LT-083','UKIM','Skopje, North Macedonia','ISO/IEC 17025','en'),
 ('LT-005','IJZ','Skopje, North Macedonia','ISO/IEC 17025','mk'),
 ('LT-201','EuroMetals Labs','Thessaloniki, Greece','ISO/IEC 17025','en')
ON CONFLICT (lab_code) DO NOTHING;

INSERT INTO cultivation_batch(batch_number,strain,thc_grade,grow_site,harvest_date,quantity_kg)
 VALUES ('CB-2026-0007','Blue Gelato','THC27','Petrovec GH-3','2026-03-01',42.5)
ON CONFLICT (batch_number) DO NOTHING;

INSERT INTO production_batch(batch_number,cultivation_batch_id,product_spec_id,dominance,grade,
       grade_designation,product_name,production_date,quantity_kg,status)
SELECT 'PB-2026-0011', cb.id, ps.id, 'THC','I','THC27','Cannabis Flower Intermediate Bulk',
       '2026-04-10', 38.0, 'testing'
FROM cultivation_batch cb, product_spec ps
WHERE cb.batch_number='CB-2026-0007' AND ps.spec_code='QCSP-IMB-001' AND ps.version='v.01'
ON CONFLICT (batch_number) DO NOTHING;

INSERT INTO packaging_batch(packaging_batch_number,production_batch_id,packaging_date,pack_format,quantity_units)
SELECT 'PK-2026-0047', pb.id, '2026-05-18','400 g triplex aluminium foil bag', 95
FROM production_batch pb WHERE pb.batch_number='PB-2026-0011'
ON CONFLICT (packaging_batch_number) DO NOTHING;

-- master parameters across categories + labs (internal iCoA + 3 outsourced eCoAs)
CREATE TEMP TABLE _m(ckey text, rtext text, rval numeric, qual text, unit text,
                     lab text, src text, sdate date) ON COMMIT DROP;
INSERT INTO _m VALUES
 ('APPEARANCE','Conforms',NULL,NULL,NULL,'PP-QC','iCoA-PP-2026-0003','2026-05-12'),
 ('ID_THC_CBD','Conforms',NULL,NULL,NULL,'PP-QC','iCoA-PP-2026-0003','2026-05-12'),
 ('FOREIGN_MATTER',NULL,0.4,'<','% w/w','PP-QC','iCoA-PP-2026-0003','2026-05-12'),
 ('THC_TOTAL',NULL,26.8,NULL,'% w/w','LT-083','UKIM-2026-114','2026-05-09'),
 ('CBD_TOTAL',NULL,0.4,'<','% w/w','LT-083','UKIM-2026-114','2026-05-09'),
 ('CBN',NULL,0.3,'<','% w/w','LT-083','UKIM-2026-114','2026-05-09'),
 ('LOD',NULL,8.1,NULL,'% w/w','LT-083','UKIM-2026-114','2026-05-09'),
 ('TAMC',NULL,120,NULL,'CFU/g','LT-005','IJZ-2026-077','2026-05-07'),
 ('TYMC',NULL,10,'<','CFU/g','LT-005','IJZ-2026-077','2026-05-07'),
 ('E_COLI','Absent / g',NULL,NULL,NULL,'LT-005','IJZ-2026-077','2026-05-07'),
 ('Pb',NULL,0.20,NULL,'mg/kg','LT-201','EM-2026-051','2026-05-06'),
 ('Cd',NULL,0.10,NULL,'mg/kg','LT-201','EM-2026-051','2026-05-06');

INSERT INTO master_parameter(production_batch_id,spec_parameter_id,canonical_key,result_value,
       result_text,result_qualifier,result_unit,verdict,source_institution_id,source_document_code,
       source_document_date,confidence,status,confirmed_at)
SELECT pb.id, sp.id, m.ckey, m.rval, m.rtext, m.qual, m.unit, 'pass', i.id, m.src, m.sdate,
       0.98, 'confirmed', now()
FROM _m m
JOIN production_batch pb ON pb.batch_number='PB-2026-0011'
LEFT JOIN product_spec ps ON ps.spec_code='QCSP-IMB-001' AND ps.version='v.01'
LEFT JOIN spec_parameter sp ON sp.product_spec_id=ps.id AND sp.canonical_key=m.ckey
LEFT JOIN institution i ON i.lab_code=m.lab
ON CONFLICT DO NOTHING;

COMMIT;
