import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const prisma = new PrismaClient();
const district = 'Khordha';
const phcData = [
  ['Balianta Primary Health Centre', 20.2458, 85.8831],
  ['Balipatna Community Health Centre', 20.1543, 85.8726],
  ['Begunia Primary Health Centre', 20.0228, 85.3438],
  ['Bolagarh Community Health Centre', 20.1793, 85.3436],
  ['Chandaka Primary Health Centre', 20.3694, 85.7351],
  ['Jatni Community Health Centre', 20.1597, 85.7072],
  ['Khordha District Headquarters PHC', 20.182, 85.6169],
  ['Tangi Community Health Centre', 20.2004, 85.6265],
  ['Banapur Primary Health Centre', 19.7783, 85.1727],
];
const medicineData = [
  ['ORS sachet', 'Rehydration', 'sachet', 6], ['Paracetamol 500 mg', 'Analgesic', 'tablet', 14],
  ['Amoxicillin 500 mg', 'Antibiotic', 'capsule', 8], ['Azithromycin 500 mg', 'Antibiotic', 'tablet', 5],
  ['Cefixime 200 mg', 'Antibiotic', 'tablet', 4], ['Metronidazole 400 mg', 'Antibiotic', 'tablet', 5],
  ['Cetirizine 10 mg', 'Antihistamine', 'tablet', 8], ['Omeprazole 20 mg', 'Gastrointestinal', 'capsule', 7],
  ['Amlodipine 5 mg', 'Cardiovascular', 'tablet', 9], ['Losartan 50 mg', 'Cardiovascular', 'tablet', 6],
  ['Metformin 500 mg', 'Diabetes', 'tablet', 10], ['Glibenclamide 5 mg', 'Diabetes', 'tablet', 3],
  ['Salbutamol inhaler', 'Respiratory', 'inhaler', 2], ['Budesonide inhaler', 'Respiratory', 'inhaler', 1],
  ['Iron folic acid tablet', 'Maternal health', 'tablet', 18], ['Calcium 500 mg', 'Maternal health', 'tablet', 12],
  ['Vitamin A 200000 IU', 'Nutrition', 'capsule', 1], ['Albendazole 400 mg', 'Antiparasitic', 'tablet', 2],
  ['Chloroquine 250 mg', 'Antimalarial', 'tablet', 2], ['Artemether lumefantrine', 'Antimalarial', 'course', 1],
  ['Povidone iodine solution', 'Antiseptic', 'bottle', 1], ['Tetanus toxoid vaccine', 'Vaccine', 'vial', 1],
  ['Insulin regular 40 IU', 'Diabetes', 'vial', 1], ['Ranitidine 150 mg', 'Gastrointestinal', 'tablet', 4],
  ['Doxycycline 100 mg', 'Antibiotic', 'capsule', 3], ['Furosemide 40 mg', 'Cardiovascular', 'tablet', 3],
  ['Loperamide 2 mg', 'Gastrointestinal', 'tablet', 2],
];

