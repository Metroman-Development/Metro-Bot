const SearchCore = require('./src/core/metro/search/SearchCore.js');

async function runTests() {
    console.log('Running search tests...');

    // Initialize SearchCore
    const searchCore = new SearchCore('station');
    await searchCore.init();

    // Test cases
    const testCases = [
        { query: 'San Pablo L1', expected: 'San Pablo L1' },
        { query: 'san pablo l1', expected: 'San Pablo L1' },
        { query: 'República', expected: 'República' },
        { query: 'republica', expected: 'República' },
        { query: 'U.L.A.', expected: 'U.L.A.' },
        { query: 'u.l.a.', expected: 'U.L.A.' },
    ];

    for (const { query, expected } of testCases) {
        const results = await searchCore.search(query, { needsOneMatch: true });
        const resultName = results && results.length > 0 ? results[0].name : 'Not found';

        if (resultName === expected) {
            console.log(`✅ Test passed for query: "${query}"`);
        } else {
            console.error(`❌ Test failed for query: "${query}"`);
            console.error(`   Expected: "${expected}", but got: "${resultName}"`);
        }
    }

    // Test accessibility data
    const baquedanoResult = await searchCore.search('Baquedano L1', { needsOneMatch: true });
    if (baquedanoResult && baquedanoResult.length > 0 && baquedanoResult[0].metadata.accessibility.details.length > 0) {
        console.log('✅ Accessibility data found for Baquedano L1');
    } else {
        console.error('❌ Accessibility data not found for Baquedano L1');
    }

    console.log('Search tests complete.');
}

runTests();
