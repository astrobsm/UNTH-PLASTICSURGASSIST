# Question bank audit

Source: `C:/Users/HomePC/Documents/GitHub/CHAMBER/packages/backend/database/seeds`
Run: 2026-09-05T10:44:42.372Z

## Content graph integrity

- topic id collisions: **68**
- questions pointing at an undeclared topic: **0**
- questions whose category disagrees with their topic: **0**
- CME articles declared more than once: **62**

### Topic ids claimed by more than one file

The seeds insert `ON CONFLICT DO NOTHING`, so the first file to claim an id keeps it
and the rest are dropped without a word. Collisions where nothing references the id are
dead weight; collisions where something does would mis-file questions.

**50 of 68 collisions have a question referencing the id.**

| id | kept (first file wins) | discarded | questions referencing |
| --- | --- | --- | ---: |
| `c0000001-0000…` | Hirschsprung's Disease: Management — `200_surgery3_setup.sql` | Acute Abdomen — `301_surgery2_topics.sql` | 59 |
| `c0000002-0000…` | Anterior Abdominal Wall Defects — `200_surgery3_setup.sql` | Acute Appendicitis — `301_surgery2_topics.sql` | 0 |
| `c0000003-0000…` | Management of Anorectal Anomalies — `200_surgery3_setup.sql` | Intestinal Obstruction — `301_surgery2_topics.sql` | 0 |
| `c0000004-0000…` | Childhood Malignancies: Nephroblastoma — `200_surgery3_setup.sql` | Enterocutaneous Fistulae — `301_surgery2_topics.sql` | 0 |
| `c0000005-0000…` | Paediatric Obstructive Jaundice — `200_surgery3_setup.sql` | Surgical Jaundice — `301_surgery2_topics.sql` | 0 |
| `c0000006-0000…` | Management of Cleft Lip and Palate — `200_surgery3_setup.sql` | Surgery in Diabetic Patients — `301_surgery2_topics.sql` | 0 |
| `c0000007-0000…` | Childhood Malignancies: Neuroblastoma — `200_surgery3_setup.sql` | Surgical Infections — `301_surgery2_topics.sql` | 55 |
| `c0000008-0000…` | Childhood Malignancies: Lymphomas — `200_surgery3_setup.sql` | Surgical Salmonellosis — `301_surgery2_topics.sql` | 52 |
| `c0000009-0000…` | Ambiguous Genitalia: Principles of Management — `200_surgery3_setup.sql` | Surgical Parasitosis — `301_surgery2_topics.sql` | 0 |
| `c0000010-0000…` | Common Congenital Hand Anomalies — `200_surgery3_setup.sql` | Abdominal Tuberculosis — `301_surgery2_topics.sql` | 0 |
| `c0000011-0000…` | Urolithiasis — `200_surgery3_setup.sql` | Trauma Management — `301_surgery2_topics.sql` | 0 |
| `c0000012-0000…` | Hypospadias and Epispadias — `200_surgery3_setup.sql` | ATLS Principles — `301_surgery2_topics.sql` | 0 |
| `c0000013-0000…` | Tumors of the Urinary System — `200_surgery3_setup.sql` | Abdominal Trauma — `301_surgery2_topics.sql` | 0 |
| `c0000014-0000…` | Posterior Urethral Valve Obstruction and Complications — `200_surgery3_setup.sql` | Chest Trauma — `301_surgery2_topics.sql` | 0 |
| `c0000015-0000…` | Testicular Tumors — `200_surgery3_setup.sql` | Cardiac Tamponade — `301_surgery2_topics.sql` | 52 |
| `c0000016-0000…` | Haematuria: Trauma to Kidney, Ureter, and Bladder — `200_surgery3_setup.sql` | Spinal Injuries — `301_surgery2_topics.sql` | 0 |
| `c0000017-0000…` | Management of Dysphagia — `200_surgery3_setup.sql` | Pelvic Fractures — `301_surgery2_topics.sql` | 0 |
| `c0000018-0000…` | Mediastinal Masses — `200_surgery3_setup.sql` | Compartment Syndrome — `301_surgery2_topics.sql` | 0 |
| `c0000019-0000…` | Management of Oesophageal Diseases — `200_surgery3_setup.sql` | Burns Management — `301_surgery2_topics.sql` | 0 |
| `c0000020-0000…` | Malignancies of the Lung and Pleura — `200_surgery3_setup.sql` | Haemostasis in Surgery — `301_surgery2_topics.sql` | 60 |
| `c0000021-0000…` | Inflammatory Diseases of Lung and Pleura — `200_surgery3_setup.sql` | Inotropes and Vasopressors — `301_surgery2_topics.sql` | 0 |
| `c0000022-0000…` | Common Metabolic Bone Diseases — `200_surgery3_setup.sql` | Thrombo-embolism — `301_surgery2_topics.sql` | 55 |
| `c0000023-0000…` | Childhood Orthopaedic Disorders — `200_surgery3_setup.sql` | Varicose Veins — `301_surgery2_topics.sql` | 54 |
| `c0000024-0000…` | Septic Arthritis and Chronic Bone and Joint Infections — `200_surgery3_setup.sql` | Surgical Nutrition — `301_surgery2_topics.sql` | 60 |
| `c0000025-0000…` | Spinal Injuries and Principles of Trauma Care — `200_surgery3_setup.sql` | Central Venous Lines — `301_surgery2_topics.sql` | 56 |
| `c0000026-0000…` | Acute and Chronic Osteomyelitis — `200_surgery3_setup.sql` | Surgical Imaging — `301_surgery2_topics.sql` | 58 |
| `c0000027-0000…` | Tuberculosis of the Spine and Other Bones and Joints — `200_surgery3_setup.sql` | Metabolic Bone Diseases — `301_surgery2_topics.sql` | 108 |
| `c0000028-0000…` | Hand Injuries and Infections — `200_surgery3_setup.sql` | Surgical Arthritis — `301_surgery2_topics.sql` | 56 |
| `c0000029-0000…` | Burns — `200_surgery3_setup.sql` | Bone Tumours — `301_surgery2_topics.sql` | 53 |
| `c0000030-0000…` | Chronic Leg Ulcers — `200_surgery3_setup.sql` | Glasgow Coma Scale — `301_surgery2_topics.sql` | 48 |
| `c0000031-0000…` | Chronic Lymphoedema — `200_surgery3_setup.sql` | Hydrocephalus — `301_surgery2_topics.sql` | 52 |
| `c0000032-0000…` | Jaw Tumors — `200_surgery3_setup.sql` | Intracranial Suppurations — `301_surgery2_topics.sql` | 45 |
| `c0000033-0000…` | Arterial Injuries, Peripheral Aneurysms, and Acute Limb Ischaemia — `200_surgery3_setup.sql` | CNS Tumours — `301_surgery2_topics.sql` | 47 |
| `c0000034-0000…` | Principles of Management of Brain and Spinal Cord Tumours — `200_surgery3_setup.sql` | Suturing Techniques — `301_surgery2_topics.sql` | 49 |
| `c0000035-0000…` | Medical Imaging in Surgery — `200_surgery3_setup.sql` | Keloids and Scars — `301_surgery2_topics.sql` | 48 |
| `c0000036-0000…` | Arterial and Venous Diseases of the Limbs — `200b_surgery3_additional_topics.sql` | Hand Infections — `301_surgery2_topics.sql` | 51 |
| `c0000037-0000…` | Hemorrhoids, Fissures, Fistulas, and Other Anorectal Conditions — `200b_surgery3_additional_topics.sql` | Benign Breast Diseases — `301_surgery2_topics.sql` | 44 |
| `c0000038-0000…` | Soft Tissue Tumors, Skin Cancers, and Related Conditions — `200b_surgery3_additional_topics.sql` | Benign Thyroid Diseases — `301_surgery2_topics.sql` | 43 |
| `c0000039-0000…` | Pediatric Urological and Congenital Conditions — `200b_surgery3_additional_topics.sql` | External Hernias — `301_surgery2_topics.sql` | 40 |
| `c0000040-0000…` | Trauma Management, Emergency Procedures, and Critical Care — `200b_surgery3_additional_topics.sql` | Colorectal Diseases — `301_surgery2_topics.sql` | 40 |
| `c0000041-0000…` | GERD, Achalasia, Esophageal Cancer, Esophageal Perforations — `200b_surgery3_additional_topics.sql` | Anorectal Diseases — `301_surgery2_topics.sql` | 35 |
| `c0000042-0000…` | Gastric Cancer, Gastric Ulcers, Gastric Outlet Obstruction — `200b_surgery3_additional_topics.sql` | Gallstones — `301_surgery2_topics.sql` | 34 |
| `c0000043-0000…` | Liver Tumors, Liver Surgery, Portal Hypertension, Bile Duct Injuries — `200b_surgery3_additional_topics.sql` | Dysphagia — `301_surgery2_topics.sql` | 35 |
| `c0000044-0000…` | Pancreatic Cancer, Pancreatic Cysts, Chronic Pancreatitis Surgery — `200b_surgery3_additional_topics.sql` | Urinary System Tumours — `301_surgery2_topics.sql` | 33 |
| `c0000045-0000…` | Splenectomy, Splenic Disorders, Adrenal Tumors, Pheochromocytoma — `200b_surgery3_additional_topics.sql` | Prostate Cancer — `301_surgery2_topics.sql` | 32 |
| `c0000046-0000…` | Small Bowel Tumors, Crohn's Disease Surgery, Mesenteric Ischemia — `200b_surgery3_additional_topics.sql` | BPH — `301_surgery2_topics.sql` | 29 |
| `c0000047-0000…` | Diverticulitis, Large Bowel Obstruction, Ischemic Colitis, Volvulus — `200b_surgery3_additional_topics.sql` | LUTS and IPSS — `301_surgery2_topics.sql` | 33 |
| `c0000048-0000…` | Colon Cancer, Rectal Cancer, Hereditary Syndromes, Staging, Treatment — `200b_surgery3_additional_topics.sql` | Urethral Injuries — `301_surgery2_topics.sql` | 33 |
| `c0000049-0000…` | Hemorrhoids, Fissure, Fistula, Abscess, Pilonidal, Rectal Prolapse — `200b_surgery3_additional_topics.sql` | Haematuria and GU Trauma — `301_surgery2_topics.sql` | 30 |
| `c0000050-0000…` | Obesity Surgery, Procedures, Complications, Nutritional Management — `200b_surgery3_additional_topics.sql` | Urolithiasis — `301_surgery2_topics.sql` | 24 |
| `c0000051-0000…` | Cancer Biology, Staging, Multimodality Treatment, Surgical Margins — `200b_surgery3_additional_topics.sql` | Male Infertility — `301_surgery2_topics.sql` | 21 |
| `c0000052-0000…` | Wound Healing Phases, Wound Care, SSI, Antibiotics — `200b_surgery3_additional_topics.sql` | Undescended Testis — `301_surgery2_topics.sql` | 23 |
| `c0000053-0000…` | Preoperative Evaluation, Cardiac Risk, VTE Prophylaxis, Postop Complications — `200b_surgery3_additional_topics.sql` | Scrotal Pathology — `301_surgery2_topics.sql` | 22 |
| `c0000054-0000…` | Fluid Resuscitation, Electrolyte Disorders, Acid-Base Balance — `200b_surgery3_additional_topics.sql` | Intussusception — `301_surgery2_topics.sql` | 21 |
| `c0000055-0000…` | Shock Types, Resuscitation, Sepsis, ARDS, Mechanical Ventilation — `200b_surgery3_additional_topics.sql` | Pediatric Neck Masses — `301_surgery2_topics.sql` | 22 |
| `c0000056-0000…` | Nutritional Assessment, Enteral and Parenteral Nutrition, Refeeding — `200b_surgery3_additional_topics.sql` | Radiotherapy in Surgery — `301_surgery2_topics.sql` | 23 |
| `c0000057-0000…` | Organ Transplantation Principles, Immunosuppression, Rejection — `200b_surgery3_additional_topics.sql` | BRCA Genes — `301_surgery2_topics.sql` | 21 |
| `c0000058-0000…` | AAA, Peripheral Arterial Disease, Carotid Disease, Venous Disease — `200b_surgery3_additional_topics.sql` | Molecular Surgery — `301_surgery2_topics.sql` | 24 |
| `c0000059-0000…` | Lung Cancer, Pneumothorax, Esophageal Perforation, Mediastinal Tumors — `200b_surgery3_additional_topics.sql` | Open Heart Surgery — `301_surgery2_topics.sql` | 23 |
| `c0000060-0000…` | Skin Cancer, Melanoma, Soft Tissue Sarcoma, Burns — `200b_surgery3_additional_topics.sql` | Organ Transplantation — `301_surgery2_topics.sql` | 21 |
| `c0000061-0000…` | Neonatal Emergencies, Congenital Anomalies, Pediatric Abdominal — `200b_surgery3_additional_topics.sql` | Venomous Bites and Stings — `301_surgery2_topics.sql` | 25 |
| `c0000063-0000…` | Surgical Decision-Making, Informed Consent, Surgical Safety, Drains/Tubes — `200b_surgery3_additional_topics.sql` | Surgical Principles and Safety — `348_s3_mcq_batch48_surgical_principles.sql` | 22 |
| `c0000064-0000…` | Essential Surgical Anatomy - Abdomen, Vascular, Retroperitoneum — `200b_surgery3_additional_topics.sql` | Surgical Anatomy Review — `349_s3_mcq_batch49_anatomy.sql` | 24 |
| `c0000065-0000…` | Postoperative Complications - Recognition and Treatment — `200b_surgery3_additional_topics.sql` | Surgical Complications — `350_s3_mcq_batch50_complications.sql` | 27 |
| `c0000066-0000…` | Fracture Management, Bone Healing, Orthopedic Emergencies — `200b_surgery3_additional_topics.sql` | Orthopedic Surgery Principles — `351_s3_mcq_batch51_orthopedics.sql` | 29 |
| `c0000067-0000…` | General Surgical Emergencies - Diagnosis and Management — `200b_surgery3_additional_topics.sql` | Surgical Emergencies Review — `352_s3_mcq_batch52_emergencies.sql` | 30 |
| `c0000180-0000…` | Venous Thromboembolism Prevention — `512_s3_cme_article114_vte.sql` | Perioperative Cardiac Risk Assessment — `512_s3_cme_article115_perioperative.sql` | 0 |
| `c0000181-0000…` | Nutrition in Surgical Patients — `513_s3_cme_article115_nutrition.sql` | Surgical Nutrition and Metabolic Support — `513_s3_cme_article116_nutrition.sql` | 0 |

