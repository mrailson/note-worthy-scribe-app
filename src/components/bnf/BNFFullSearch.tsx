import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TLVocabItem, useTrafficLightVocab } from '@/hooks/useTrafficLightVocab';
import Fuse from 'fuse.js';

interface BNFFullSearchProps {
  onDrugSelect: (drugName: string, trafficLightItem?: TLVocabItem) => void;
}

// Comprehensive list of UK prescribed drugs - expanded to include newer and specialist medications
const COMMON_UK_DRUGS = [
  // Cardiovascular - Statins & Lipid-lowering
  "Atorvastatin", "Simvastatin", "Rosuvastatin", "Pravastatin", "Fluvastatin", "Ezetimibe",
  "Ezetimibe/Simvastatin", "Alirocumab", "Evolocumab", "Inclisiran", "Bempedoic acid",
  "Icosapent ethyl", "Omega-3 fatty acids", "Bezafibrate", "Fenofibrate", "Gemfibrozil",
  
  // Cardiovascular - ACE Inhibitors & ARBs
  "Ramipril", "Lisinopril", "Perindopril", "Enalapril", "Captopril", "Fosinopril", "Quinapril",
  "Trandolapril", "Imidapril", "Losartan", "Candesartan", "Irbesartan", "Valsartan", "Olmesartan",
  "Telmisartan", "Azilsartan", "Eprosartan", "Sacubitril/Valsartan", "Entresto",
  
  // Cardiovascular - Beta Blockers
  "Bisoprolol", "Atenolol", "Metoprolol", "Propranolol", "Carvedilol", "Nebivolol", "Labetalol",
  "Sotalol", "Nadolol", "Acebutolol", "Celiprolol", "Pindolol", "Timolol tablets",
  
  // Cardiovascular - Calcium Channel Blockers
  "Amlodipine", "Felodipine", "Lercanidipine", "Lacidipine", "Nifedipine", "Nimodipine",
  "Diltiazem", "Verapamil",
  
  // Cardiovascular - Diuretics
  "Furosemide", "Bumetanide", "Bendroflumethiazide", "Indapamide", "Chlortalidone", "Metolazone",
  "Spironolactone", "Eplerenone", "Amiloride", "Triamterene", "Finerenone",
  
  // Cardiovascular - Anticoagulants & Antiplatelets
  "Aspirin", "Clopidogrel", "Prasugrel", "Ticagrelor", "Dipyridamole", "Warfarin",
  "Rivaroxaban", "Apixaban", "Edoxaban", "Dabigatran", "Enoxaparin", "Dalteparin",
  "Tinzaparin", "Fondaparinux", "Heparin",
  
  // Cardiovascular - Anti-arrhythmics & Other
  "Digoxin", "Amiodarone", "Flecainide", "Propafenone", "Dronedarone", "Adenosine",
  "Isosorbide mononitrate", "Isosorbide dinitrate", "Glyceryl trinitrate", "Nicorandil",
  "Ivabradine", "Ranolazine", "Doxazosin", "Prazosin", "Terazosin", "Hydralazine",
  "Minoxidil", "Bosentan", "Ambrisentan", "Macitentan", "Riociguat", "Sildenafil pulmonary",
  
  // Respiratory - Bronchodilators
  "Salbutamol", "Terbutaline", "Ipratropium", "Tiotropium", "Glycopyrronium", "Umeclidinium",
  "Aclidinium", "Formoterol", "Salmeterol", "Vilanterol", "Indacaterol", "Olodaterol",
  "Theophylline", "Aminophylline",
  
  // Respiratory - Corticosteroids & Combinations
  "Beclometasone", "Budesonide", "Fluticasone", "Mometasone", "Ciclesonide",
  "Fluticasone/Salmeterol", "Budesonide/Formoterol", "Beclometasone/Formoterol",
  "Fluticasone/Vilanterol", "Fluticasone/Umeclidinium/Vilanterol", "Trimbow", "Trelegy",
  
  // Respiratory - Other
  "Montelukast", "Zafirlukast", "Carbocisteine", "Acetylcysteine", "Erdosteine",
  "Roflumilast", "Omalizumab", "Mepolizumab", "Benralizumab", "Dupilumab", "Tezepelumab",
  
  // Diabetes - Oral
  "Metformin", "Gliclazide", "Glimepiride", "Glibenclamide", "Glipizide", "Tolbutamide",
  "Pioglitazone", "Sitagliptin", "Linagliptin", "Alogliptin", "Saxagliptin", "Vildagliptin",
  "Empagliflozin", "Dapagliflozin", "Canagliflozin", "Ertugliflozin",
  "Repaglinide", "Nateglinide", "Acarbose",
  
  // Diabetes - GLP-1 Agonists (including weight management)
  "Liraglutide", "Semaglutide", "Dulaglutide", "Exenatide", "Lixisenatide",
  "Tirzepatide", "Mounjaro", "Ozempic", "Wegovy", "Trulicity", "Victoza", "Saxenda",
  
  // Diabetes - Insulin
  "Insulin glargine", "Insulin detemir", "Insulin degludec", "Tresiba",
  "Insulin aspart", "Insulin lispro", "Insulin glulisine", "Fiasp", "Humalog",
  "Insulin isophane", "Humulin", "Novomix", "Humalog Mix",
  
  // Gastrointestinal - PPIs & H2 Antagonists
  "Omeprazole", "Lansoprazole", "Esomeprazole", "Pantoprazole", "Rabeprazole",
  "Famotidine", "Cimetidine", "Nizatidine",
  
  // Gastrointestinal - Antiemetics
  "Domperidone", "Metoclopramide", "Ondansetron", "Granisetron", "Cyclizine",
  "Prochlorperazine", "Promethazine", "Hyoscine", "Aprepitant", "Fosaprepitant",
  "Nabilone", "Dexamethasone antiemetic",
  
  // Gastrointestinal - Laxatives
  "Senna", "Bisacodyl", "Sodium picosulfate", "Lactulose", "Macrogol", "Movicol",
  "Laxido", "Docusate", "Linaclotide", "Prucalopride", "Lubiprostone",
  "Ispaghula", "Methylcellulose", "Sterculia",
  
  // Gastrointestinal - IBS & IBD
  "Mebeverine", "Hyoscine butylbromide", "Buscopan", "Peppermint oil", "Colpermin",
  "Mesalazine", "Sulfasalazine", "Balsalazide", "Olsalazine", "Budesonide GI",
  "Infliximab GI", "Adalimumab GI", "Vedolizumab", "Ustekinumab GI",
  
  // Gastrointestinal - Antidiarrhoeals
  "Loperamide", "Codeine phosphate", "Kaolin", "Cholestyramine", "Colesevelam",
  
  // CNS - Analgesics - Paracetamol & NSAIDs
  "Paracetamol", "Ibuprofen", "Naproxen", "Diclofenac", "Piroxicam", "Meloxicam",
  "Etoricoxib", "Celecoxib", "Indomethacin", "Mefenamic acid", "Ketorolac",
  "Nabumetone", "Etodolac", "Aceclofenac",
  
  // CNS - Analgesics - Opioids
  "Codeine", "Dihydrocodeine", "Tramadol", "Morphine", "Oxycodone", "Fentanyl",
  "Buprenorphine", "Hydromorphone", "Methadone", "Tapentadol", "Alfentanil",
  "Diamorphine", "Pethidine", "Meptazinol",
  
  // CNS - Neuropathic Pain
  "Pregabalin", "Gabapentin", "Amitriptyline", "Nortriptyline", "Duloxetine",
  "Carbamazepine pain", "Capsaicin", "Lidocaine patches",
  
  // CNS - Migraine
  "Sumatriptan", "Rizatriptan", "Zolmitriptan", "Almotriptan", "Eletriptan",
  "Naratriptan", "Frovatriptan", "Pizotifen", "Propranolol migraine", "Topiramate migraine",
  "Fremanezumab", "Galcanezumab", "Erenumab", "Rimegepant", "Gepants",
  
  // CNS - Antidepressants - SSRIs
  "Sertraline", "Fluoxetine", "Citalopram", "Escitalopram", "Paroxetine", "Fluvoxamine",
  
  // CNS - Antidepressants - SNRIs & Others
  "Venlafaxine", "Duloxetine", "Mirtazapine", "Trazodone", "Bupropion",
  "Vortioxetine", "Agomelatine", "Reboxetine", "Moclobemide",
  
  // CNS - Antidepressants - Tricyclics
  "Amitriptyline", "Nortriptyline", "Clomipramine", "Imipramine", "Dosulepin",
  "Lofepramine", "Trimipramine",
  
  // CNS - Anxiolytics & Hypnotics
  "Diazepam", "Lorazepam", "Alprazolam", "Chlordiazepoxide", "Oxazepam", "Temazepam",
  "Zopiclone", "Zolpidem", "Zaleplon", "Melatonin", "Circadin", "Slenyto",
  "Promethazine sedative", "Diphenhydramine", "Hydroxyzine", "Buspirone",
  
  // CNS - Antipsychotics
  "Aripiprazole", "Olanzapine", "Quetiapine", "Risperidone", "Haloperidol",
  "Clozapine", "Amisulpride", "Paliperidone", "Lurasidone", "Cariprazine",
  "Chlorpromazine", "Flupentixol", "Zuclopenthixol", "Sulpiride",
  "Pimozide", "Prochlorperazine", "Trifluoperazine",
  
  // CNS - Mood Stabilisers
  "Lithium", "Lithium carbonate", "Priadel", "Camcolit",
  
  // CNS - ADHD
  "Methylphenidate", "Lisdexamfetamine", "Atomoxetine", "Guanfacine", "Concerta",
  "Ritalin", "Elvanse", "Equasym", "Medikinet", "Xaggitin",
  
  // CNS - Dementia
  "Donepezil", "Rivastigmine", "Galantamine", "Memantine",
  
  // CNS - Epilepsy
  "Sodium valproate", "Valproic acid", "Carbamazepine", "Lamotrigine", "Levetiracetam",
  "Topiramate", "Phenytoin", "Phenobarbital", "Primidone", "Clonazepam",
  "Gabapentin epilepsy", "Pregabalin epilepsy", "Zonisamide", "Lacosamide",
  "Perampanel", "Brivaracetam", "Eslicarbazepine", "Clobazam", "Vigabatrin",
  "Ethosuximide", "Rufinamide", "Stiripentol", "Cannabidiol", "Epidyolex",
  
  // CNS - Parkinson's Disease
  "Levodopa", "Co-beneldopa", "Co-careldopa", "Sinemet", "Madopar",
  "Pramipexole", "Ropinirole", "Rotigotine", "Apomorphine", "Entacapone",
  "Opicapone", "Rasagiline", "Selegiline", "Safinamide", "Amantadine", "Trihexyphenidyl",
  
  // CNS - Multiple Sclerosis
  "Interferon beta", "Glatiramer", "Dimethyl fumarate", "Teriflunomide",
  "Fingolimod", "Siponimod", "Ozanimod", "Ponesimod", "Natalizumab",
  "Ocrelizumab", "Ofatumumab", "Alemtuzumab", "Cladribine",
  
  // CNS - Other
  "Baclofen", "Tizanidine", "Dantrolene", "Botulinum toxin", "Riluzole",
  
  // Thyroid & Endocrine
  "Levothyroxine", "Liothyronine", "Carbimazole", "Propylthiouracil",
  "Hydrocortisone", "Prednisolone", "Dexamethasone", "Betamethasone",
  "Fludrocortisone", "Testosterone", "Nebido", "Testogel",
  "Oestradiol", "Estradiol", "Progesterone", "Utrogestan", "Norethisterone",
  "Medroxyprogesterone", "Dydrogesterone", "Conjugated oestrogens", "Tibolone",
  "Raloxifene", "Clomifene", "Letrozole", "Anastrozole",
  
  // Bone Health
  "Alendronic acid", "Risedronate", "Ibandronic acid", "Zoledronic acid",
  "Denosumab", "Prolia", "Romosozumab", "Teriparatide", "Abaloparatide",
  "Strontium ranelate", "Calcitonin", "Raloxifene bone",
  
  // Infections - Penicillins
  "Amoxicillin", "Co-amoxiclav", "Augmentin", "Flucloxacillin", "Phenoxymethylpenicillin",
  "Benzylpenicillin", "Ampicillin", "Piperacillin/Tazobactam", "Ticarcillin",
  
  // Infections - Cephalosporins
  "Cefalexin", "Cefuroxime", "Cefixime", "Cefaclor", "Ceftriaxone", "Ceftazidime",
  "Cefotaxime", "Cefepime", "Ceftaroline", "Ceftobiprole",
  
  // Infections - Macrolides
  "Clarithromycin", "Azithromycin", "Erythromycin", "Fidaxomicin",
  
  // Infections - Tetracyclines
  "Doxycycline", "Lymecycline", "Minocycline", "Oxytetracycline", "Tetracycline",
  
  // Infections - Quinolones
  "Ciprofloxacin", "Levofloxacin", "Moxifloxacin", "Ofloxacin", "Norfloxacin",
  
  // Infections - Other Antibiotics
  "Trimethoprim", "Co-trimoxazole", "Nitrofurantoin", "Metronidazole", "Tinidazole",
  "Clindamycin", "Vancomycin", "Teicoplanin", "Linezolid", "Tedizolid",
  "Daptomycin", "Tigecycline", "Colistin", "Fosfomycin", "Gentamicin",
  "Amikacin", "Tobramycin", "Rifampicin", "Fusidic acid",
  
  // Infections - Antifungals
  "Fluconazole", "Itraconazole", "Voriconazole", "Posaconazole", "Isavuconazole",
  "Nystatin", "Amphotericin", "Caspofungin", "Anidulafungin", "Micafungin",
  "Terbinafine", "Griseofulvin",
  
  // Infections - Antivirals
  "Aciclovir", "Valaciclovir", "Famciclovir", "Ganciclovir", "Valganciclovir",
  "Oseltamivir", "Zanamivir", "Baloxavir", "Remdesivir", "Molnupiravir",
  "Nirmatrelvir/Ritonavir", "Paxlovid", "Ribavirin",
  
  // Infections - HIV
  "Tenofovir", "Emtricitabine", "Lamivudine", "Abacavir", "Zidovudine",
  "Efavirenz", "Rilpivirine", "Etravirine", "Nevirapine", "Doravirine",
  "Dolutegravir", "Raltegravir", "Elvitegravir", "Bictegravir", "Cabotegravir",
  "Atazanavir", "Darunavir", "Lopinavir", "Ritonavir", "Cobicistat",
  "Maraviroc", "Lenacapavir", "Ibalizumab", "Descovy", "Truvada", "Biktarvy",
  
  // Infections - Hepatitis
  "Sofosbuvir", "Ledipasvir", "Velpatasvir", "Glecaprevir", "Pibrentasvir",
  "Daclatasvir", "Entecavir", "Tenofovir hepatitis",
  
  // Rheumatology - DMARDs
  "Methotrexate", "Sulfasalazine rheum", "Hydroxychloroquine", "Leflunomide",
  "Azathioprine", "Mycophenolate", "Ciclosporin", "Tacrolimus",
  "Gold", "Penicillamine", "Apremilast",
  
  // Rheumatology - Biologics
  "Adalimumab", "Humira", "Amgevita", "Hyrimoz", "Imraldi",
  "Etanercept", "Enbrel", "Benepali", "Erelzi",
  "Infliximab", "Remicade", "Inflectra", "Remsima",
  "Golimumab", "Simponi", "Certolizumab", "Cimzia",
  "Tocilizumab", "Sarilumab", "Anakinra",
  "Rituximab rheum", "Abatacept", "Secukinumab", "Ixekizumab",
  "Upadacitinib", "Tofacitinib", "Baricitinib", "Filgotinib",
  "Guselkumab", "Risankizumab", "Bimekizumab",
  
  // Rheumatology - Gout
  "Allopurinol", "Febuxostat", "Colchicine", "Rasburicase", "Pegloticase",
  
  // Dermatology - Topical Steroids
  "Hydrocortisone topical", "Clobetasone", "Betamethasone topical", "Clobetasol",
  "Mometasone topical", "Fluocinolone", "Fluocinonide", "Diflucortolone",
  
  // Dermatology - Other Topicals
  "Tacrolimus topical", "Pimecrolimus", "Calcipotriol", "Dithranol",
  "Coal tar", "Salicylic acid", "Emollients", "Aqueous cream", "Dermol",
  "Doublebase", "Epaderm", "Cetraben", "Aveeno", "E45",
  
  // Dermatology - Acne & Rosacea
  "Benzoyl peroxide", "Adapalene", "Tretinoin", "Isotretinoin", "Roaccutane",
  "Clindamycin topical", "Erythromycin topical", "Azelaic acid", "Metronidazole topical",
  "Ivermectin topical", "Brimonidine topical",
  
  // Dermatology - Psoriasis Biologics
  "Ustekinumab", "Stelara", "Secukinumab derm", "Cosentyx", "Ixekizumab derm",
  "Taltz", "Brodalumab", "Kyntheum", "Guselkumab derm", "Tremfya",
  "Risankizumab derm", "Skyrizi", "Bimekizumab derm",
  
  // Ophthalmology
  "Latanoprost", "Travoprost", "Bimatoprost", "Tafluprost", "Timolol eye",
  "Brimonidine eye", "Dorzolamide", "Brinzolamide", "Acetazolamide",
  "Chloramphenicol eye", "Fusidic acid eye", "Ofloxacin eye", "Levofloxacin eye",
  "Hypromellose", "Carbomer", "Polyethylene glycol eye", "Sodium hyaluronate eye",
  "Dexamethasone eye", "Prednisolone eye", "Fluorometholone", "Loteprednol",
  "Ketorolac eye", "Nepafenac", "Bromfenac", "Cyclopentolate", "Tropicamide",
  "Atropine eye", "Phenylephrine eye", "Ranibizumab", "Aflibercept", "Bevacizumab eye",
  "Faricimab", "Brolucizumab",
  
  // Urology
  "Tamsulosin", "Alfuzosin", "Doxazosin urology", "Silodosin",
  "Finasteride", "Dutasteride", "Combodart",
  "Oxybutynin", "Tolterodine", "Solifenacin", "Darifenacin", "Fesoterodine",
  "Mirabegron", "Vibegron", "Desmopressin", "Sildenafil ED", "Tadalafil ED",
  "Vardenafil", "Avanafil", "Alprostadil",
  
  // Oncology - Common
  "Tamoxifen", "Letrozole oncology", "Anastrozole oncology", "Exemestane",
  "Fulvestrant", "Goserelin", "Leuprorelin", "Triptorelin", "Degarelix",
  "Abiraterone", "Enzalutamide", "Apalutamide", "Darolutamide", "Bicalutamide",
  "Capecitabine", "Fluorouracil", "Cyclophosphamide", "Chlorambucil", "Melphalan",
  "Imatinib", "Nilotinib", "Dasatinib", "Bosutinib", "Ponatinib",
  "Ruxolitinib", "Fedratinib", "Ibrutinib", "Acalabrutinib", "Zanubrutinib",
  "Venetoclax", "Lenalidomide", "Pomalidomide", "Thalidomide",
  "Palbociclib", "Ribociclib", "Abemaciclib", "Olaparib", "Niraparib", "Rucaparib",
  
  // Haematology
  "Ferrous fumarate", "Ferrous sulfate", "Ferrous gluconate", "Ferric maltol",
  "Iron sucrose", "Ferric carboxymaltose", "Monofer",
  "Folic acid", "Vitamin B12", "Hydroxocobalamin", "Cyanocobalamin",
  "Erythropoietin", "Epoetin alfa", "Darbepoetin", "Filgrastim", "Pegfilgrastim",
  "Tranexamic acid", "Vitamin K", "Phytomenadione",
  
  // Vitamins & Minerals
  "Vitamin D", "Colecalciferol", "Ergocalciferol", "Alfacalcidol", "Calcitriol",
  "Calcium carbonate", "Calcichew", "Adcal", "Cacit",
  "Magnesium", "Potassium chloride", "Sando-K", "Kay-Cee-L",
  "Sodium chloride", "Thiamine", "Pyridoxine", "Ascorbic acid", "Riboflavin",
  "Nicotinamide", "Selenium", "Zinc", "Multivitamins",
  
  // Allergy & Immunology
  "Cetirizine", "Loratadine", "Fexofenadine", "Desloratadine", "Bilastine",
  "Chlorphenamine", "Promethazine allergy", "Hydroxyzine allergy",
  "Adrenaline", "EpiPen", "Jext", "Emerade", "Anapen",
  "Sodium cromoglicate", "Nedocromil",
  
  // Vaccines & Immunoglobulins
  "Influenza vaccine", "Pneumococcal vaccine", "Shingles vaccine", "Shingrix",
  "COVID-19 vaccine", "Hepatitis B vaccine", "Hepatitis A vaccine",
  "MMR vaccine", "Tetanus vaccine", "HPV vaccine",
  "Human immunoglobulin", "Anti-D immunoglobulin", "Rabies immunoglobulin",
  
  // Weight Management
  "Orlistat", "Xenical", "Alli", "Liraglutide weight", "Saxenda",
  "Semaglutide weight", "Wegovy", "Tirzepatide weight", "Mounjaro weight",
  
  // Smoking Cessation
  "Varenicline", "Champix", "Bupropion smoking", "Zyban",
  "Nicotine replacement", "Nicotine patches", "Nicotine gum", "Nicotine lozenges",
  "Nicotine inhalator", "Nicotine nasal spray", "Nicotine mouth spray",
  
  // Alcohol Dependence
  "Acamprosate", "Naltrexone", "Nalmefene", "Disulfiram",
  
  // Opioid Dependence
  "Methadone", "Buprenorphine dependence", "Subutex", "Suboxone", "Naloxone",
  
  // Palliative Care
  "Midazolam", "Levomepromazine", "Glycopyrronium injection", "Haloperidol injection",
  "Alfentanil", "Diamorphine", "Hyoscine hydrobromide",
  
  // Miscellaneous
  "Quinine", "Hydroxychloroquine malaria", "Chloroquine", "Atovaquone/Proguanil",
  "Mefloquine", "Primaquine", "Dapsone", "Potassium iodide", "Sodium bicarbonate",
  "Acetazolamide altitude", "Fampridine", "Modafinil", "Pitolisant", "Sodium oxybate",
];

