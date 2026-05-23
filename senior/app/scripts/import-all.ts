import { importAllSampleFiles, summarizeBatch } from '../src/lib/server/etl/batch.ts';
import { tableCounts } from '../src/lib/server/db/index.ts';
import { getDataQualitySummary } from '../src/lib/server/db/quality.ts';

const result = importAllSampleFiles();
const summary = summarizeBatch(result);

console.log(`Imported ${summary.fileCount} files`);
console.log(
  `Inserted: ${summary.inserted.products} products, ${summary.inserted.prices} prices, ${summary.inserted.sales} sales`
);
console.log('Counts:', tableCounts());
console.log('Quality:', getDataQualitySummary());

if (summary.warnings.length) {
  console.log('\nSample warnings:');
  for (const warning of summary.warnings) {
    console.log(`- ${warning}`);
  }
}

if (result.errors.length) {
  console.error('\nErrors:');
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}