### CME articles declared more than once (62)

- `d2000001-0000-0000-0000-000000000001` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000002-0000-0000-0000-000000000002` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000003-0000-0000-0000-000000000003` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000004-0000-0000-0000-000000000004` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000005-0000-0000-0000-000000000005` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000006-0000-0000-0000-000000000006` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000007-0000-0000-0000-000000000007` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000008-0000-0000-0000-000000000008` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000009-0000-0000-0000-000000000009` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000010-0000-0000-0000-000000000010` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000011-0000-0000-0000-000000000011` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000012-0000-0000-0000-000000000012` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000013-0000-0000-0000-000000000013` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000014-0000-0000-0000-000000000014` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000015-0000-0000-0000-000000000015` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000016-0000-0000-0000-000000000016` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000017-0000-0000-0000-000000000017` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000018-0000-0000-0000-000000000018` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000019-0000-0000-0000-000000000019` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000020-0000-0000-0000-000000000020` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000021-0000-0000-0000-000000000021` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000022-0000-0000-0000-000000000022` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000023-0000-0000-0000-000000000023` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000024-0000-0000-0000-000000000024` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000025-0000-0000-0000-000000000025` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000026-0000-0000-0000-000000000026` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000027-0000-0000-0000-000000000027` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000028-0000-0000-0000-000000000028` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000029-0000-0000-0000-000000000029` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000030-0000-0000-0000-000000000030` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000031-0000-0000-0000-000000000031` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000032-0000-0000-0000-000000000032` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000033-0000-0000-0000-000000000033` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000034-0000-0000-0000-000000000034` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000035-0000-0000-0000-000000000035` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000036-0000-0000-0000-000000000036` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000037-0000-0000-0000-000000000037` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000038-0000-0000-0000-000000000038` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000039-0000-0000-0000-000000000039` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- `d2000040-0000-0000-0000-000000000040` — 300_surgery2_complete_setup.sql, 302_surgery2_articles.sql
- …and 22 more

## CBT question bank (`questions`)

- parsed: **7844**
- clean: **3574**
- with errors: **39**
- with warnings only: **4231**

| severity | check | count |
| --- | --- | ---: |
| warn | key-length-cue | 3847 |
| warn | duplicate-stem-across-topics | 622 |
| warn | explanation-ignores-key | 99 |
| warn | unmarked-negative | 42 |
| error | duplicate-stem-in-topic | 30 |
| warn | low-vocabulary-overlap | 26 |
| error | stub-stem | 5 |
| error | duplicate-question | 4 |
| warn | catchall-misplaced | 3 |
| warn | all-and-none | 1 |

Answer key balance: {"B":7148,"D":151,"C":387,"A":137,"E":21}

### error: duplicate-stem-in-topic (30)

- `04_questions_batch3.sql` #15 — Shock
  - the same stem appears 2 times within one topic
  - stem: The "lethal triad" in trauma refers to:
- `08_questions_batch7.sql` #17 — Blood and Blood Products in Surgery
  - the same stem appears 2 times within one topic
  - stem: The most common cause of fatal transfusion reactions is:
- `08_questions_batch7.sql` #26 — Blood and Blood Products in Surgery
  - the same stem appears 2 times within one topic
  - stem: Complications of massive transfusion include all EXCEPT:
- `08_questions_batch7.sql` #31 — Blood and Blood Products in Surgery
  - the same stem appears 2 times within one topic
  - stem: Irradiated blood products are indicated for:
- `08_questions_batch7.sql` #32 — Blood and Blood Products in Surgery
  - the same stem appears 2 times within one topic
  - stem: Washed RBCs are indicated for:
- `08_questions_batch7.sql` #39 — Blood and Blood Products in Surgery
  - the same stem appears 2 times within one topic
  - stem: Cell salvage (intraoperative blood salvage) is contraindicated in:
- `10_questions_batch9.sql` #16 — Principles of Fracture Management
  - the same stem appears 2 times within one topic
  - stem: Secondary (indirect) bone healing is characterized by:
- `11_questions_batch10.sql` #8 — Surgical Wounds and Antibiotic Prophylaxis
  - the same stem appears 2 times within one topic
  - stem: Delayed primary closure (tertiary intention) involves:
- `11_questions_batch10.sql` #14 — Surgical Wounds and Antibiotic Prophylaxis
  - the same stem appears 2 times within one topic
  - stem: Patient risk factors for SSI include all EXCEPT:
- `11_questions_batch10.sql` #27 — Surgical Wounds and Antibiotic Prophylaxis
  - the same stem appears 2 times within one topic
  - stem: A hematoma in a surgical wound:
- `12_questions_batch11.sql` #2 — Abdominal Wound Incisions
  - the same stem appears 2 times within one topic
  - stem: The linea alba is:
- `19_questions_batch18.sql` #36 — Shock
  - the same stem appears 2 times within one topic
  - stem: The lethal triad in trauma refers to:
- `21_questions_batch20.sql` #2 — Blood and Blood Products in Surgery
  - the same stem appears 2 times within one topic
  - stem: Complications of massive transfusion include all EXCEPT:
- `21_questions_batch20.sql` #12 — Blood and Blood Products in Surgery
  - the same stem appears 2 times within one topic
  - stem: Irradiated blood products are indicated for:
- `21_questions_batch20.sql` #14 — Blood and Blood Products in Surgery
  - the same stem appears 2 times within one topic
  - stem: Washed RBCs are indicated for:
- `21_questions_batch20.sql` #16 — Blood and Blood Products in Surgery
  - the same stem appears 2 times within one topic
  - stem: The most common cause of fatal transfusion reactions is:
- `21_questions_batch20.sql` #29 — Blood and Blood Products in Surgery
  - the same stem appears 2 times within one topic
  - stem: Cell salvage (intraoperative blood salvage) is contraindicated in:
- `22_questions_batch21.sql` #3 — Principles of Fracture Management
  - the same stem appears 2 times within one topic
  - stem: Secondary (indirect) bone healing is characterized by:
- `23_questions_batch22.sql` #15 — Surgical Wounds and Antibiotic Prophylaxis
  - the same stem appears 2 times within one topic
  - stem: Patient risk factors for SSI include all EXCEPT:
- `23_questions_batch22.sql` #27 — Surgical Wounds and Antibiotic Prophylaxis
  - the same stem appears 2 times within one topic
  - stem: Delayed primary closure (tertiary intention) involves:
- `23_questions_batch22.sql` #36 — Surgical Wounds and Antibiotic Prophylaxis
  - the same stem appears 2 times within one topic
  - stem: A hematoma in a surgical wound:
- `24_questions_batch23.sql` #1 — Abdominal Wound Incisions
  - the same stem appears 2 times within one topic
  - stem: The linea alba is:
- `60_questions_batch59.sql` #17 — Urethral Catheterization
  - the same stem appears 2 times within one topic
  - stem: What is suprapubic catheterization and when is it preferred over urethral catheterization?
- `61_questions_batch60.sql` #15 — Cardiopulmonary Resuscitation (CPR)
  - the same stem appears 2 times within one topic
  - stem: What are the reversible causes of cardiac arrest (H's and T's)?
- `63_questions_batch62.sql` #6 — Blood and Blood Products in Surgery
  - the same stem appears 2 times within one topic
  - stem: What is irradiated blood and when is it indicated?
- `64_questions_batch63.sql` #3 — Shock
  - the same stem appears 2 times within one topic
  - stem: What is permissive hypotension in trauma resuscitation?
- `67_questions_batch66.sql` #13 — Cardiopulmonary Resuscitation (CPR)
  - the same stem appears 2 times within one topic
  - stem: What are the reversible causes of cardiac arrest (H's and T's)?
- `69_questions_batch68.sql` #6 — Blood and Blood Products in Surgery
  - the same stem appears 2 times within one topic
  - stem: What is irradiated blood and when is it indicated?
- `69_questions_batch68.sql` #17 — Urethral Catheterization
  - the same stem appears 2 times within one topic
  - stem: What is suprapubic catheterization and when is it preferred over urethral catheterization?
- `72_questions_batch71.sql` #2 — Shock
  - the same stem appears 2 times within one topic
  - stem: What is "permissive hypotension" in trauma resuscitation?

### error: stub-stem (5)

- `18_questions_batch17.sql` #3 — Definition of Terms in Surgery
  - stem is only 11 characters: "Fistula is:"
  - stem: Fistula is:
- `323_s3_mcq_batch23_soft_tissue.sql` #5 — Soft Tissue Tumors, Skin Cancers, and Related Conditions
  - stem is only 11 characters: "Hemangioma:"
  - stem: Hemangioma:
