import { useState, useEffect } from 'react';
import { Download, ShoppingCart, User, Search, Heart, Scissors, Plus, Minus, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { patientService } from '../services/patientService';

interface Patient {
  id: string;
  hospital_number: string;
  full_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
}

interface AvailableItem {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  defaultUnit: string;
}

interface SelectedItem extends AvailableItem {
  quantity: number;
}

export default function ShoppingList() {
  const [selectedCategory, setSelectedCategory] = useState<'wound_dressing' | 'surgery' | 'bedside_debridement'>('surgery');
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [manualPatientName, setManualPatientName] = useState('');
  const [manualHospitalNumber, setManualHospitalNumber] = useState('');

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoadingPatients(true);
      const fetchedPatients = await patientService.getAllPatients();
      setPatients(fetchedPatients);
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoadingPatients(false);
    }
  };

  const filteredPatients = patients.filter(patient =>
    (patient.full_name || '').toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
    (patient.hospital_number || '').toLowerCase().includes(patientSearchTerm.toLowerCase())
  );

  // Comprehensive item database
  const availableItems: AvailableItem[] = [
    // Cannulas
    { id: 'cannula-16', name: 'Cannula Size 16', category: 'Cannulas', defaultUnit: 'piece' },
    { id: 'cannula-18', name: 'Cannula Size 18', category: 'Cannulas', defaultUnit: 'piece' },
    { id: 'cannula-20', name: 'Cannula Size 20', category: 'Cannulas', defaultUnit: 'piece' },
    { id: 'cannula-22', name: 'Cannula Size 22', category: 'Cannulas', defaultUnit: 'piece' },
    { id: 'cannula-24', name: 'Cannula Size 24', category: 'Cannulas', defaultUnit: 'piece' },
    
    // Plaster
    { id: 'plaster-big', name: 'Plaster (Big)', category: 'Plaster', defaultUnit: 'roll' },
    { id: 'plaster-small', name: 'Plaster (Small)', category: 'Plaster', defaultUnit: 'roll' },
    
    // Giving Sets
    { id: 'infusion-set', name: 'Infusion Giving Set', category: 'Giving Sets', defaultUnit: 'piece' },
    { id: 'blood-set', name: 'Blood Giving Set', category: 'Giving Sets', defaultUnit: 'piece' },
    
    // Syringes
    { id: 'syringe-10ml', name: 'Syringe 10 mls', category: 'Syringes', defaultUnit: 'piece' },
    { id: 'syringe-5ml', name: 'Syringe 5 mls', category: 'Syringes', defaultUnit: 'piece' },
    { id: 'syringe-2ml', name: 'Syringe 2 mls', category: 'Syringes', defaultUnit: 'piece' },
    
    // IV Fluids
    { id: 'iv-ns', name: 'Infusion Normal Saline', category: 'IV Fluids', defaultUnit: 'bottle' },
    { id: 'iv-d10', name: 'Infusion 10% Dextrose', category: 'IV Fluids', defaultUnit: 'bottle' },
    { id: 'iv-d5', name: 'Infusion 5% Dextrose', category: 'IV Fluids', defaultUnit: 'bottle' },
    { id: 'iv-d4.3', name: 'Infusion 4.3% Dextrose in 0.2% Saline', category: 'IV Fluids', defaultUnit: 'bottle' },
    { id: 'rl-fluid', name: "Ringer's Lactate", category: 'IV Fluids', defaultUnit: 'bottle' },
    
    // Gloves
    { id: 'neogloves', name: 'Neogloves', category: 'Gloves', defaultUnit: 'pair' },
    { id: 'surgical-8.0', name: 'Surgical Gloves (UNIGLOVES) Size 8.0', category: 'Gloves', defaultUnit: 'pair' },
    { id: 'surgical-7.5', name: 'Surgical Gloves (UNIGLOVES) Size 7.5', category: 'Gloves', defaultUnit: 'pair' },
    
    // Anesthetics
    { id: 'xylocaine-plain', name: 'Plain Xylocaine', category: 'Anesthetics', defaultUnit: 'vial' },
    { id: 'xylocaine-adr', name: 'Xylocaine + Adrenaline', category: 'Anesthetics', defaultUnit: 'vial' },
    { id: 'bupivacaine-0.25', name: 'Bupivacaine 0.25%', category: 'Anesthetics', defaultUnit: 'vial' },
    { id: 'bupivacaine-0.5', name: 'Bupivacaine 0.5%', category: 'Anesthetics', defaultUnit: 'vial' },
    { id: 'marcaine-adr', name: 'Marcaine + Adrenaline', category: 'Anesthetics', defaultUnit: 'vial' },
    { id: 'injection-adrenaline', name: 'Injection Adrenaline', category: 'Anesthetics', defaultUnit: 'ampoule' },
    
    // Water for Injection
    { id: 'water-inj', name: 'Water for Injection', category: 'Injectables', defaultUnit: 'ampoule' },
    { id: 'water-inj-extra', name: 'Water for Injection (Extra)', category: 'Injectables', defaultUnit: 'ampoule' },
    
    // Antibiotics
    { id: 'cipro-200', name: 'Infusion Ciprofloxacin 200 mg', category: 'Antibiotics', defaultUnit: 'bottle' },
    { id: 'ceftriaxone-1g', name: 'Injection Ceftriaxone 1 g', category: 'Antibiotics', defaultUnit: 'vial' },
    { id: 'levoflox-500', name: 'Infusion Levofloxacin 500 mg', category: 'Antibiotics', defaultUnit: 'bottle' },
    { id: 'dalacin', name: 'IV Dalacin C', category: 'Antibiotics', defaultUnit: 'vial' },
    { id: 'augmentin', name: 'IV Augmentin', category: 'Antibiotics', defaultUnit: 'vial' },
    { id: 'tinidazole', name: 'IV Tinidazole 800 mg', category: 'Antibiotics', defaultUnit: 'bottle' },
    { id: 'flagyl', name: 'IV Flagyl', category: 'Antibiotics', defaultUnit: 'bottle' },
    
    // Surgical Instruments
    { id: 'humby-blade', name: 'Humby Knife Blade', category: 'Surgical Instruments', defaultUnit: 'piece' },
    { id: 'blade-10', name: 'Surgical Blade #10', category: 'Surgical Instruments', defaultUnit: 'piece' },
    { id: 'blade-11', name: 'Surgical Blade #11', category: 'Surgical Instruments', defaultUnit: 'piece' },
    { id: 'blade-15', name: 'Surgical Blade #15', category: 'Surgical Instruments', defaultUnit: 'piece' },
    { id: 'blade-22', name: 'Surgical Blade #22', category: 'Surgical Instruments', defaultUnit: 'piece' },
    { id: 'skin-stapler', name: 'Skin Stapler', category: 'Surgical Instruments', defaultUnit: 'piece' },
    { id: 'staple-remover', name: 'Skin Staple Remover', category: 'Surgical Instruments', defaultUnit: 'piece' },
    { id: 'finger-tourniquet', name: 'Finger Tourniquet', category: 'Surgical Instruments', defaultUnit: 'piece' },
    
    // Sutures - Vicryl
    { id: 'vicryl-4/0', name: 'Suture Vicryl 4/0', category: 'Sutures', subcategory: 'Vicryl', defaultUnit: 'pack' },
    { id: 'vicryl-3/0', name: 'Suture Vicryl 3/0', category: 'Sutures', subcategory: 'Vicryl', defaultUnit: 'pack' },
    { id: 'vicryl-2/0', name: 'Suture Vicryl 2/0', category: 'Sutures', subcategory: 'Vicryl', defaultUnit: 'pack' },
    
    // Sutures - Prolene/Nylon
    { id: 'prolene-6/0', name: 'Suture Prolene/Nylon 6/0', category: 'Sutures', subcategory: 'Prolene/Nylon', defaultUnit: 'pack' },
    { id: 'prolene-5/0', name: 'Suture Prolene/Nylon 5/0', category: 'Sutures', subcategory: 'Prolene/Nylon', defaultUnit: 'pack' },
    { id: 'prolene-4/0', name: 'Suture Prolene/Nylon 4/0', category: 'Sutures', subcategory: 'Prolene/Nylon', defaultUnit: 'pack' },
    { id: 'prolene-3/0', name: 'Suture Prolene/Nylon 3/0', category: 'Sutures', subcategory: 'Prolene/Nylon', defaultUnit: 'pack' },
    { id: 'prolene-2/0', name: 'Suture Prolene/Nylon 2/0', category: 'Sutures', subcategory: 'Prolene/Nylon', defaultUnit: 'pack' },
    
    // Sutures - Silk
    { id: 'silk-3/0', name: 'Suture Silk 3/0', category: 'Sutures', subcategory: 'Silk', defaultUnit: 'pack' },
    { id: 'silk-2/0', name: 'Suture Silk 2/0', category: 'Sutures', subcategory: 'Silk', defaultUnit: 'pack' },
    
    // Antiseptics & Ointments
    { id: 'povidone-sol', name: 'Povidone Iodine Solution', category: 'Antiseptics', defaultUnit: 'bottle' },
    { id: 'povidone-oint', name: 'Povidone Iodine Ointment', category: 'Antiseptics', defaultUnit: 'tube' },
    { id: 'chloramphenicol', name: 'Chloramphenicol Eye Ointment', category: 'Ointments', defaultUnit: 'tube' },
    { id: 'gentamycin', name: 'Gentamycin Ointment', category: 'Ointments', defaultUnit: 'tube' },
    { id: 'savlon', name: 'SAVLON', category: 'Antiseptics', defaultUnit: 'bottle' },
    { id: 'h2o2', name: 'Hydrogen Peroxide', category: 'Antiseptics', defaultUnit: 'bottle' },
    { id: 'sanitol', name: 'Hand Wash (Sanitol)', category: 'Antiseptics', defaultUnit: 'bottle' },
    
    // Dressings
    { id: 'sofratulle', name: 'Sofratulle Gauze', category: 'Dressings', defaultUnit: 'piece' },
    { id: 'hera-gel', name: 'Hera Wound Gel', category: 'Dressings', defaultUnit: 'tube' },
    { id: 'honeygauze', name: 'Woundcare Honeygauze', category: 'Dressings', defaultUnit: 'piece' },
    { id: 'wound-clex', name: 'Wound Clex', category: 'Dressings', defaultUnit: 'bottle' },
    { id: 'alginate', name: 'Alginate Dressings (Kaltostat)', category: 'Dressings', defaultUnit: 'piece' },
    { id: 'foam-mepilex', name: 'Foam Dressings (Mepilex type)', category: 'Dressings', defaultUnit: 'piece' },
    { id: 'silver-dress', name: 'Silver-impregnated Dressings', category: 'Dressings', defaultUnit: 'piece' },
    { id: 'gauze-packs', name: 'Sterile Gauze Packs', category: 'Dressings', defaultUnit: 'pack' },
    { id: 'dressing-packs', name: 'Dressing Packs (Sterile)', category: 'Dressings', defaultUnit: 'pack' },
    { id: 'plastic-set', name: 'Plastic Set (Sterile Plastic Surgery Dressing Set)', category: 'Dressings', defaultUnit: 'set' },
    
    // Bandages
    { id: 'crepe-6in', name: 'Crepe Bandage 6 inch', category: 'Bandages', defaultUnit: 'roll' },
    { id: 'crepe-4in', name: 'Crepe Bandage 4 inch', category: 'Bandages', defaultUnit: 'roll' },
    { id: 'veil-band', name: 'Veil Band', category: 'Bandages', defaultUnit: 'roll' },
    { id: 'pop-bandage', name: 'POP Bandage', category: 'Bandages', defaultUnit: 'roll' },
    
    // Catheters
    { id: 'cath-16', name: 'Urethral Catheter Size 16', category: 'Catheters', defaultUnit: 'piece' },
    { id: 'cath-14', name: 'Urethral Catheter Size 14', category: 'Catheters', defaultUnit: 'piece' },
    { id: 'cath-12', name: 'Urethral Catheter Size 12', category: 'Catheters', defaultUnit: 'piece' },
    { id: 'foley-18', name: 'Foley Catheter 18', category: 'Catheters', defaultUnit: 'piece' },
    { id: 'foley-20', name: 'Foley Catheter 20', category: 'Catheters', defaultUnit: 'piece' },
    { id: 'urine-bag', name: 'Urine Bag', category: 'Catheters', defaultUnit: 'piece' },
    { id: 'ky-jelly', name: 'KY Jelly', category: 'Catheters', defaultUnit: 'tube' },
    
    // Drains
    { id: 'redivac', name: 'Redivac Drain', category: 'Drains', defaultUnit: 'piece' },
    { id: 'penrose', name: 'Penrose Drain', category: 'Drains', defaultUnit: 'piece' },
    { id: 'drain-bottle', name: 'Wound Drainage Bottles', category: 'Drains', defaultUnit: 'piece' },
    { id: 'ng-tube-10', name: 'Size 10 NG Tube', category: 'Drains', defaultUnit: 'piece' },
    
    // Miscellaneous
    { id: 'specimen-cont', name: 'Specimen Container', category: 'Miscellaneous', defaultUnit: 'piece' },
    
    // Splints
    { id: 'alu-splint', name: 'Aluminum Finger Splints', category: 'Splints', defaultUnit: 'piece' },
    { id: 'thermoplastic', name: 'Thermoplastic Splint Material', category: 'Splints', defaultUnit: 'sheet' },
    
    // Sterile Consumables
    { id: 'sterile-drapes', name: 'Sterile Drapes', category: 'Sterile Consumables', defaultUnit: 'piece' },
    { id: 'surgical-gown', name: 'Surgical Gowns', category: 'Sterile Consumables', defaultUnit: 'piece' },
    { id: 'mayo-cover', name: 'Mayo Stand Cover', category: 'Sterile Consumables', defaultUnit: 'piece' },
    { id: 'suction-tube', name: 'Suction Tubing', category: 'Sterile Consumables', defaultUnit: 'piece' },
    
    // Analgesics
    { id: 'iv-paracetamol', name: 'IV Paracetamol', category: 'Analgesics', defaultUnit: 'vial' },
    { id: 'tramadol', name: 'Tramadol', category: 'Analgesics', defaultUnit: 'ampoule' },
    { id: 'diclofenac', name: 'Diclofenac', category: 'Analgesics', defaultUnit: 'ampoule' },
    { id: 'ketorolac', name: 'Ketorolac', category: 'Analgesics', defaultUnit: 'ampoule' },
    
    // Anti-emetics
    { id: 'ondansetron', name: 'Ondansetron', category: 'Anti-emetics', defaultUnit: 'ampoule' },
    { id: 'metoclopramide', name: 'Metoclopramide', category: 'Anti-emetics', defaultUnit: 'ampoule' },
  ];

  const categories = Array.from(new Set(availableItems.map(item => item.category))).sort();

  const filteredAvailableItems = availableItems.filter(item => {
    const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategoryFilter === 'all' || item.category === selectedCategoryFilter;
    const notSelected = !selectedItems.find(si => si.id === item.id);
    return matchesSearch && matchesCategory && notSelected;
  });

  const addItem = (item: AvailableItem) => {
    setSelectedItems([...selectedItems, { ...item, quantity: 1 }]);
  };

  const removeItem = (id: string) => {
    setSelectedItems(selectedItems.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return;
    setSelectedItems(selectedItems.map(item => 
      item.id === id ? { ...item, quantity } : item
    ));
  };

  const clearAll = () => {
    setSelectedItems([]);
  };

  const handleDownloadClick = () => {
    if (selectedItems.length === 0) {
      alert('Please select at least one item');
      return;
    }
    setManualPatientName('');
    setManualHospitalNumber('');
    setShowPatientSelector(true);
  };

  const generatePDF = (patient: Patient | null, manualName?: string, manualHospNum?: string) => {
    const patientName = patient?.full_name || manualName || 'Unknown Patient';
    const hospitalNum = patient?.hospital_number || manualHospNum || 'N/A';
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let yPos = margin;

    // Header
    doc.setFillColor(14, 159, 110);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Surgical Shopping List', pageWidth / 2, 12, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Burns Plastic and Reconstructive Surgery Unit', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(9);
    doc.text('Drs Okwesili / Nnadi / Eze', pageWidth / 2, 26, { align: 'center' });
    doc.setFontSize(8);
    doc.text('Department of Surgery, University of Nigeria Teaching Hospital', pageWidth / 2, 32, { align: 'center' });
    doc.setFontSize(7);
    doc.text('Enugu, Nigeria', pageWidth / 2, 37, { align: 'center' });

    yPos = 50;
    doc.setTextColor(0, 0, 0);

    // Patient Information Box
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(14, 159, 110);
    doc.rect(margin, yPos, maxWidth, 30, 'FD');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Patient Information:', margin + 3, yPos + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${patientName}`, margin + 3, yPos + 13);
    doc.text(`Hospital Number: ${hospitalNum}`, margin + 3, yPos + 19);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin + 3, yPos + 25);
    
    yPos += 40;

    // Category Title
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(14, 159, 110);
    const categoryTitle = selectedCategory === 'wound_dressing' ? 'Wound Dressing' : 
                          selectedCategory === 'bedside_debridement' ? 'Bedside Debridement' : 
                          'Surgical Procedure';
    doc.text(categoryTitle, margin, yPos);
    yPos += 10;

    doc.setTextColor(0, 0, 0);

    // Table Header
    doc.setFillColor(14, 159, 110);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.rect(margin, yPos, maxWidth, 8, 'F');
    doc.text('Item', margin + 2, yPos + 6);
    doc.text('Category', margin + 80, yPos + 6);
    doc.text('Qty', margin + maxWidth - 30, yPos + 6);
    doc.text('Unit', margin + maxWidth - 15, yPos + 6);
    yPos += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    // Items
    selectedItems.forEach((item, index) => {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = margin;
      }

      // Alternating row colors
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPos - 5, maxWidth, 7, 'F');
      }

      const itemText = item.name.length > 40 ? item.name.substring(0, 37) + '...' : item.name;
      const categoryText = item.category.length > 15 ? item.category.substring(0, 12) + '...' : item.category;
      
      doc.text(itemText, margin + 2, yPos);
      doc.text(categoryText, margin + 80, yPos);
      doc.text(item.quantity.toString(), margin + maxWidth - 30, yPos);
      doc.text(item.defaultUnit, margin + maxWidth - 15, yPos);
      yPos += 7;
    });

    // Summary Box
    yPos += 10;
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(14, 159, 110);
    doc.rect(margin, yPos, maxWidth, 30, 'FD');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(14, 159, 110);
    doc.text('Summary:', margin + 3, yPos + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Items: ${selectedItems.length}`, margin + 3, yPos + 15);
    doc.text(`Total Quantity: ${selectedItems.reduce((sum, item) => sum + item.quantity, 0)}`, margin + 3, yPos + 22);

    // Footer
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated: ${new Date().toLocaleDateString()} | Patient: ${patient.full_name}`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
    doc.setFontSize(7);
    doc.text(
      'Please verify all items before purchase. Quantities may vary based on requirements.',
      pageWidth / 2,
      footerY + 5,
      { align: 'center' }
    );

    // Save
    const sanitizedPatientName = patient.full_name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const filename = `ShoppingList_${sanitizedPatientName}_${categoryTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
    // Close modals and reset
    setShowPatientSelector(false);
    setPatientSearchTerm('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Surgical Shopping List Generator</h1>
        <p className="text-gray-600">
          Select items with quantities to generate a comprehensive shopping list
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => {
            setSelectedCategory('surgery');
            setSelectedItems([]);
          }}
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            selectedCategory === 'surgery'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5" />
            Surgery
          </div>
        </button>
        <button
          onClick={() => {
            setSelectedCategory('wound_dressing');
            setSelectedItems([]);
          }}
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            selectedCategory === 'wound_dressing'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Wound Dressing
          </div>
        </button>
        <button
          onClick={() => {
            setSelectedCategory('bedside_debridement');
            setSelectedItems([]);
          }}
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            selectedCategory === 'bedside_debridement'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Bedside Debridement
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Available Items */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Items</h2>
          
          {/* Search and Filter */}
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Items Grid */}
          <div className="max-h-[600px] overflow-y-auto space-y-2">
            {filteredAvailableItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm || selectedCategoryFilter !== 'all' ? 'No items found' : 'All items selected'}
              </div>
            ) : (
              filteredAvailableItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-sm text-gray-500">{item.category}</div>
                  </div>
                  <button
                    onClick={() => addItem(item)}
                    className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Selected Items */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Selected Items ({selectedItems.length})
            </h2>
            {selectedItems.length > 0 && (
              <button
                onClick={clearAll}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="max-h-[600px] overflow-y-auto space-y-3 mb-4">
            {selectedItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No items selected</p>
                <p className="text-sm">Add items from the left panel</p>
              </div>
            ) : (
              selectedItems.map(item => (
                <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 pr-2">
                      <div className="font-medium text-sm text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.category}</div>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="p-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1 text-center border border-gray-300 rounded text-sm"
                      min="1"
                    />
                    <span className="text-sm text-gray-600">{item.defaultUnit}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedItems.length > 0 && (
            <button
              onClick={handleDownloadClick}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <Download className="w-5 h-5" />
              Generate Shopping List
            </button>
          )}
        </div>
      </div>

      {/* Patient Selector Modal */}
      {showPatientSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-green-600 text-white p-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-xl font-bold mb-1">Select Patient</h2>
                  <p className="text-green-100 text-sm">
                    Choose a patient or enter details manually
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPatientSelector(false);
                    setPatientSearchTerm('');
                    setManualPatientName('');
                    setManualHospitalNumber('');
                  }}
                  className="text-white hover:text-green-100"
                >
                  ✕
                </button>
              </div>
              <div className="mt-4 text-sm text-green-100">
                <strong>Items:</strong> {selectedItems.length} selected
              </div>
            </div>

            {/* Manual Entry Section */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Or Enter Patient Details Manually:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Patient Name"
                  value={manualPatientName}
                  onChange={(e) => setManualPatientName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
                <input
                  type="text"
                  placeholder="Hospital Number (optional)"
                  value={manualHospitalNumber}
                  onChange={(e) => setManualHospitalNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
              </div>
              {manualPatientName && (
                <button
                  onClick={() => {
                    generatePDF(null, manualPatientName, manualHospitalNumber);
                    setShowPatientSelector(false);
                    setManualPatientName('');
                    setManualHospitalNumber('');
                  }}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Generate PDF for "{manualPatientName}"
                </button>
              )}
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Or Select from Database:</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name or hospital number..."
                  value={patientSearchTerm}
                  onChange={(e) => setPatientSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Patient List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingPatients ? (
                <div className="text-center py-8 text-gray-500">
                  Loading patients...
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {patientSearchTerm ? 'No patients found matching your search' : 'No patients available'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => {
                        generatePDF(patient);
                        setShowPatientSelector(false);
                        setPatientSearchTerm('');
                      }}
                      className="w-full text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 rounded-lg text-green-600">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900">{patient.full_name}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Hospital #:</span> {patient.hospital_number}
                          </div>
                          <div className="flex gap-4 mt-1 text-xs text-gray-500">
                            <span>{patient.gender}</span>
                            {patient.phone && <span>📞 {patient.phone}</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-600 text-center">
                Patient information will be included in the shopping list PDF
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
