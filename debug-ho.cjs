// Debug: check patient_assignments for Obetta via local API server
const fs = require('fs');
const jwt = require('jsonwebtoken');

const envFile = fs.readFileSync('.env.local', 'utf8');
const jwtMatch = envFile.match(/JWT_SECRET=["']?([^\n"']+)/);
const JWT_SECRET = jwtMatch ? jwtMatch[1].trim() : 'secret';
const token = jwt.sign({ id: 1, role: 'admin', username: 'admin' }, JWT_SECRET);
const BASE = 'http://localhost:3005';

async function main() {
  const listRes = await fetch(`${BASE}/api/ho-tracking?action=all-house-officers`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const listData = await listRes.json();
  const obetta = listData.houseOfficers?.find(ho => ho.full_name?.toLowerCase().includes('obetta'));
  if (!obetta) { console.log('Obetta not found'); return; }
  console.log('Found:', obetta.id, obetta.full_name);
  console.log('patientEntries:', obetta.metrics?.patientEntries, 'totalDocumentation:', obetta.metrics?.totalDocumentation);
  console.log('assignedPatients metric:', obetta.metrics?.assignedPatients);

  console.log('\nFetching detail...');
  const detailRes = await fetch(`${BASE}/api/ho-tracking?action=ho-detail&userId=${obetta.id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const detail = await detailRes.json();
  if (detail.error) { console.log('Error:', detail.error); return; }

  console.log('assignedPatients:', detail.assignedPatients?.length || 0);
  console.log('documentedPatients:', detail.documentedPatients?.length || 0);
  if (detail.documentedPatients?.length > 0) {
    detail.documentedPatients.slice(0,5).forEach(p =>
      console.log('  ', p.first_name, p.last_name, '-', p.documentation_types, `(${p.total_docs} docs)`)
    );
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
