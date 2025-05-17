let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`\u2713 ${name}`);
  } catch (err) {
    failed++;
    console.error(`\u2717 ${name}`);
    console.error(err.message);
  }
}

global.test = test;
require('./winprobcalc.test');

if (failed > 0) {
  console.error(`${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log('All tests passed');
}