- `323_s3_mcq_batch23_soft_tissue.sql` #26 — Soft Tissue Tumors, Skin Cancers, and Related Conditions
  - stem is only 9 characters: "Melanoma:"
  - stem: Melanoma:
- `456_surgery2_qbank_topic57.sql` #22 — BRCA Genes
  - stem is only 10 characters: "Ranula is:"
  - stem: Ranula is:
- `635_s4_mcq_batch36_brain_tumors.sql` #23 — Brain Tumors
  - stem is only 11 characters: "Ependymoma:"
  - stem: Ependymoma:

### error: duplicate-question (4)

- `10_questions_batch9.sql` #40 — Principles of Fracture Management
  - identical question (stem and all options) appears 2 times: 10_questions_batch9.sql, 305_s3_mcq_batch5_fractures_children.sql
  - stem: The most common Salter-Harris fracture type is:
- `305_s3_mcq_batch5_fractures_children.sql` #10 — Testicular Tumors
  - identical question (stem and all options) appears 2 times: 10_questions_batch9.sql, 305_s3_mcq_batch5_fractures_children.sql
  - stem: The most common Salter-Harris fracture type is:
- `616_s4_mcq_batch17_urological_emergencies.sql` #22 — Urological Emergencies
  - identical question (stem and all options) appears 2 times: 616_s4_mcq_batch17_urological_emergencies.sql, 649_s4_mcq_batch50_comprehensive_review.sql
  - stem: The most common type of kidney stone is:
- `649_s4_mcq_batch50_comprehensive_review.sql` #5 — Comprehensive Surgical Review
  - identical question (stem and all options) appears 2 times: 616_s4_mcq_batch17_urological_emergencies.sql, 649_s4_mcq_batch50_comprehensive_review.sql
  - stem: The most common type of kidney stone is:

### warn: key-length-cue (3847)

- `03_questions_batch2.sql` #30 — TPR Chart and Pyrexia Patterns
  - the key is 3x longer than the average distractor
  - stem: Fever of Unknown Origin (FUO) is defined as:
- `04_questions_batch3.sql` #14 — Shock
  - the key is 3x longer than the average distractor
  - stem: Massive transfusion protocol is typically activated when:
- `04_questions_batch3.sql` #23 — Shock
  - the key is 3x longer than the average distractor
  - stem: Dobutamine is the preferred inotrope in cardiogenic shock because it:
- `04_questions_batch3.sql` #24 — Shock
  - the key is 4x longer than the average distractor
  - stem: Septic shock is defined by the Sepsis-3 criteria as:
- `04_questions_batch3.sql` #31 — Shock
  - the key is 3x longer than the average distractor
  - stem: Source control in sepsis refers to:
- `04_questions_batch3.sql` #35 — Shock
  - the key is 3x longer than the average distractor
  - stem: Adrenaline is preferred in anaphylaxis because it:
- `04_questions_batch3.sql` #45 — Shock
  - the key is 2x longer than the average distractor
  - stem: Tension pneumothorax presents with:
- `04_questions_batch3.sql` #47 — Shock
  - the key is 3x longer than the average distractor
  - stem: Massive pulmonary embolism causes shock by:
- `05_questions_batch4.sql` #7 — Fluid and Electrolytes in Surgery
  - the key is 4x longer than the average distractor
  - stem: Crystalloids are defined as:
- `05_questions_batch4.sql` #12 — Fluid and Electrolytes in Surgery
  - the key is 3x longer than the average distractor
  - stem: Balanced crystalloid solutions are preferred over normal saline because they:
- `05_questions_batch4.sql` #20 — Fluid and Electrolytes in Surgery
  - the key is 4x longer than the average distractor
  - stem: The most common cause of hyponatremia in hospitalized surgical patients is:
- `05_questions_batch4.sql` #40 — Fluid and Electrolytes in Surgery
  - the key is 3x longer than the average distractor
  - stem: Post-operative hyponatremia is most commonly caused by:
- `07_questions_batch6.sql` #35 — Mensuration and Gauges in Medical Practice
  - the key is 11x longer than the average distractor
  - stem: For hemodialysis, the catheter size is typically:
- `08_questions_batch7.sql` #31 — Blood and Blood Products in Surgery
  - the key is 3x longer than the average distractor
  - stem: Irradiated blood products are indicated for:
- `08_questions_batch7.sql` #35 — Blood and Blood Products in Surgery
  - the key is 6x longer than the average distractor
  - stem: Platelet transfusion is generally indicated when count is below:
- `08_questions_batch7.sql` #40 — Blood and Blood Products in Surgery
  - the key is 4x longer than the average distractor
  - stem: Acute normovolemic hemodilution involves:
- `09_questions_batch8.sql` #0 — Blood Conservation Techniques
  - the key is 2x longer than the average distractor
  - stem: Patient Blood Management (PBM) is based on three pillars:
- `09_questions_batch8.sql` #3 — Blood Conservation Techniques
  - the key is 3x longer than the average distractor
  - stem: IV iron is preferred over oral iron when:
- `09_questions_batch8.sql` #7 — Blood Conservation Techniques
  - the key is 3x longer than the average distractor
  - stem: Direct oral anticoagulants (DOACs) should be held before surgery for:
- `09_questions_batch8.sql` #12 — Blood Conservation Techniques
  - the key is 3x longer than the average distractor
  - stem: Acute normovolemic hemodilution (ANH) is performed by:
- `09_questions_batch8.sql` #17 — Blood Conservation Techniques
  - the key is 3x longer than the average distractor
  - stem: Tourniquets in limb surgery:
- `09_questions_batch8.sql` #19 — Blood Conservation Techniques
  - the key is 3x longer than the average distractor
  - stem: Desmopressin (DDAVP) reduces bleeding by:
- `09_questions_batch8.sql` #30 — Blood Conservation Techniques
  - the key is 2x longer than the average distractor
  - stem: Jehovahs Witness patients who refuse blood transfusion:
- `10_questions_batch9.sql` #18 — Principles of Fracture Management
  - the key is 3x longer than the average distractor
  - stem: Non-union is defined as:
- `10_questions_batch9.sql` #20 — Principles of Fracture Management
  - the key is 4x longer than the average distractor
  - stem: Atrophic non-union requires:
- `10_questions_batch9.sql` #24 — Principles of Fracture Management
  - the key is 3x longer than the average distractor
  - stem: Indications for operative treatment of fractures include:
- `11_questions_batch10.sql` #1 — Surgical Wounds and Antibiotic Prophylaxis
  - the key is 3x longer than the average distractor
  - stem: A clean wound (Class I) is defined as:
- `11_questions_batch10.sql` #4 — Surgical Wounds and Antibiotic Prophylaxis
  - the key is 4x longer than the average distractor
  - stem: A contaminated wound (Class III) includes:
- `11_questions_batch10.sql` #5 — Surgical Wounds and Antibiotic Prophylaxis
  - the key is 3x longer than the average distractor
  - stem: Dirty/Infected wounds (Class IV) are characterized by:
- `11_questions_batch10.sql` #18 — Surgical Wounds and Antibiotic Prophylaxis
  - the key is 4x longer than the average distractor
  - stem: Redosing of prophylactic antibiotics intraoperatively is indicated when:
- `12_questions_batch11.sql` #0 — Abdominal Wound Incisions
  - the key is 3x longer than the average distractor
  - stem: The ideal abdominal incision should provide:
- `12_questions_batch11.sql` #1 — Abdominal Wound Incisions
  - the key is 5x longer than the average distractor
  - stem: The layers of the anterior abdominal wall from superficial to deep are:
- `12_questions_batch11.sql` #2 — Abdominal Wound Incisions
  - the key is 5x longer than the average distractor
  - stem: The linea alba is:
- `12_questions_batch11.sql` #3 — Abdominal Wound Incisions
  - the key is 3x longer than the average distractor
  - stem: The arcuate line (of Douglas) marks:
- `12_questions_batch11.sql` #10 — Abdominal Wound Incisions
  - the key is 3x longer than the average distractor
  - stem: A paramedian incision:
- `12_questions_batch11.sql` #12 — Abdominal Wound Incisions
  - the key is 3x longer than the average distractor
  - stem: Transverse abdominal incisions have lower incisional hernia rates because:
- `12_questions_batch11.sql` #15 — Abdominal Wound Incisions
  - the key is 4x longer than the average distractor
  - stem: The Pfannenstiel incision is:
- `12_questions_batch11.sql` #28 — Abdominal Wound Incisions
  - the key is 4x longer than the average distractor
  - stem: Retention sutures (tension sutures) are used when:
- `13_questions_batch12.sql` #10 — Nasogastric Intubation
  - the key is 3x longer than the average distractor
  - stem: Before inserting NGT, the patient should be positioned:
- `13_questions_batch12.sql` #21 — Nasogastric Intubation
  - the key is 2x longer than the average distractor
  - stem: Signs suggesting NGT has entered the airway include:
- …and 3807 more (see question-bank.json)

### warn: duplicate-stem-across-topics (622)

- `04_questions_batch3.sql` #15 — Shock
  - the same stem appears under 3 different topics
  - stem: The "lethal triad" in trauma refers to:
- `04_questions_batch3.sql` #17 — Shock
  - the same stem appears under 2 different topics
  - stem: Permissive hypotension in trauma means:
- `04_questions_batch3.sql` #19 — Shock
  - the same stem appears under 2 different topics
  - stem: Cardiogenic shock is characterized by:
- `04_questions_batch3.sql` #28 — Shock
  - the same stem appears under 3 different topics
  - stem: The first-line vasopressor for septic shock is:
- `04_questions_batch3.sql` #31 — Shock
  - the same stem appears under 3 different topics
  - stem: Source control in sepsis refers to:
- `04_questions_batch3.sql` #38 — Shock
  - the same stem appears under 2 different topics
  - stem: Neurogenic shock is caused by:
- `05_questions_batch4.sql` #8 — Fluid and Electrolytes in Surgery
  - the same stem appears under 2 different topics
  - stem: Normal saline (0.9% NaCl) contains:
- `05_questions_batch4.sql` #28 — Fluid and Electrolytes in Surgery
  - the same stem appears under 2 different topics
  - stem: ECG changes in hypokalemia include:
- `05_questions_batch4.sql` #31 — Fluid and Electrolytes in Surgery
  - the same stem appears under 2 different topics
  - stem: ECG changes in hyperkalemia include:
- `05_questions_batch4.sql` #33 — Fluid and Electrolytes in Surgery
  - the same stem appears under 2 different topics
  - stem: Calcium gluconate in hyperkalemia works by:
- `10_questions_batch9.sql` #0 — Principles of Fracture Management
  - the same stem appears under 2 different topics
  - stem: A fracture is defined as:
- `10_questions_batch9.sql` #17 — Principles of Fracture Management
  - the same stem appears under 2 different topics
  - stem: Factors that impair fracture healing include all EXCEPT:
- `10_questions_batch9.sql` #38 — Principles of Fracture Management
  - the same stem appears under 2 different topics
  - stem: Pediatric fractures heal faster than adult fractures because:
- `11_questions_batch10.sql` #36 — Surgical Wounds and Antibiotic Prophylaxis
  - the same stem appears under 2 different topics
  - stem: Zinc deficiency impairs wound healing by affecting:
- `12_questions_batch11.sql` #1 — Abdominal Wound Incisions
  - the same stem appears under 2 different topics
  - stem: The layers of the anterior abdominal wall from superficial to deep are:
