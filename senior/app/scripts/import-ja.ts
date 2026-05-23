import { importVendorFolder } from '../src/lib/server/etl/batch.ts';
import { tableCounts } from '../src/lib/server/db/index.ts';

const result = importVendorFolder('J&A-grocers');

for (const file of result.files) {
  console.log(
    `${file.filename}: ${file.fileKind} — inserted ${file.inserted}, updated ${file.updated}, skipped ${file.skipped}`
  );
  if (file.warnings.length) {
    for (const warning of file.warnings) {
      console.log(`  warn: ${warning}`);
    }
  }
}

console.log('\nCounts:', tableCounts());