function randomGenerator(seed) {
  let state = seed;
  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

async function seedDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.transferRequest.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.syncRecord.deleteMany();
  await prisma.consumptionLog.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.warehouseStock.deleteMany();
  await prisma.user.deleteMany();
  await prisma.medicine.deleteMany();
  await prisma.pHC.deleteMany();
  await prisma.districtWarehouse.deleteMany();

  const phcs = [];
  for (let index = 0; index < phcData.length; index += 1) {
    const [name, latitude, longitude] = phcData[index];
    phcs.push(await prisma.pHC.create({ data: { name, district, latitude, longitude, phone: `0674-25${String(1100 + index).slice(-4)}` } }));
  }
  const medicines = [];
  for (const [name, category, unit] of medicineData) medicines.push(await prisma.medicine.create({ data: { name, category, unit, is_essential: true } }));

  const password_hash = await bcrypt.hash('MediSyncDemo2026!', 10);
  const users = await Promise.all([
    prisma.user.create({ data: { name: 'Ananya Das', email: 'pharmacist@medisync.demo', password_hash, role: 'PHARMACIST', phc_id: phcs[0].id } }),
    prisma.user.create({ data: { name: 'Dr. Suman Mohanty', email: 'officer@medisync.demo', password_hash, role: 'MEDICAL_OFFICER', phc_id: phcs[0].id } }),
    prisma.user.create({ data: { name: 'Ritika Patnaik', email: 'admin@medisync.demo', password_hash, role: 'DISTRICT_ADMIN' } }),
  ]);

  const warehouse = await prisma.districtWarehouse.create({ data: { district, latitude: 20.2961, longitude: 85.8245 } });
  const random = randomGenerator(20261010);
  const now = new Date();
  const stockRows = [];
  const consumptionRows = [];
  const baseDemands = new Map(medicines.map(medicine => [medicine.id, medicineData.find(entry => entry[0] === medicine.name)[3]]));
  for (let phcIndex = 0; phcIndex < phcs.length; phcIndex += 1) {
    const phc = phcs[phcIndex];
    for (let medicineIndex = 0; medicineIndex < medicines.length; medicineIndex += 1) {
      const medicine = medicines[medicineIndex];
      const base = baseDemands.get(medicine.id) * (0.75 + random() * 0.5);
      for (let daysAgo = 59; daysAgo >= 0; daysAgo -= 1) {
        const date = new Date(now);
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() - daysAgo);
        let quantity = Math.max(0, Math.round(base * (0.65 + random() * 0.7)));
        if (phcIndex === 1 && medicineIndex === 0 && daysAgo < 3) quantity = Math.round(base * 4.5);
        consumptionRows.push({ phc_id: phc.id, medicine_id: medicine.id, date, quantity_used: quantity });
      }

      const shortage = phcIndex === 8 && [0, 2, 14].includes(medicineIndex);
      const onHand = shortage ? Math.max(1, Math.round(base * 2)) : Math.round(base * (34 + random() * 22));
      const nearExpiry = (phcIndex === 2 && medicineIndex === 5) || (phcIndex === 5 && medicineIndex === 15);
      if (nearExpiry) {
        const expiry = new Date(now);
        expiry.setDate(expiry.getDate() + (phcIndex === 2 ? 19 : 48));
        stockRows.push({ phc_id: phc.id, medicine_id: medicine.id, batch_no: `B${2026}${String(phcIndex + 1).padStart(2, '0')}${String(medicineIndex + 1).padStart(2, '0')}E`, quantity: Math.ceil(onHand * 0.35), expiry_date: expiry });
        const laterExpiry = new Date(now);
        laterExpiry.setFullYear(laterExpiry.getFullYear() + 2);
        stockRows.push({ phc_id: phc.id, medicine_id: medicine.id, batch_no: `B${2026}${String(phcIndex + 1).padStart(2, '0')}${String(medicineIndex + 1).padStart(2, '0')}N`, quantity: onHand - Math.ceil(onHand * 0.35), expiry_date: laterExpiry });
      } else {
        const expiry = new Date(now);
        expiry.setFullYear(expiry.getFullYear() + 2);
        stockRows.push({ phc_id: phc.id, medicine_id: medicine.id, batch_no: `B${2026}${String(phcIndex + 1).padStart(2, '0')}${String(medicineIndex + 1).padStart(2, '0')}`, quantity: onHand, expiry_date: expiry });
      }
    }
  }
  await prisma.consumptionLog.createMany({ data: consumptionRows });
  await prisma.stock.createMany({ data: stockRows });
  await prisma.warehouseStock.createMany({ data: medicines.map((medicine, index) => ({ warehouse_id: warehouse.id, medicine_id: medicine.id, quantity: 500 + index * 15, expiry_date: new Date(now.getFullYear() + 2, 11, 31) })) });

  console.log(`Seeded ${phcs.length} PHCs, ${medicines.length} medicines, ${consumptionRows.length} consumption logs, ${stockRows.length} batches, and ${users.length} users.`);
  console.log('Demo logins: pharmacist@medisync.demo, officer@medisync.demo, admin@medisync.demo / MediSyncDemo2026!');
}

export async function seedIfEmpty() {
  const recordCounts = await Promise.all([
    prisma.user.count(),
    prisma.pHC.count(),
    prisma.medicine.count(),
    prisma.stock.count(),
    prisma.consumptionLog.count(),
    prisma.alert.count(),
    prisma.transferRequest.count(),
    prisma.districtWarehouse.count(),
    prisma.warehouseStock.count(),
    prisma.auditLog.count(),
    prisma.syncRecord.count(),
  ]);
  if (recordCounts.some(count => count > 0)) return false;
  await seedDatabase();
  return true;
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectExecution) {
  seedDatabase().catch(error => {
    console.error(error);
    process.exitCode = 1;
  }).finally(async () => prisma.$disconnect());
}