- `15_questions_batch14.sql` #4 — Leg Ulcers
  - the same stem appears under 2 different topics
  - stem: Lipodermatosclerosis refers to:
- `18_questions_batch17.sql` #8 — Definition of Terms in Surgery
  - the same stem appears under 2 different topics
  - stem: Richter hernia involves:
- `18_questions_batch17.sql` #9 — Definition of Terms in Surgery
  - the same stem appears under 2 different topics
  - stem: Littre hernia contains:
- `18_questions_batch17.sql` #36 — Definition of Terms in Surgery
  - the same stem appears under 2 different topics
  - stem: Choledocholithiasis refers to:
- `19_questions_batch18.sql` #7 — Shock
  - the same stem appears under 3 different topics
  - stem: Treatment of neurogenic shock includes:
- `19_questions_batch18.sql` #9 — Shock
  - the same stem appears under 2 different topics
  - stem: Treatment of adrenal crisis includes:
- `19_questions_batch18.sql` #11 — Shock
  - the same stem appears under 2 different topics
  - stem: Beck triad in cardiac tamponade consists of:
- `19_questions_batch18.sql` #36 — Shock
  - the same stem appears under 3 different topics
  - stem: The lethal triad in trauma refers to:
- `20_questions_batch19.sql` #13 — Fluid and Electrolytes in Surgery
  - the same stem appears under 2 different topics
  - stem: SIADH (Syndrome of Inappropriate ADH) is characterized by:
- `20_questions_batch19.sql` #21 — Fluid and Electrolytes in Surgery
  - the same stem appears under 2 different topics
  - stem: Causes of hypokalemia include all EXCEPT:
- `22_questions_batch21.sql` #0 — Principles of Fracture Management
  - the same stem appears under 2 different topics
  - stem: The stages of fracture healing in order are:
- `22_questions_batch21.sql` #6 — Principles of Fracture Management
  - the same stem appears under 3 different topics
  - stem: Salter-Harris Type II fracture involves:
- `22_questions_batch21.sql` #7 — Principles of Fracture Management
  - the same stem appears under 2 different topics
  - stem: A Colles fracture is:
- `22_questions_batch21.sql` #21 — Principles of Fracture Management
  - the same stem appears under 2 different topics
  - stem: Delayed union is defined as:
- `22_questions_batch21.sql` #25 — Principles of Fracture Management
  - the same stem appears under 2 different topics
  - stem: Malunion refers to:
- `22_questions_batch21.sql` #30 — Principles of Fracture Management
  - the same stem appears under 2 different topics
  - stem: External fixation is indicated for:
- `23_questions_batch22.sql` #2 — Surgical Wounds and Antibiotic Prophylaxis
  - the same stem appears under 2 different topics
  - stem: Granulation tissue consists of:
- `23_questions_batch22.sql` #5 — Surgical Wounds and Antibiotic Prophylaxis
  - the same stem appears under 2 different topics
  - stem: Wound contraction is mediated by:
- `23_questions_batch22.sql` #33 — Surgical Wounds and Antibiotic Prophylaxis
  - the same stem appears under 5 different topics
  - stem: Fournier gangrene is:
- `302_s3_mcq_batch2_burns.sql` #16 — Malignancies of the Lung and Pleura
  - the same stem appears under 2 different topics
  - stem: The target urine output for burn resuscitation in adults is:
- `302_s3_mcq_batch2_burns.sql` #25 — Malignancies of the Lung and Pleura
  - the same stem appears under 5 different topics
  - stem: Escharotomy is indicated for:
- `302_s3_mcq_batch2_burns.sql` #56 — Malignancies of the Lung and Pleura
  - the same stem appears under 2 different topics
  - stem: The most common organism causing burn wound infection is:
- `304_s3_mcq_batch4_urolithiasis.sql` #0 — Childhood Malignancies: Neuroblastoma
  - the same stem appears under 3 different topics
  - stem: The most common type of kidney stone is:
- `305_s3_mcq_batch5_fractures_children.sql` #4 — Testicular Tumors
  - the same stem appears under 3 different topics
  - stem: Salter-Harris Type II fracture involves:
- `306_s3_mcq_batch6_bph.sql` #0 — Childhood Malignancies: Lymphomas
  - the same stem appears under 2 different topics
  - stem: The prostate gland is located:
- …and 582 more (see question-bank.json)

### warn: explanation-ignores-key (99)

- `04_questions_batch3.sql` #26 — Shock
  - the explanation never mentions anything from the correct option
  - stem: The Surviving Sepsis Campaign recommends completing the 1-hour bundle which includes all EXCEPT:
- `05_questions_batch4.sql` #35 — Fluid and Electrolytes in Surgery
  - the explanation never mentions anything from the correct option
  - stem: The 4-2-1 rule for maintenance IV fluids calculates:
- `06_questions_batch5.sql` #36 — Sutures and Surgical Needles
  - the explanation never mentions anything from the correct option
  - stem: Small bite technique for fascial closure refers to:
- `08_questions_batch7.sql` #24 — Blood and Blood Products in Surgery
  - the explanation never mentions anything from the correct option
  - stem: Patients with IgA deficiency are at risk for:
- `13_questions_batch12.sql` #19 — Nasogastric Intubation
  - the explanation never mentions anything from the correct option
  - stem: Complications of NGT insertion include all EXCEPT:
- `13_questions_batch12.sql` #26 — Nasogastric Intubation
  - the explanation never mentions anything from the correct option
  - stem: Large-volume NGT output losses should be replaced with:
- `14_questions_batch13.sql` #25 — Cardiopulmonary Resuscitation (CPR)
  - the explanation never mentions anything from the correct option
  - stem: Amiodarone is indicated for:
- `15_questions_batch14.sql` #16 — Leg Ulcers
  - the explanation never mentions anything from the correct option
  - stem: An ABPI of less than 0.9 indicates:
- `17_questions_batch16.sql` #25 — Urethral Catheterization
  - the explanation never mentions anything from the correct option
  - stem: Complications of urethral catheterization include all EXCEPT:
- `18_questions_batch17.sql` #27 — Definition of Terms in Surgery
  - the explanation never mentions anything from the correct option
  - stem: Tenesmus refers to:
- `19_questions_batch18.sql` #2 — Shock
  - the explanation never mentions anything from the correct option
  - stem: Mixed venous oxygen saturation (SvO2) in shock is typically:
- `24_questions_batch23.sql` #12 — Abdominal Wound Incisions
  - the explanation never mentions anything from the correct option
  - stem: Upper midline incision is particularly useful for:
- `302_s3_mcq_batch2_burns.sql` #52 — Malignancies of the Lung and Pleura
  - the explanation never mentions anything from the correct option
  - stem: Caloric requirements in burn patients can be estimated using the Curreri formula:
- `303_s3_mcq_batch3_cleft.sql` #21 — Tuberculosis of the Spine and Other Bones and Joints
  - the explanation never mentions anything from the correct option
  - stem: Velocardiofacial syndrome (22q11.2 deletion) includes all EXCEPT:
- `305_s3_mcq_batch5_fractures_children.sql` #34 — Testicular Tumors
  - the explanation never mentions anything from the correct option
  - stem: The typical presentation of nursemaid's elbow is:
- `310_s3_mcq_batch10_abdominal_injuries.sql` #28 — Spinal Injuries and Principles of Trauma Care
  - the explanation never mentions anything from the correct option
  - stem: Perihepatic packing in liver trauma:
- `313_s3_mcq_batch13_peritonitis.sql` #13 — Hand Injuries and Infections
  - the explanation never mentions anything from the correct option
  - stem: Bile peritonitis:
- `313_s3_mcq_batch13_peritonitis.sql` #34 — Hand Injuries and Infections
  - the explanation never mentions anything from the correct option
  - stem: Enterococcal coverage in community-acquired peritonitis:
- `318_s3_mcq_batch18_colorectal_cancer.sql` #8 — Arterial Injuries, Peripheral Aneurysms, and Acute Limb Ischaemia
  - the explanation never mentions anything from the correct option
  - stem: Inflammatory bowel disease increases colorectal cancer risk, particularly:
- `325_s3_mcq_batch25_trauma.sql` #0 — Trauma Management, Emergency Procedures, and Critical Care
  - the explanation never mentions anything from the correct option
  - stem: The primary survey in trauma follows which sequence:
- `329_s3_mcq_batch29_pancreatic.sql` #5 — Pancreatic Cancer, Pancreatic Cysts, Chronic Pancreatitis Surgery
  - the explanation never mentions anything from the correct option
  - stem: The most important determinant of resectability in pancreatic cancer is:
- `343_s3_mcq_batch43_vascular.sql` #11 — AAA, Peripheral Arterial Disease, Carotid Disease, Venous Disease
  - the explanation never mentions anything from the correct option
  - stem: Acute limb ischemia presents with the 6 Ps:
- `407_surgery2_qbank_topic08.sql` #17 — Surgical Salmonellosis
  - the explanation never mentions anything from the correct option
  - stem: Antibiotic resistance in Salmonella typhi is an increasing concern for:
- `409_surgery2_qbank_topic10.sql` #11 — Abdominal Tuberculosis
  - the explanation never mentions anything from the correct option
  - stem: The "pulled-up" cecum sign on barium studies suggests:
- `410_surgery2_qbank_topic11.sql` #14 — Trauma Management Principles
  - the explanation never mentions anything from the correct option
  - stem: Cerebral perfusion pressure (CPP) is calculated as:
- `412_surgery2_qbank_topic13.sql` #10 — Abdominal Trauma
  - the explanation never mentions anything from the correct option
  - stem: Non-operative management of splenic injury is indicated when:
- `412_surgery2_qbank_topic13.sql` #15 — Abdominal Trauma
  - the explanation never mentions anything from the correct option
  - stem: Perihepatic packing in damage control surgery is indicated for:
- `417_surgery2_qbank_topic18.sql` #0 — Compartment Syndrome
  - the explanation never mentions anything from the correct option
  - stem: The three overlapping phases of wound healing are:
- `420_surgery2_qbank_topic21.sql` #16 — Inotropes and Vasopressors
  - the explanation never mentions anything from the correct option
  - stem: Reperfusion injury after revascularization is characterized by:
- `422_surgery2_qbank_topic23.sql` #26 — Varicose Veins
  - the explanation never mentions anything from the correct option
  - stem: Repair of ascending aortic aneurysm is recommended at diameter:
- `423_surgery2_qbank_topic24.sql` #20 — Surgical Nutrition
  - the explanation never mentions anything from the correct option
  - stem: Trendelenburg test evaluates:
- `426_surgery2_qbank_topic27.sql` #3 — Metabolic Bone Diseases
  - the explanation never mentions anything from the correct option
  - stem: Malnutrition increases surgical risk through all EXCEPT:
- `426_surgery2_qbank_topic27.sql` #17 — Metabolic Bone Diseases
  - the explanation never mentions anything from the correct option
  - stem: Complications of TPN include all EXCEPT:
- `426_surgery2_qbank_topic27.sql` #19 — Metabolic Bone Diseases
  - the explanation never mentions anything from the correct option
  - stem: Glutamine supplementation may benefit:
- `427_surgery2_qbank_topic28.sql` #7 — Surgical Arthritis
  - the explanation never mentions anything from the correct option
  - stem: Clinical signs of hypovolemia include all EXCEPT:
- `427_surgery2_qbank_topic28.sql` #19 — Surgical Arthritis
  - the explanation never mentions anything from the correct option
  - stem: Emergency treatment of severe hyperkalemia includes all EXCEPT:
- `428_surgery2_qbank_topic29.sql` #20 — Bone Tumours
  - the explanation never mentions anything from the correct option
  - stem: A lag screw achieves fixation by:
