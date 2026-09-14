/**
 * MUHAR STUDIO — Admin CLI Viewer for Inquiries
 * Run: `node view-inquiries.js` or `npm run inquiries`
 */

const db = require('./src/db');

async function viewInquiries() {
  const inquiries = await db.getInquiries({ limit: 100 });

  console.log('\n========================================================================================');
  console.log('🏛️  MUHAR STUDIO — CLIENT INQUIRIES & CONSULTATION REQUESTS');
  console.log(`💾 Database: ${require('./src/config').databasePath}`);
  console.log(`📋 Total Inquiries: ${inquiries.length}`);
  console.log('========================================================================================\n');

  if (inquiries.length === 0) {
    console.log('No inquiries found in database yet.\n');
    return;
  }

  inquiries.forEach((inq, idx) => {
    console.log(`[#${inq.id}] ${inq.type.toUpperCase()} REQUEST — ${inq.created_at}`);
    console.log(`  • Client:    ${inq.name}`);
    console.log(`  • Email:     ${inq.email}`);
    if (inq.phone) console.log(`  • Phone:     ${inq.phone}`);
    if (inq.project_type) console.log(`  • Project:   ${inq.project_type}`);
    if (inq.budget) console.log(`  • Budget:    ${inq.budget}`);
    console.log(`  • Status:    ${inq.status} (Email Notification Sent: ${inq.email_sent ? 'Yes' : 'Simulation Mode / Pending'})`);
    console.log(`  • IP:        ${inq.ip_address || 'N/A'}`);
    console.log(`  • Message:   "${inq.message}"`);
    console.log('----------------------------------------------------------------------------------------');
  });
}

viewInquiries();
