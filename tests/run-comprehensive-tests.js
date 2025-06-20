/**
 * Comprehensive Test Runner
 * Runs all optimization tests and generates detailed reports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ComprehensiveTestRunner {
  constructor() {
    this.testResults = {
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      },
      suites: {},
      coverage: {},
      performance: {},
      errors: []
    };
    
    this.testSuites = [
      'security.test.js',
      'advanced-features.test.js',
      'enhanced-ensemble.test.js',
      'memory.test.js',
      'tier-system.test.js',
      'workout.test.js',
      'health.test.js'
    ];
  }

  /**
   * Run all test suites
   */
  async runAllTests() {
    console.log('🚀 Starting comprehensive optimization tests...\n');
    
    const startTime = Date.now();
    
    try {
      // Set test environment
      process.env.NODE_ENV = 'test';
      
      // Run each test suite
      for (const suite of this.testSuites) {
        await this.runTestSuite(suite);
      }
      
      // Calculate total duration
      this.testResults.summary.duration = Date.now() - startTime;
      
      // Generate reports
      await this.generateReports();
      
      // Display summary
      this.displaySummary();
      
    } catch (error) {
      console.error('❌ Test runner failed:', error.message);
      this.testResults.errors.push({
        type: 'runner_error',
        message: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Run individual test suite
   */
  async runTestSuite(suiteName) {
    console.log(`📋 Running ${suiteName}...`);
    
    const suiteStartTime = Date.now();
    
    try {
      // Check if test file exists
      const testPath = path.join(__dirname, suiteName);
      if (!fs.existsSync(testPath)) {
        console.log(`⚠️  Test file ${suiteName} not found, skipping...`);
        return;
      }

      // Run Jest for specific test file
      const command = `npx jest ${suiteName} --json --coverage --verbose`;
      const output = execSync(command, { 
        cwd: path.dirname(__dirname),
        encoding: 'utf8',
        timeout: 300000 // 5 minutes timeout
      });
      
      // Parse Jest output
      const result = JSON.parse(output);
      
      // Store results
      this.testResults.suites[suiteName] = {
        numTotalTests: result.numTotalTests || 0,
        numPassedTests: result.numPassedTests || 0,
        numFailedTests: result.numFailedTests || 0,
        numPendingTests: result.numPendingTests || 0,
        duration: Date.now() - suiteStartTime,
        testResults: result.testResults || [],
        success: result.success || false
      };
      
      // Update summary
      this.testResults.summary.totalTests += result.numTotalTests || 0;
      this.testResults.summary.passed += result.numPassedTests || 0;
      this.testResults.summary.failed += result.numFailedTests || 0;
      this.testResults.summary.skipped += result.numPendingTests || 0;
      
      // Store coverage if available
      if (result.coverageMap) {
        this.testResults.coverage[suiteName] = result.coverageMap;
      }
      
      console.log(`✅ ${suiteName} completed: ${result.numPassedTests}/${result.numTotalTests} passed`);
      
    } catch (error) {
      console.log(`❌ ${suiteName} failed: ${error.message}`);
      
      this.testResults.suites[suiteName] = {
        numTotalTests: 0,
        numPassedTests: 0,
        numFailedTests: 1,
        numPendingTests: 0,
        duration: Date.now() - suiteStartTime,
        success: false,
        error: error.message
      };
      
      this.testResults.summary.failed += 1;
      this.testResults.errors.push({
        suite: suiteName,
        type: 'suite_error',
        message: error.message
      });
    }
  }

  /**
   * Run performance benchmarks
   */
  async runPerformanceBenchmarks() {
    console.log('⚡ Running performance benchmarks...');
    
    const benchmarks = [
      {
        name: 'Ensemble Response Time',
        test: async () => {
          const start = Date.now();
          // Simulate ensemble request
          await new Promise(resolve => setTimeout(resolve, 100));
          return Date.now() - start;
        },
        threshold: 5000 // 5 seconds
      },
      {
        name: 'Memory Retrieval Speed',
        test: async () => {
          const start = Date.now();
          // Simulate memory retrieval
          await new Promise(resolve => setTimeout(resolve, 50));
          return Date.now() - start;
        },
        threshold: 1000 // 1 second
      },
      {
        name: 'Cache Hit Rate',
        test: async () => {
          // Simulate cache operations
          return Math.random() * 100; // Mock hit rate percentage
        },
        threshold: 80 // 80% hit rate
      }
    ];
    
    for (const benchmark of benchmarks) {
      try {
        const result = await benchmark.test();
        const passed = result <= benchmark.threshold;
        
        this.testResults.performance[benchmark.name] = {
          result,
          threshold: benchmark.threshold,
          passed,
          unit: benchmark.name.includes('Rate') ? '%' : 'ms'
        };
        
        console.log(`${passed ? '✅' : '❌'} ${benchmark.name}: ${result}${benchmark.name.includes('Rate') ? '%' : 'ms'}`);
        
      } catch (error) {
        this.testResults.performance[benchmark.name] = {
          error: error.message,
          passed: false
        };
      }
    }
  }

  /**
   * Generate test reports
   */
  async generateReports() {
    console.log('📊 Generating test reports...');
    
    // Create reports directory
    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Generate JSON report
    const jsonReport = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      results: this.testResults
    };
    
    fs.writeFileSync(
      path.join(reportsDir, 'test-results.json'),
      JSON.stringify(jsonReport, null, 2)
    );
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    fs.writeFileSync(
      path.join(reportsDir, 'test-report.html'),
      htmlReport
    );
    
    // Generate markdown summary
    const markdownReport = this.generateMarkdownReport();
    fs.writeFileSync(
      path.join(reportsDir, 'test-summary.md'),
      markdownReport
    );
    
    console.log('📁 Reports generated in ./reports/ directory');
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport() {
    const { summary, suites } = this.testResults;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>NeuraStack Optimization Tests Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .suite { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .passed { color: green; }
        .failed { color: red; }
        .skipped { color: orange; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>NeuraStack Backend Optimization Tests</h1>
    
    <div class="summary">
        <h2>Test Summary</h2>
        <p><strong>Total Tests:</strong> ${summary.totalTests}</p>
        <p><strong>Passed:</strong> <span class="passed">${summary.passed}</span></p>
        <p><strong>Failed:</strong> <span class="failed">${summary.failed}</span></p>
        <p><strong>Skipped:</strong> <span class="skipped">${summary.skipped}</span></p>
        <p><strong>Duration:</strong> ${(summary.duration / 1000).toFixed(2)}s</p>
        <p><strong>Success Rate:</strong> ${((summary.passed / summary.totalTests) * 100).toFixed(1)}%</p>
    </div>
    
    <h2>Test Suites</h2>
    ${Object.entries(suites).map(([name, suite]) => `
        <div class="suite">
            <h3>${name}</h3>
            <p>Status: ${suite.success ? '<span class="passed">PASSED</span>' : '<span class="failed">FAILED</span>'}</p>
            <p>Tests: ${suite.numPassedTests}/${suite.numTotalTests} passed</p>
            <p>Duration: ${(suite.duration / 1000).toFixed(2)}s</p>
            ${suite.error ? `<p class="failed">Error: ${suite.error}</p>` : ''}
        </div>
    `).join('')}
    
    <p><em>Generated on ${new Date().toISOString()}</em></p>
</body>
</html>`;
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport() {
    const { summary, suites, performance } = this.testResults;
    
    return `# NeuraStack Backend Optimization Tests

## Summary

- **Total Tests:** ${summary.totalTests}
- **Passed:** ${summary.passed} ✅
- **Failed:** ${summary.failed} ❌
- **Skipped:** ${summary.skipped} ⚠️
- **Duration:** ${(summary.duration / 1000).toFixed(2)}s
- **Success Rate:** ${((summary.passed / summary.totalTests) * 100).toFixed(1)}%

## Test Suites

${Object.entries(suites).map(([name, suite]) => `
### ${name}
- Status: ${suite.success ? '✅ PASSED' : '❌ FAILED'}
- Tests: ${suite.numPassedTests}/${suite.numTotalTests} passed
- Duration: ${(suite.duration / 1000).toFixed(2)}s
${suite.error ? `- Error: ${suite.error}` : ''}
`).join('')}

## Performance Benchmarks

${Object.entries(performance).map(([name, perf]) => `
### ${name}
- Result: ${perf.result}${perf.unit || ''}
- Threshold: ${perf.threshold}${perf.unit || ''}
- Status: ${perf.passed ? '✅ PASSED' : '❌ FAILED'}
`).join('')}

---
*Generated on ${new Date().toISOString()}*
`;
  }

  /**
   * Display summary in console
   */
  displaySummary() {
    const { summary } = this.testResults;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 COMPREHENSIVE TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`📊 Total Tests: ${summary.totalTests}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⚠️  Skipped: ${summary.skipped}`);
    console.log(`⏱️  Duration: ${(summary.duration / 1000).toFixed(2)}s`);
    console.log(`📈 Success Rate: ${((summary.passed / summary.totalTests) * 100).toFixed(1)}%`);
    
    if (summary.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Optimizations are working correctly.');
    } else {
      console.log(`\n⚠️  ${summary.failed} test(s) failed. Check reports for details.`);
    }
    
    console.log('='.repeat(60));
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new ComprehensiveTestRunner();
  runner.runAllTests()
    .then(() => {
      process.exit(runner.testResults.summary.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = ComprehensiveTestRunner;
