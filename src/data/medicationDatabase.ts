// Medication Database for Prescription Module
export interface Medication {
  name: string;
  genericName?: string;
  category: string;
  typicalDose?: string;
  routes?: string[];
  contraindications?: string[];
  sideEffects?: string[];
}

export const MEDICATION_DATABASE: Record<string, Medication[]> = {
  analgesics: [
    { name: 'Paracetamol', genericName: 'Acetaminophen', category: 'Analgesics', typicalDose: '1g PO/IV', routes: ['oral', 'IV'] },
    { name: 'Ibuprofen', genericName: 'Ibuprofen', category: 'Analgesics', typicalDose: '400mg PO', routes: ['oral'] },
    { name: 'Diclofenac', genericName: 'Diclofenac', category: 'Analgesics', typicalDose: '50mg PO', routes: ['oral', 'IM'] },
    { name: 'Tramadol', genericName: 'Tramadol HCl', category: 'Analgesics', typicalDose: '50-100mg PO', routes: ['oral', 'IV'] },
    { name: 'Morphine', genericName: 'Morphine Sulfate', category: 'Analgesics', typicalDose: '5-10mg IV', routes: ['IV', 'IM', 'SC'] },
    { name: 'Pethidine', genericName: 'Meperidine', category: 'Analgesics', typicalDose: '50-100mg IM', routes: ['IM', 'IV'] }
  ],
  antibiotics: [
    { name: 'Amoxicillin', genericName: 'Amoxicillin', category: 'Antibiotics', typicalDose: '500mg PO', routes: ['oral'] },
    { name: 'Augmentin', genericName: 'Amoxicillin-Clavulanate', category: 'Antibiotics', typicalDose: '625mg PO', routes: ['oral', 'IV'] },
    { name: 'Ceftriaxone', genericName: 'Ceftriaxone', category: 'Antibiotics', typicalDose: '1-2g IV', routes: ['IV', 'IM'] },
    { name: 'Cefuroxime', genericName: 'Cefuroxime', category: 'Antibiotics', typicalDose: '750mg IV', routes: ['IV', 'IM'] },
    { name: 'Ciprofloxacin', genericName: 'Ciprofloxacin', category: 'Antibiotics', typicalDose: '500mg PO', routes: ['oral', 'IV'] },
    { name: 'Metronidazole', genericName: 'Metronidazole', category: 'Antibiotics', typicalDose: '500mg IV', routes: ['oral', 'IV'] },
    { name: 'Gentamicin', genericName: 'Gentamicin', category: 'Antibiotics', typicalDose: '5mg/kg IV', routes: ['IV', 'IM'] },
    { name: 'Cloxacillin', genericName: 'Cloxacillin', category: 'Antibiotics', typicalDose: '500mg PO', routes: ['oral', 'IV'] }
  ],
  anticoagulants: [
    { name: 'Heparin', genericName: 'Unfractionated Heparin', category: 'Anticoagulants', typicalDose: '5000 units SC', routes: ['SC', 'IV'] },
    { name: 'Enoxaparin', genericName: 'Low Molecular Weight Heparin', category: 'Anticoagulants', typicalDose: '40mg SC', routes: ['SC'] },
    { name: 'Warfarin', genericName: 'Warfarin', category: 'Anticoagulants', typicalDose: '5mg PO', routes: ['oral'] }
  ],
  gastrointestinal: [
    { name: 'Omeprazole', genericName: 'Omeprazole', category: 'GI', typicalDose: '20mg PO', routes: ['oral', 'IV'] },
    { name: 'Ranitidine', genericName: 'Ranitidine', category: 'GI', typicalDose: '150mg PO', routes: ['oral', 'IV'] },
    { name: 'Metoclopramide', genericName: 'Metoclopramide', category: 'GI', typicalDose: '10mg IV', routes: ['oral', 'IV', 'IM'] },
    { name: 'Ondansetron', genericName: 'Ondansetron', category: 'GI', typicalDose: '4-8mg IV', routes: ['oral', 'IV'] }
  ],
  cardiovascular: [
    { name: 'Amlodipine', genericName: 'Amlodipine', category: 'Cardiovascular', typicalDose: '5mg PO', routes: ['oral'] },
    { name: 'Atenolol', genericName: 'Atenolol', category: 'Cardiovascular', typicalDose: '50mg PO', routes: ['oral'] },
    { name: 'Lisinopril', genericName: 'Lisinopril', category: 'Cardiovascular', typicalDose: '10mg PO', routes: ['oral'] },
    { name: 'Furosemide', genericName: 'Furosemide', category: 'Cardiovascular', typicalDose: '40mg PO/IV', routes: ['oral', 'IV'] }
  ],
  diabetes: [
    { name: 'Metformin', genericName: 'Metformin', category: 'Diabetes', typicalDose: '500mg PO', routes: ['oral'] },
    { name: 'Glibenclamide', genericName: 'Glibenclamide', category: 'Diabetes', typicalDose: '5mg PO', routes: ['oral'] },
    { name: 'Insulin (Soluble)', genericName: 'Regular Insulin', category: 'Diabetes', typicalDose: 'Variable units SC', routes: ['SC', 'IV'] },
    { name: 'Insulin (Isophane)', genericName: 'NPH Insulin', category: 'Diabetes', typicalDose: 'Variable units SC', routes: ['SC'] }
  ],
  woundCare: [
    { name: 'Silver Sulfadiazine', genericName: 'Silver Sulfadiazine', category: 'Wound Care', typicalDose: 'Apply topically', routes: ['topical'] },
    { name: 'Mupirocin', genericName: 'Mupirocin', category: 'Wound Care', typicalDose: 'Apply topically', routes: ['topical'] },
    { name: 'Povidone Iodine', genericName: 'Povidone Iodine', category: 'Wound Care', typicalDose: 'Apply topically', routes: ['topical'] }
  ],
  steroids: [
    { name: 'Dexamethasone', genericName: 'Dexamethasone', category: 'Steroids', typicalDose: '4-8mg IV', routes: ['oral', 'IV', 'IM'] },
    { name: 'Hydrocortisone', genericName: 'Hydrocortisone', category: 'Steroids', typicalDose: '100mg IV', routes: ['oral', 'IV', 'IM', 'topical'] },
    { name: 'Prednisolone', genericName: 'Prednisolone', category: 'Steroids', typicalDose: '5-20mg PO', routes: ['oral'] }
  ]
};