- `430_surgery2_qbank_topic31.sql` #11 — Hydrocephalus
  - the explanation never mentions anything from the correct option
  - stem: Z-plasty is used to:
- `430_surgery2_qbank_topic31.sql` #13 — Hydrocephalus
  - the explanation never mentions anything from the correct option
  - stem: Free flaps require:
- `431_surgery2_qbank_topic32.sql` #22 — Intracranial Suppurations
  - the explanation never mentions anything from the correct option
  - stem: Anaplastic thyroid carcinoma is characterized by:
- …and 59 more (see question-bank.json)

### warn: unmarked-negative (42)

- `26_questions_batch25.sql` #26 — Cardiopulmonary Resuscitation (CPR)
  - negative stem: "not" is not capitalised
  - stem: A 35-year-old woman is found unresponsive after suspected opioid overdose. She has a pulse of 50/min but is not breathing. What is the appropriate man…
- `26_questions_batch25.sql` #27 — Cardiopulmonary Resuscitation (CPR)
  - negative stem: "not" is not capitalised
  - stem: A swimmer is pulled from cold water (water temperature 10 degrees C). He has been submerged for approximately 15 minutes. He is pulseless and not brea…
- `26_questions_batch25.sql` #28 — Cardiopulmonary Resuscitation (CPR)
  - negative stem: "Not" is not capitalised
  - stem: A 70-year-old man with terminal metastatic cancer has a witnessed VF arrest in hospital. His notes document a DNACPR (Do Not Attempt CPR) order signed…
- `26_questions_batch25.sql` #30 — Cardiopulmonary Resuscitation (CPR)
  - negative stem: "not" is not capitalised
  - stem: During resuscitation of a patient in asystole, a junior doctor asks why you are not giving atropine as he was taught this previously. What is the corr…
- `27_questions_batch26.sql` #17 — Shock
  - negative stem: "not" is not capitalised
  - stem: A patient with confirmed massive PE and shock (BP 75/50, HR 135) is not improving with supportive care. Thrombolysis is being considered. What are con…
- `27_questions_batch26.sql` #23 — Shock
  - negative stem: "not" is not capitalised
  - stem: A 40-year-old woman with ruptured ectopic pregnancy and hemorrhagic shock requires emergency surgery. Her blood type is not yet available. What blood …
- `27_questions_batch26.sql` #25 — Shock
  - negative stem: "not" is not capitalised
  - stem: A 28-year-old woman is brought in after a bee sting. She has widespread urticaria but BP is 110/70 and she is not wheezing. An hour later, her BP drop…
- `29_questions_batch28.sql` #10 — Fluid and Electrolytes in Surgery
  - negative stem: "not" is not capitalised
  - stem: A patient with chronic hypokalemia (K 2.8 mEq/L) also has metabolic alkalosis and hypertension. He is not on diuretics. Blood pressure is 170/100. Wha…
- `29_questions_batch28.sql` #20 — Fluid and Electrolytes in Surgery
  - negative stem: "not" is not capitalised
  - stem: A patient with resistant hypertension and hypokalemia has metabolic alkalosis. Urine chloride is 45 mEq/L and does not respond to saline. What is the …
- `30_questions_batch29.sql` #9 — Leg Ulcers
  - negative stem: "not" is not capitalised
  - stem: A 75-year-old with multiple comorbidities has unreconstructable arterial disease with an ischemic ulcer and dry gangrene of the little toe. He is not …
- `30_questions_batch29.sql` #28 — Leg Ulcers
  - negative stem: "not" is not capitalised
  - stem: A 55-year-old woman has a chronic venous ulcer not healing despite 6 months of optimal treatment. Biopsy has excluded malignancy. What advanced therap…
- `31_questions_batch30.sql` #5 — Principles of Fracture Management
  - negative stem: "not" is not capitalised
  - stem: What happens if compartment syndrome is not treated within 6-8 hours?
- `32_questions_batch31.sql` #5 — Urethral Catheterization
  - negative stem: "not" is not capitalised
  - stem: While catheterizing a 70-year-old man with BPH, you meet resistance at the level of the prostate. The catheter will not advance. What should you do?
- `32_questions_batch31.sql` #8 — Urethral Catheterization
  - negative stem: "not" is not capitalised
  - stem: A patient with a urethral catheter in situ has a catheter that is not draining despite adequate intake. The drainage bag is below bladder level. What …
- `32_questions_batch31.sql` #14 — Urethral Catheterization
  - negative stem: "not" is not capitalised
  - stem: A nurse calls because a patient catheter balloon will not deflate when attempting to remove it. What techniques can be tried?
- `32_questions_batch31.sql` #18 — Urethral Catheterization
  - negative stem: "not" is not capitalised
  - stem: An elderly man with dementia and chronic retention is not a candidate for CISC. He has failed multiple urethral catheter trials. What alternative is m…
- `32_questions_batch31.sql` #20 — Urethral Catheterization
  - negative stem: "not" is not capitalised
  - stem: A post-operative patient had a catheter for 2 days. It is removed and she does not void for 6 hours but has no discomfort. Bladder scan shows 180ml. W…
- `32_questions_batch31.sql` #24 — Urethral Catheterization
  - negative stem: "not" is not capitalised
  - stem: A patient with known urethral stricture has chronic retention. A standard Foley will not pass. What specialized catheter might help?
- `33_questions_batch32.sql` #16 — Nasogastric Intubation
  - negative stem: "not" is not capitalised
  - stem: A patient given succinylcholine for rapid sequence induction does not relax after 15 minutes (TOF shows 0 twitches). What condition should be suspecte…
- `36_questions_batch35.sql` #20 — Surgical Wounds and Antibiotic Prophylaxis
  - negative stem: "not" is not capitalised
  - stem: A patient with head injury has GCS 8 (E2, V2, M4). He does not open eyes to voice but opens them to pain, makes incomprehensible sounds, and withdraws…
- `37_questions_batch36.sql` #22 — Intraoperative Monitoring
  - negative stem: "not" is not capitalised
  - stem: Electronic monitoring shows a patient has been in AF with HR 140 for the past hour but no alert was generated because observations were not being ente…
- `38_questions_batch37.sql` #0 — Sutures and Surgical Needles
  - negative stem: "not" is not capitalised
  - stem: A patient undergoes elective hernia repair through healthy skin with no break in sterile technique. Antibiotic prophylaxis was not given. What is the …
- `38_questions_batch37.sql` #11 — Sutures and Surgical Needles
  - negative stem: "not" is not capitalised
  - stem: A diabetic patient has a chronic foot wound that has not healed for 3 months despite dressings. The wound bed has thick yellow slough and minimal gran…
- `38_questions_batch37.sql` #23 — Sutures and Surgical Needles
  - negative stem: "not" is not capitalised
  - stem: A malnourished patient with albumin of 18 g/L is not healing after surgery. What nutritional intervention is most important?