interface SearchItem {
  name: string;
  type: 'icb' | 'bnf';
  trafficLightItem?: TLVocabItem;
}

export const BNFFullSearch: React.FC<BNFFullSearchProps> = ({ onDrugSelect }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { vocab: icbDrugs, isLoading } = useTrafficLightVocab();

  // Create combined search list
  const searchItems = useMemo(() => {
    const items: SearchItem[] = [];
    
    // Add ICB drugs
    icbDrugs.forEach(drug => {
      items.push({
        name: drug.name,
        type: 'icb',
        trafficLightItem: drug
      });
    });

    // Add BNF drugs that aren't in ICB
    const icbNames = new Set(icbDrugs.map(d => d.name.toLowerCase()));
    COMMON_UK_DRUGS.forEach(drugName => {
      if (!icbNames.has(drugName.toLowerCase())) {
        items.push({
          name: drugName,
          type: 'bnf'
        });
      }
    });

    return items;
  }, [icbDrugs]);

  // Create Fuse instance
  const fuse = useMemo(() => {
    return new Fuse(searchItems, {
      keys: ['name'],
      threshold: 0.3,
      distance: 100,
      minMatchCharLength: 2,
      includeScore: true,
    });
  }, [searchItems]);

  // Search results
  const results = useMemo(() => {
    if (query.length < 2) return [];

    const searchResults = fuse.search(query);

    // Sort by score and prefix match, with ICB results first
    return searchResults
      .map(result => ({
        ...result,
        prefixMatch: result.item.name.toLowerCase().startsWith(query.toLowerCase()),
      }))
      .sort((a, b) => {
        // ICB results first
        if (a.item.type === 'icb' && b.item.type !== 'icb') return -1;
        if (a.item.type !== 'icb' && b.item.type === 'icb') return 1;
        // Then prefix matches
        if (a.prefixMatch && !b.prefixMatch) return -1;
        if (!a.prefixMatch && b.prefixMatch) return 1;
        // Then by score
        return (a.score || 0) - (b.score || 0);
      })
      .slice(0, 15)
      .map(r => r.item);
  }, [query, fuse]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (item: SearchItem) => {
    onDrugSelect(item.name, item.trafficLightItem);
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(0);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        listRef.current &&
        !listRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  return (
    <div className="relative">
      <div className="relative">
        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search all drugs (BNF + ICB)..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(e.target.value.length >= 2);
          }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <div
          ref={listRef}
          className={cn(
            "absolute top-full left-0 right-0 mt-1 z-50",
            "bg-popover border rounded-lg shadow-lg",
            "max-h-[300px] overflow-y-auto"
          )}
        >
          {results.map((item, index) => (
            <button
              key={`${item.type}-${item.name}`}
              onClick={() => handleSelect(item)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2",
                "text-left text-sm",
                "hover:bg-accent transition-colors",
                index === selectedIndex && "bg-accent"
              )}
            >
              <span className="font-medium text-foreground truncate flex-1 mr-2">
                {item.name}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs shrink-0",
                  item.type === 'icb'
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-slate-50 text-slate-600 border-slate-200"
                )}
              >
                {item.type === 'icb' ? 'ICB' : 'BNF'}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className={cn(
          "absolute top-full left-0 right-0 mt-1 z-50",
          "bg-popover border rounded-lg shadow-lg",
          "px-3 py-4 text-center text-sm text-muted-foreground"
        )}>
          No drugs found matching "{query}" - try the full drug name
        </div>
      )}
    </div>
  );
};