- `39_questions_batch38.sql` #11 — Blood Conservation Techniques
  - negative stem: "not" is not capitalised
  - stem: Following a right iliac fossa incision for appendectomy, a patient has weakness of the right lower abdominal wall with a bulge that is not a hernia (n…
- `42_questions_batch41.sql` #12 — Principles of Fracture Management
  - negative stem: "not" is not capitalised
  - stem: A patient with a closed tibial fracture develops increasing pain not relieved by splitting the cast, pain on passive stretch of toes, and paresthesias…
- `44_questions_batch43.sql` #3 — Abdominal Wound Incisions
  - negative stem: "not" is not capitalised
  - stem: A post-stroke patient with dysphagia has had NG tube feeding for 6 weeks. Speech and language therapy assessment suggests swallow may not recover. Wha…
- `46_questions_batch45.sql` #6 — Sutures and Surgical Needles
  - negative stem: "not" is not capitalised
  - stem: A patient develops wound dehiscence with evisceration on post-operative day 6 after laparotomy. On exploration in theatre, the fascial edges are necro…
- `47_questions_batch46.sql` #13 — Principles of Fracture Management
  - negative stem: "not" is not capitalised
  - stem: A patient with ankle fracture has had cast application. 24 hours later, they report severe pain not relieved by elevation and analgesia, with paresthe…
- `48_questions_batch47.sql` #10 — Sutures and Surgical Needles
  - negative stem: "not" is not capitalised
  - stem: A diabetic patient has a clean but chronic foot wound that has stalled in healing. Granulation tissue is present but epithelialization is not progress…
- `49_questions_batch48.sql` #3 — Shock
  - negative stem: "not" is not capitalised
  - stem: A patient in the ICU has refractory septic shock requiring norepinephrine 0.5 mcg/kg/min. Adding vasopressin has not improved BP. What additional vaso…
- `50_questions_batch49.sql` #13 — Blood Conservation Techniques
  - negative stem: "not" is not capitalised
  - stem: A patient with a large incisional hernia has "loss of domain" - the herniated viscera will not reduce into the abdomen. What preoperative preparation …
- `50_questions_batch49.sql` #17 — Urethral Catheterization
  - negative stem: "not" is not capitalised
  - stem: A male patient with known urethral stricture requires catheterization for urinary retention. Standard catheter will not pass. What are the options?
- `50_questions_batch49.sql` #19 — Abdominal Wound Incisions
  - negative stem: "not" is not capitalised
  - stem: A patient with small bowel obstruction has been managed conservatively with NG decompression for 72 hours. Obstruction has not resolved. What clinical…
- `52_questions_batch51.sql` #1 — Sutures and Surgical Needles
  - negative stem: "not" is not capitalised
  - stem: A patient develops superficial surgical site infection 5 days after hernia repair. The wound has erythema, purulent discharge, and fever 38°C. The mes…
- `55_questions_batch54.sql` #0 — Shock
  - negative stem: "not" is not capitalised
  - stem: A patient in septic shock is given fluid boluses but blood pressure does not improve. What explains the vasoplegia (refractory vasodilation)?
- `55_questions_batch54.sql` #2 — Sutures and Surgical Needles
  - negative stem: "not" is not capitalised
  - stem: An elderly patient's surgical wound has not healed at 3 weeks despite no infection. Labs show albumin 2.0 g/dL. What is the relationship?
- `55_questions_batch54.sql` #3 — Sutures and Surgical Needles
  - negative stem: "not" is not capitalised
  - stem: A patient with peripheral arterial disease has a foot wound that is not healing. Transcutaneous oxygen (TcPO2) is 25 mmHg. What does this indicate?
- `56_questions_batch55.sql` #6 — Sutures and Surgical Needles
  - negative stem: "not" is not capitalised
  - stem: A patient has a chronic wound that has not changed in size for 6 months. Biopsy is performed. What is the primary concern prompting biopsy?
- `57_questions_batch56.sql` #0 — Definition of Terms in Surgery
  - negative stem: "not" is not capitalised
  - stem: A patient arrives in ED with eviscerated bowel after a stab wound. The bowel is pink and not contaminated with stool. What is the correct emergency ro…
- …and 2 more (see question-bank.json)

### warn: low-vocabulary-overlap (26)

- `04_questions_batch3.sql` #13 — Shock
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A "transient responder" in hemorrhagic shock is a patient who:
- `13_questions_batch12.sql` #10 — Nasogastric Intubation
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: Before inserting NGT, the patient should be positioned:
- `26_questions_batch25.sql` #2 — Cardiopulmonary Resuscitation (CPR)
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A 3-year-old child is pulled from a swimming pool. He is unresponsive with no breathing. You are a single healthcare provider. What should you do FIRS…
- `26_questions_batch25.sql` #3 — Cardiopulmonary Resuscitation (CPR)
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: During ward rounds, a 70-year-old post-MI patient suddenly becomes unresponsive. The monitor shows a flat line. Before starting CPR, what must you ver…
- `27_questions_batch26.sql` #3 — Shock
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A 70-year-old man on warfarin presents with melena for 2 days. He is pale, diaphoretic, BP 75/45 mmHg, HR 125/min. His INR is 5.2. What is the priorit…
- `27_questions_batch26.sql` #5 — Shock
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A 65-year-old man presents with crushing chest pain for 2 hours. ECG shows ST elevation in leads V1-V4. BP is 80/55 mmHg, HR 110/min, with bilateral l…
- `27_questions_batch26.sql` #10 — Shock
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A 68-year-old man with urosepsis has received 3L of crystalloid. His BP remains 80/50 mmHg, HR 115/min, lactate 4.5 mmol/L. CVP is 14 mmHg. Antibiotic…
- `27_questions_batch26.sql` #25 — Shock
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A 28-year-old woman is brought in after a bee sting. She has widespread urticaria but BP is 110/70 and she is not wheezing. An hour later, her BP drop…
- `27_questions_batch26.sql` #27 — Shock
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A 2-year-old child presents with 3 days of diarrhea. He is lethargic, has sunken eyes, dry mucous membranes, and reduced skin turgor. His HR is 160/mi…
- `28_questions_batch27.sql` #18 — Blood and Blood Products in Surgery
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A patient receiving chemotherapy has a positive CMV IgG. He requires platelet transfusion. What type of platelet product should be used?
- `29_questions_batch28.sql` #5 — Fluid and Electrolytes in Surgery
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: An 80-year-old nursing home resident is brought in with altered consciousness. Sodium is 162 mEq/L, BUN/creatinine elevated. She is lethargic with dry…
- `30_questions_batch29.sql` #8 — Leg Ulcers
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A patient has undergone successful angioplasty for an arterial ulcer. Despite improved blood flow, what additional measures are essential for healing …
- `32_questions_batch31.sql` #11 — Urethral Catheterization
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A routine urine sample from a catheterized patient shows bacteria greater than 10^5 CFU/ml but the patient is afebrile with no urinary symptoms. How s…
- `35_questions_batch34.sql` #1 — Mensuration and Gauges in Medical Practice
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A child falls and sustains a 4cm laceration on his forehead. After cleaning, what suture would give the best cosmetic result?
- `35_questions_batch34.sql` #3 — Mensuration and Gauges in Medical Practice
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A patient undergoes bowel anastomosis for colon cancer. The surgeon uses a single-layer technique. What suture properties are most important?
- `35_questions_batch34.sql` #7 — Mensuration and Gauges in Medical Practice
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A patient has a skin laceration repaired with 4-0 nylon interrupted sutures on the forearm. When should sutures be removed?
- `38_questions_batch37.sql` #1 — Sutures and Surgical Needles
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A patient has elective cholecystectomy for biliary colic. There is no spillage of bile. What is the wound classification?
- `39_questions_batch38.sql` #12 — Blood Conservation Techniques
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: During laparoscopic surgery, the patient develops surgical emphysema of the abdominal wall. What has occurred?
- `42_questions_batch41.sql` #1 — Shock
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A patient in hemorrhagic shock has received 6 units PRBCs, 6 units FFP, 1 pool platelets. Temperature is 34.5°C and bleeding continues despite surgica…
- `58_questions_batch57.sql` #11 — Surgical Wounds and Antibiotic Prophylaxis
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: When examining a patient with abdominal pain, what finding most specifically suggests peritonitis?
- `61_questions_batch60.sql` #5 — Fluid and Electrolytes in Surgery
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A patient is admitted with diabetic ketoacidosis requiring surgery. What specific fluid and electrolyte management is needed?
- `62_questions_batch61.sql` #4 — Blood and Blood Products in Surgery
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A patient receiving their third unit of blood develops fever, chills, and flank pain. Previous units were uneventful. What is the most likely diagnosi…
- `66_questions_batch65.sql` #0 — Definition of Terms in Surgery
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A 45-year-old woman has recurrent episodes of RUQ pain after fatty meals, with normal ultrasound. What is the likely diagnosis and next step?
- `305_s3_mcq_batch5_fractures_children.sql` #23 — Testicular Tumors
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: To test anterior interosseous nerve function, the patient should be asked to:
- `305_s3_mcq_batch5_fractures_children.sql` #42 — Testicular Tumors
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A pathological fracture in a child should raise suspicion for:
- `427_surgery2_qbank_topic28.sql` #30 — Surgical Arthritis
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A patient with prolonged vomiting typically develops:

### warn: catchall-misplaced (3)

- `302_s3_mcq_batch2_burns.sql` #19 — Malignancies of the Lung and Pleura
  - "All of the above" is option_d, not the last option
  - stem: Over-resuscitation in burns (fluid creep) can lead to:
- `409_surgery2_qbank_topic10.sql` #1 — Abdominal Tuberculosis
  - "All of the above are possible" is option_d, not the last option
  - stem: The route of infection in intestinal tuberculosis is usually:
- `411_surgery2_qbank_topic12.sql` #12 — ATLS Principles
  - "All of the above" is option_d, not the last option
  - stem: The main cause of respiratory failure in flail chest is:

### warn: all-and-none (1)

- `302_s3_mcq_batch2_burns.sql` #19 — Malignancies of the Lung and Pleura
  - "all of the above" and "none of the above" both offered
  - stem: Over-resuscitation in burns (fluid creep) can lead to:

## CME self-assessments (`article_self_assessments`)

- parsed: **2940**
- clean: **1961**
- with errors: **5**
- with warnings only: **974**

| severity | check | count |
| --- | --- | ---: |
| warn | key-length-cue | 873 |
| warn | duplicate-stem-across-topics | 145 |
| warn | explanation-ignores-key | 23 |
| warn | catchall-misplaced | 10 |
| warn | low-vocabulary-overlap | 6 |
| warn | all-and-none | 5 |
| warn | thin-explanation | 5 |
| error | stub-stem | 2 |
| error | duplicate-question | 2 |
| error | duplicate-option | 1 |
| warn | unmarked-negative | 1 |

Answer key balance: {"C":654,"B":2057,"E":14,"D":130,"A":85}

### error: stub-stem (2)

- `209_sutures_instruments_content.sql` #0 — a1100006-0000-0000-0000-000000000006
  - stem is only 10 characters: "Vicryl is:"
  - stem: Vicryl is:
- `345_surgery2_article45.sql` #3 — d2000045-0000-0000-0000-000000000045
  - stem is only 7 characters: "PSA is:"
  - stem: PSA is:

### error: duplicate-question (2)

- `406_s3_cme_article8_trauma.sql` #7 — d0000308-0000-0000-0000-000000000008
  - identical question (stem and all options) appears 2 times: 406_s3_cme_article8_trauma.sql, 458_s3_cme_article60_trauma.sql
  - stem: The most commonly injured solid organ in blunt abdominal trauma is:
- `458_s3_cme_article60_trauma.sql` #5 — d0000360-0000-0000-0000-000000000060
  - identical question (stem and all options) appears 2 times: 406_s3_cme_article8_trauma.sql, 458_s3_cme_article60_trauma.sql
  - stem: The most commonly injured solid organ in blunt abdominal trauma is:

### error: duplicate-option (1)

- `202_s4_cme_dvt.sql` #2 — d0040002-0000-0000-0000-000000000002
  - option_a and option_e are the same: "2 weeks"
  - stem: Duration of anticoagulation for unprovoked DVT:

### warn: key-length-cue (873)

- `105_cme_article5_wound_management.sql` #0 — a1100005-0000-0000-0000-000000000005
  - the key is 2x longer than the average distractor
  - stem: A wound bed that is 60% yellow and 40% red indicates:
- `105_cme_article5_wound_management.sql` #6 — a1100005-0000-0000-0000-000000000005
  - the key is 3x longer than the average distractor
  - stem: What is the primary mechanism by which NPWT promotes wound healing?
- `108_cme_article8_abdominal_incisions.sql` #0 — a1100008-0000-0000-0000-000000000008
  - the key is 4x longer than the average distractor
  - stem: The linea alba is formed by:
- `108_cme_article8_abdominal_incisions.sql` #4 — a1100008-0000-0000-0000-000000000008
  - the key is 2x longer than the average distractor
  - stem: The Pfannenstiel incision involves:
- `108_cme_article8_abdominal_incisions.sql` #16 — a1100008-0000-0000-0000-000000000008
  - the key is 3x longer than the average distractor
  - stem: Which suture material is currently recommended for midline laparotomy closure?
- `111_cme_article11_nasogastric_intubation.sql` #13 — a1100011-0000-0000-0000-000000000011
  - the key is 3x longer than the average distractor
  - stem: When should NGT position be rechecked?
- `116_cme_article16_urethral_catheterization.sql` #9 — a1100016-0000-0000-0000-000000000016
  - the key is 3x longer than the average distractor
  - stem: If the catheter accidentally enters the vagina during female catheterization, the correct action is:
- `304_surgery2_article2_appendicitis.sql` #18 — d2000002-0000-0000-0000-000000000002
  - the key is 3x longer than the average distractor
  - stem: Which feature helps distinguish acute appendicitis from acute gastroenteritis?
- `342_surgery2_article42.sql` #7 — d2000042-0000-0000-0000-000000000042
  - the key is 3x longer than the average distractor
  - stem: Critical View of Safety in cholecystectomy requires:
- `346_surgery2_article46.sql` #5 — d2000046-0000-0000-0000-000000000046
  - the key is 4x longer than the average distractor
  - stem: TURP syndrome is caused by:
- `347_surgery2_article47.sql` #17 — d2000047-0000-0000-0000-000000000047
  - the key is 6x longer than the average distractor
  - stem: Post-micturition symptoms include:
- `348_surgery2_article48.sql` #11 — d2000048-0000-0000-0000-000000000048
  - the key is 4x longer than the average distractor
  - stem: Urine extravasation in anterior urethral injury with disrupted Buck fascia follows:
- `351_surgery2_article51.sql` #1 — d2000051-0000-0000-0000-000000000051
  - the key is 3x longer than the average distractor
  - stem: Varicocele is more common on the left side because:
- `359_surgery2_article59.sql` #11 — d2000059-0000-0000-0000-000000000059
  - the key is 4x longer than the average distractor
  - stem: Bioprosthetic valve is preferred in:
- `362_surgery2_fix_mcqs_batch1.sql` #37 — d2000010-0000-0000-0000-000000000010
  - the key is 5x longer than the average distractor
  - stem: Cocoon abdomen is seen in:
- `363_surgery2_fix_mcqs_batch2.sql` #3 — d2000011-0000-0000-0000-000000000011
  - the key is 3x longer than the average distractor
  - stem: Damage control surgery involves:
- `363_surgery2_fix_mcqs_batch2.sql` #23 — d2000012-0000-0000-0000-000000000012
  - the key is 4x longer than the average distractor
  - stem: Exposure in ATLS means:
- `364_surgery2_fix_mcqs_batch3.sql` #26 — d2000017-0000-0000-0000-000000000017
  - the key is 7x longer than the average distractor
  - stem: Tile classification of pelvic fractures is based on:
- `364_surgery2_fix_mcqs_batch3.sql` #31 — d2000018-0000-0000-0000-000000000018
  - the key is 4x longer than the average distractor
  - stem: Classic symptom of compartment syndrome is:
- `400_s3_cme_article2_appendicitis.sql` #9 — d0000302-0000-0000-0000-000000000002
  - the key is 5x longer than the average distractor
  - stem: What is the recommended management for a patient with appendiceal abscess?
- `401_s3_cme_article3_cholecystitis.sql` #1 — d0000303-0000-0000-0000-000000000003
  - the key is 3x longer than the average distractor
  - stem: According to the Tokyo Guidelines, what is the imaging finding most suggestive of acute cholecystitis?
- `401_s3_cme_article3_cholecystitis.sql` #7 — d0000303-0000-0000-0000-000000000003
  - the key is 3x longer than the average distractor
  - stem: A patient undergoes laparoscopic cholecystectomy and develops a bile leak on postoperative day 2 with RUQ pain and bile in the drain. What is the most…
- `401_s3_cme_article3_cholecystitis.sql` #9 — d0000303-0000-0000-0000-000000000003
  - the key is 4x longer than the average distractor
  - stem: The critical view of safety during laparoscopic cholecystectomy requires visualization of:
- `402_s3_cme_article4_obstruction.sql` #2 — d0000304-0000-0000-0000-000000000004
  - the key is 3x longer than the average distractor
  - stem: On abdominal X-ray, small bowel obstruction typically shows:
- `402_s3_cme_article4_obstruction.sql` #5 — d0000304-0000-0000-0000-000000000004
  - the key is 4x longer than the average distractor
  - stem: Initial management of adhesive small bowel obstruction without signs of strangulation includes:
- `403_s3_cme_article5_hernias.sql` #1 — d0000305-0000-0000-0000-000000000005
  - the key is 2x longer than the average distractor
  - stem: An indirect inguinal hernia passes through the internal ring and travels:
- `405_s3_cme_article7_thyroid.sql` #9 — d0000307-0000-0000-0000-000000000007
  - the key is 3x longer than the average distractor
  - stem: Radioactive iodine (I-131) ablation after thyroidectomy is used for:
- `406_s3_cme_article8_trauma.sql` #3 — d0000308-0000-0000-0000-000000000008
  - the key is 4x longer than the average distractor
  - stem: The FAST examination in trauma evaluates for free fluid in which locations?
- `406_s3_cme_article8_trauma.sql` #5 — d0000308-0000-0000-0000-000000000008
  - the key is 3x longer than the average distractor
  - stem: Damage control surgery (DCS) involves:
- `407_s3_cme_article9_colorectal.sql` #3 — d0000309-0000-0000-0000-000000000009
  - the key is 2x longer than the average distractor
  - stem: Total mesorectal excision (TME) for rectal cancer:
- `407_s3_cme_article9_colorectal.sql` #5 — d0000309-0000-0000-0000-000000000009
  - the key is 3x longer than the average distractor
  - stem: Complicated diverticular disease with a sigmoid colon perforation and purulent peritonitis (Hinchey III) is best managed with:
- `408_s3_cme_article10_uppergi.sql` #5 — d0000310-0000-0000-0000-000000000010
  - the key is 12x longer than the average distractor
  - stem: The minimum proximal margin required for gastric cancer resection is:
- `408_s3_cme_article10_uppergi.sql` #7 — d0000310-0000-0000-0000-000000000010
  - the key is 3x longer than the average distractor
  - stem: A Mallory-Weiss tear is characterized by:
- `409_s3_cme_article11_vascular.sql` #3 — d0000311-0000-0000-0000-000000000011
  - the key is 3x longer than the average distractor
  - stem: The indication for elective repair of an abdominal aortic aneurysm (AAA) is:
- `410_s3_cme_article12_hepatobiliary.sql` #5 — d0000312-0000-0000-0000-000000000012
  - the key is 3x longer than the average distractor
  - stem: The Whipple procedure (pancreaticoduodenectomy) involves resection of:
- `410_s3_cme_article12_hepatobiliary.sql` #7 — d0000312-0000-0000-0000-000000000012
  - the key is 3x longer than the average distractor
  - stem: A pseudocyst of the pancreas is:
- `410_s3_cme_article12_hepatobiliary.sql` #9 — d0000312-0000-0000-0000-000000000012
  - the key is 2x longer than the average distractor
  - stem: Milan criteria for liver transplantation in HCC include:
- `411_s3_cme_article13_urology.sql` #1 — d0000313-0000-0000-0000-000000000013
  - the key is 6x longer than the average distractor
  - stem: A patient with a 6mm ureteric stone with severe pain but no obstruction or infection is best managed with:
- `411_s3_cme_article13_urology.sql` #8 — d0000313-0000-0000-0000-000000000013
  - the key is 3x longer than the average distractor
  - stem: The Gleason score for prostate cancer:
- `411_s3_cme_article13_urology.sql` #9 — d0000313-0000-0000-0000-000000000013
  - the key is 3x longer than the average distractor
  - stem: Fournier gangrene is:
- …and 833 more (see question-bank.json)

### warn: duplicate-stem-across-topics (145)

- `206_abdominal_incisions_content.sql` #3 — a1100008-0000-0000-0000-000000000008
  - the same stem appears under 4 different articles
  - stem: McBurney point is located:
- `207_s4_cme_tbi.sql` #3 — d0040007-0000-0000-0000-000000000007
  - the same stem appears under 2 different articles
  - stem: Cushing triad includes all EXCEPT:
- `208_s4_cme_breast.sql` #0 — d0040008-0000-0000-0000-000000000008
  - the same stem appears under 2 different articles
  - stem: Triple assessment includes all EXCEPT:
- `208_surgical_wounds_content.sql` #9 — a1100005-0000-0000-0000-000000000005
  - the same stem appears under 2 different articles
  - stem: Evisceration requires:
- `210_s4_cme_colorectal.sql` #0 — d0040010-0000-0000-0000-000000000010
  - the same stem appears under 2 different articles
  - stem: Minimum lymph nodes for adequate staging:
- `215_s4_cme_gastric.sql` #3 — d0040015-0000-0000-0000-000000000015
  - the same stem appears under 2 different articles
  - stem: Minimum lymph nodes for adequate staging:
- `218_s4_cme_chest_trauma.sql` #1 — d0040018-0000-0000-0000-000000000018
  - the same stem appears under 2 different articles
  - stem: Massive hemothorax is defined as:
- `225_s4_cme_spinal.sql` #1 — d0040025-0000-0000-0000-000000000025
  - the same stem appears under 2 different articles
  - stem: Sacral sparing indicates:
- `225_s4_cme_spinal.sql` #2 — d0040025-0000-0000-0000-000000000025
  - the same stem appears under 2 different articles
  - stem: Central cord syndrome affects:
- `229_s4_cme_brain_tumors.sql` #2 — d0040029-0000-0000-0000-000000000029
  - the same stem appears under 2 different articles
  - stem: Cushing triad includes all EXCEPT:
- `233_s4_cme_transplant.sql` #1 — d0040033-0000-0000-0000-000000000033
  - the same stem appears under 3 different articles
  - stem: Hyperacute rejection occurs:
- `243_s4_cme_biliary.sql` #1 — d0040043-0000-0000-0000-000000000043
  - the same stem appears under 5 different articles
  - stem: Murphy sign is positive in:
- `243_s4_cme_biliary.sql` #4 — d0040043-0000-0000-0000-000000000043
  - the same stem appears under 3 different articles
  - stem: Timing of cholecystectomy for acute cholecystitis:
- `250_s4_cme_appendicitis.sql` #0 — d0040050-0000-0000-0000-000000000050
  - the same stem appears under 4 different articles
  - stem: McBurney point is located:
- `251_s4_cme_diverticular.sql` #4 — d0040051-0000-0000-0000-000000000051
  - the same stem appears under 3 different articles
  - stem: Hartmann procedure involves:
- `258_s4_cme_wound_mgmt.sql` #3 — d0040058-0000-0000-0000-000000000058
  - the same stem appears under 2 different articles
  - stem: Evisceration requires:
- `304_surgery2_article2_appendicitis.sql` #0 — d2000002-0000-0000-0000-000000000002
  - the same stem appears under 2 different articles
  - stem: What is the most common position of the appendix?
- `305_surgery2_article3_intestinal_obstruction.sql` #0 — d2000003-0000-0000-0000-000000000003
  - the same stem appears under 2 different articles
  - stem: What is the most common cause of small bowel obstruction in developed countries?
- `307_surgery2_article5_surgical_jaundice.sql` #8 — d2000005-0000-0000-0000-000000000005
  - the same stem appears under 2 different articles
  - stem: Charcot triad consists of:
- `337_surgery2_article37.sql` #7 — d2000037-0000-0000-0000-000000000037
  - the same stem appears under 2 different articles
  - stem: Triple assessment includes all EXCEPT:
- `339_surgery2_article39.sql` #4 — d2000039-0000-0000-0000-000000000039
  - the same stem appears under 2 different articles
  - stem: Which hernia has the highest risk of strangulation?
- `340_surgery2_article40.sql` #14 — d2000040-0000-0000-0000-000000000040
  - the same stem appears under 3 different articles
  - stem: Hartmann procedure involves:
- `342_surgery2_article42.sql` #2 — d2000042-0000-0000-0000-000000000042
  - the same stem appears under 5 different articles
  - stem: Murphy sign is positive in:
- `342_surgery2_article42.sql` #4 — d2000042-0000-0000-0000-000000000042
  - the same stem appears under 2 different articles
  - stem: Charcot triad consists of:
- `342_surgery2_article42.sql` #11 — d2000042-0000-0000-0000-000000000042
  - the same stem appears under 2 different articles
  - stem: Mirizzi syndrome is:
- `343_surgery2_article43.sql` #4 — d2000043-0000-0000-0000-000000000043
  - the same stem appears under 2 different articles
  - stem: Barrett esophagus is:
- `346_surgery2_article46.sql` #10 — d2000046-0000-0000-0000-000000000046
  - the same stem appears under 2 different articles
  - stem: Storage symptoms include all EXCEPT:
- `347_surgery2_article47.sql` #1 — d2000047-0000-0000-0000-000000000047
  - the same stem appears under 2 different articles
  - stem: Storage symptoms include all EXCEPT:
- `353_surgery2_article53.sql` #11 — d2000053-0000-0000-0000-000000000053
  - the same stem appears under 3 different articles
  - stem: Fournier gangrene is:
- `360_surgery2_article60.sql` #10 — d2000060-0000-0000-0000-000000000060
  - the same stem appears under 2 different articles
  - stem: Post-transplant lymphoproliferative disorder (PTLD) is associated with:
- `363_surgery2_fix_mcqs_batch2.sql` #28 — d2000012-0000-0000-0000-000000000012
  - the same stem appears under 2 different articles
  - stem: Flail chest is defined as:
- `363_surgery2_fix_mcqs_batch2.sql` #46 — d2000014-0000-0000-0000-000000000014
  - the same stem appears under 2 different articles
  - stem: Massive hemothorax is defined as:
- `364_surgery2_fix_mcqs_batch3.sql` #5 — d2000016-0000-0000-0000-000000000016
  - the same stem appears under 2 different articles
  - stem: Central cord syndrome affects:
- `364_surgery2_fix_mcqs_batch3.sql` #14 — d2000016-0000-0000-0000-000000000016
  - the same stem appears under 2 different articles
  - stem: Sacral sparing indicates:
- `364_surgery2_fix_mcqs_batch3.sql` #50 — d2000019-0000-0000-0000-000000000019
  - the same stem appears under 3 different articles
  - stem: Escharotomy is indicated for:
- `364_surgery2_fix_mcqs_batch3.sql` #55 — d2000019-0000-0000-0000-000000000019
  - the same stem appears under 2 different articles
  - stem: Burn center referral criteria include:
- `400_s3_cme_article2_appendicitis.sql` #4 — d0000302-0000-0000-0000-000000000002
  - the same stem appears under 2 different articles
  - stem: What is the most common position of the appendix?
- `402_s3_cme_article4_obstruction.sql` #0 — d0000304-0000-0000-0000-000000000004
  - the same stem appears under 2 different articles
  - stem: What is the most common cause of small bowel obstruction in developed countries?
- `402_s3_cme_article4_obstruction.sql` #6 — d0000304-0000-0000-0000-000000000004
  - the same stem appears under 2 different articles
  - stem: The coffee-bean sign on abdominal X-ray is characteristic of:
- `403_s3_cme_article5_hernias.sql` #2 — d0000305-0000-0000-0000-000000000005
  - the same stem appears under 2 different articles
  - stem: Which hernia has the highest risk of strangulation?
- …and 105 more (see question-bank.json)

### warn: explanation-ignores-key (23)

- `116_cme_article16_urethral_catheterization.sql` #3 — a1100016-0000-0000-0000-000000000016
  - the explanation never mentions anything from the correct option
  - stem: A coudé-tip catheter is particularly useful for:
- `201_cme_s3_article1_hirschsprung.sql` #5 — d0000301-0000-0000-0000-000000000001
  - the explanation never mentions anything from the correct option
  - stem: What is the most common serious complication of Hirschsprung's disease?
- `202_leg_ulcers_content.sql` #16 — a1100014-0000-0000-0000-000000000014
  - the explanation never mentions anything from the correct option
  - stem: Claudication indicates:
- `225_s4_cme_spinal.sql` #3 — d0040025-0000-0000-0000-000000000025
  - the explanation never mentions anything from the correct option
  - stem: Brown-Sequard syndrome features:
- `227_s4_cme_lymphedema.sql` #3 — d0040027-0000-0000-0000-000000000027
  - the explanation never mentions anything from the correct option
  - stem: Cornerstone of lymphedema treatment:
- `228_s4_cme_amputation.sql` #0 — d0040028-0000-0000-0000-000000000028
  - the explanation never mentions anything from the correct option
  - stem: Most common indication for amputation:
- `236_s4_cme_headneck.sql` #0 — d0040036-0000-0000-0000-000000000036
  - the explanation never mentions anything from the correct option
  - stem: Most common type of head and neck cancer:
- `255_s4_cme_gi_bleeding.sql` #0 — d0040055-0000-0000-0000-000000000055
  - the explanation never mentions anything from the correct option
  - stem: Most common cause of UGIB:
- `311_surgery2_articles11to14.sql` #9 — d2000012-0000-0000-0000-000000000012
  - the explanation never mentions anything from the correct option
  - stem: What volume of blood in hemothorax may require thoracotomy?
- `313_surgery2_article20.sql` #4 — d2000020-0000-0000-0000-000000000020
  - the explanation never mentions anything from the correct option
  - stem: Petechiae on physical examination suggest a disorder of:
- `357_surgery2_article57.sql` #8 — d2000057-0000-0000-0000-000000000057
  - the explanation never mentions anything from the correct option
  - stem: Risk-reducing salpingo-oophorectomy is recommended at age:
- `360_surgery2_article60.sql` #17 — d2000060-0000-0000-0000-000000000060
  - the explanation never mentions anything from the correct option
  - stem: Panel Reactive Antibody (PRA) measures:
- `363_surgery2_fix_mcqs_batch2.sql` #74 — d2000015-0000-0000-0000-000000000015
  - the explanation never mentions anything from the correct option
  - stem: In cardiac tamponade, stroke volume is maintained by:
- `405_s3_cme_article7_thyroid.sql` #7 — d0000307-0000-0000-0000-000000000007
  - the explanation never mentions anything from the correct option
  - stem: Anaplastic thyroid carcinoma is characterized by:
- `409_s3_cme_article11_vascular.sql` #8 — d0000311-0000-0000-0000-000000000011
  - the explanation never mentions anything from the correct option
  - stem: The Wells score is used to assess clinical probability of:
- `411_s3_cme_article13_urology.sql` #5 — d0000313-0000-0000-0000-000000000013
  - the explanation never mentions anything from the correct option
  - stem: A man presents with lower urinary tract symptoms (LUTS) including hesitancy, weak stream, and nocturia. The most likely diagnosis is:
- `421_s3_cme_article23_neurosurgery.sql` #5 — d0000323-0000-0000-0000-000000000023
  - the explanation never mentions anything from the correct option
  - stem: The cerebral perfusion pressure (CPP) is calculated as:
- `424_s3_cme_article26_transplant.sql` #6 — d0000326-0000-0000-0000-000000000026
  - the explanation never mentions anything from the correct option
  - stem: Post-transplant lymphoproliferative disorder (PTLD) is most commonly associated with:
- `432_s3_cme_article34_spleen.sql` #0 — d0000334-0000-0000-0000-000000000034
  - the explanation never mentions anything from the correct option
  - stem: The most common indication for elective splenectomy is:
- `436_s3_cme_article38_critical_care.sql` #5 — d0000338-0000-0000-0000-000000000038
  - the explanation never mentions anything from the correct option
  - stem: Acute kidney injury (AKI) staging by KDIGO criteria uses:
- `442_s3_cme_article44_esophageal.sql` #8 — d0000344-0000-0000-0000-000000000044
  - the explanation never mentions anything from the correct option
  - stem: Anastomotic leak after esophagectomy:
- `515_s3_cme_article118_breast_cancer.sql` #9 — d0000418-0000-0000-0000-000000000118
  - the explanation never mentions anything from the correct option
  - stem: Lymphedema after axillary surgery can be reduced by:
- `517_s3_cme_article120_ethics.sql` #4 — d0000420-0000-0000-0000-000000000120
  - the explanation never mentions anything from the correct option
  - stem: When a surgical error occurs that causes patient harm, the ethical approach is to:

### warn: catchall-misplaced (10)

- `113_cme_article13_cpr.sql` #7 — a1100013-0000-0000-0000-000000000013
  - "All of the above" is option_d, not the last option
  - stem: An end-tidal CO2 (ETCO2) reading during CPR can indicate:
- `306_surgery2_article4_ecf.sql` #12 — d2000004-0000-0000-0000-000000000004
  - "All of the above" is option_d, not the last option
  - stem: What is the role of omentum in surgical repair of ECF?
- `363_surgery2_fix_mcqs_batch2.sql` #21 — d2000012-0000-0000-0000-000000000012
  - "All of the above" is option_d, not the last option
  - stem: Disability assessment in ATLS includes:
- `363_surgery2_fix_mcqs_batch2.sql` #25 — d2000012-0000-0000-0000-000000000012
  - "All of the above" is option_d, not the last option
  - stem: Indication for surgical airway includes:
- `363_surgery2_fix_mcqs_batch2.sql` #34 — d2000013-0000-0000-0000-000000000013
  - "All of the above" is option_d, not the last option
  - stem: Non-operative management of splenic injury requires:
- `363_surgery2_fix_mcqs_batch2.sql` #36 — d2000013-0000-0000-0000-000000000013
  - "All of the above" is option_d, not the last option
  - stem: Indication for mandatory laparotomy in penetrating trauma:
- `363_surgery2_fix_mcqs_batch2.sql` #52 — d2000014-0000-0000-0000-000000000014
  - "All of the above" is option_d, not the last option
  - stem: Tracheobronchial injury should be suspected with:
- `363_surgery2_fix_mcqs_batch2.sql` #73 — d2000015-0000-0000-0000-000000000015
  - "All of the above" is option_d, not the last option
  - stem: Constrictive pericarditis differs from tamponade in:
- `364_surgery2_fix_mcqs_batch3.sql` #51 — d2000019-0000-0000-0000-000000000019
  - "All of the above" is option_d, not the last option
  - stem: Inhalation injury should be suspected with:
- `364_surgery2_fix_mcqs_batch3.sql` #55 — d2000019-0000-0000-0000-000000000019
  - "All of the above" is option_d, not the last option
  - stem: Burn center referral criteria include:

### warn: low-vocabulary-overlap (6)

- `102_cme_article2_blood_conservation.sql` #7 — a1100002-0000-0000-0000-000000000002
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: Which of the following conditions would make a patient UNSUITABLE for acute normovolemic hemodilution?
- `104_cme_article4_fluids_electrolytes.sql` #8 — a1100004-0000-0000-0000-000000000004
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: What is the distribution of 1 liter of 0.9% Normal Saline in a patient with normal physiology?
- `355_surgery2_article55.sql` #14 — d2000055-0000-0000-0000-000000000055
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: Thyroid nodule in a child moves with:
- `400_s3_cme_article2_appendicitis.sql` #3 — d0000302-0000-0000-0000-000000000002
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A patient with appendicitis has pain in the right lower quadrant when the left lower quadrant is palpated. This finding is known as:
- `417_s3_cme_article19_fluids.sql` #3 — d0000319-0000-0000-0000-000000000019
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A patient with prolonged vomiting from pyloric stenosis will develop:
- `513_s3_cme_article116_nutrition.sql` #8 — d0000416-0000-0000-0000-000000000116
  - the scenario shares no wording with any option or the explanation -- worth an eye, usually fine
  - stem: A patient on total parenteral nutrition for 3 weeks should be monitored for:

### warn: all-and-none (5)

- `113_cme_article13_cpr.sql` #7 — a1100013-0000-0000-0000-000000000013
  - "all of the above" and "none of the above" both offered
  - stem: An end-tidal CO2 (ETCO2) reading during CPR can indicate:
- `306_surgery2_article4_ecf.sql` #12 — d2000004-0000-0000-0000-000000000004
  - "all of the above" and "none of the above" both offered
  - stem: What is the role of omentum in surgical repair of ECF?
- `363_surgery2_fix_mcqs_batch2.sql` #21 — d2000012-0000-0000-0000-000000000012
  - "all of the above" and "none of the above" both offered
  - stem: Disability assessment in ATLS includes:
- `363_surgery2_fix_mcqs_batch2.sql` #25 — d2000012-0000-0000-0000-000000000012
  - "all of the above" and "none of the above" both offered
  - stem: Indication for surgical airway includes:
- `364_surgery2_fix_mcqs_batch3.sql` #51 — d2000019-0000-0000-0000-000000000019
  - "all of the above" and "none of the above" both offered
  - stem: Inhalation injury should be suspected with:

### warn: thin-explanation (5)

- `201_s4_cme_pad.sql` #2 — d0040001-0000-0000-0000-000000000001
  - explanation is only 17 characters
  - stem: Strongest modifiable PAD risk factor:
- `207_s4_cme_tbi.sql` #2 — d0040007-0000-0000-0000-000000000007
  - explanation is only 19 characters
  - stem: Target cerebral perfusion pressure:
- `208_s4_cme_breast.sql` #2 — d0040008-0000-0000-0000-000000000008
  - explanation is only 11 characters
  - stem: T2 breast tumor size is:
- `221_s4_cme_melanoma.sql` #4 — d0040021-0000-0000-0000-000000000021
  - explanation is only 17 characters
  - stem: D in ABCDE represents:
- `222_s4_cme_renal.sql` #1 — d0040022-0000-0000-0000-000000000022
  - explanation is only 10 characters
  - stem: T1a renal tumor size:

### warn: unmarked-negative (1)

- `357_surgery2_article57.sql` #16 — d2000057-0000-0000-0000-000000000057
  - negative stem: "not" is not capitalised
  - stem: Which cancer risk is increased in BRCA2 but not as much in BRCA1?
