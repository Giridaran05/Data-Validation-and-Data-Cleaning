import express from 'express';
import { createServer as createHttpServer } from 'http';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  // AI Studio Dev server must strictly listen on port 3000 (nginx listens on 8080)
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '20mb' }));

  // Helper to read CSV into JSON array
  function parseCSV(filePath: string): any[] {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(cur.replace(/^"|"$/g, '').trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.replace(/^"|"$/g, '').trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] ?? '';
      });
      records.push(obj);
    }
    return records;
  }

  // --- API Endpoints ---

  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Get Summary Metrics
  app.get('/api/dataset/summary', (req, res) => {
    const summaryPath = path.join(__dirname, 'data', 'engine_summary.json');
    if (fs.existsSync(summaryPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
        return res.json(data);
      } catch (err: any) {
        return res.status(500).json({ error: 'Failed to read engine summary' });
      }
    }
    res.json({
      total_records: 0,
      valid_records: 0,
      quarantined_records: 0,
      duplicate_records: 0,
      pass_rate_pct: 0,
      quarantine_rate_pct: 0,
      execution_time_ms: 0,
    });
  });

  // Get Raw Dataset
  app.get('/api/dataset/raw', (req, res) => {
    const rawPath = path.join(__dirname, 'data', 'orders_raw.csv');
    const records = parseCSV(rawPath);
    res.json({ records, count: records.length });
  });

  // Get Cleaned Dataset (Deliverable 2)
  app.get('/api/dataset/cleaned', (req, res) => {
    const cleanPath = path.join(__dirname, 'data', 'cleaned_orders.csv');
    const records = parseCSV(cleanPath);
    res.json({ records, count: records.length });
  });

  // Get Exception Register (Deliverable 3)
  app.get('/api/dataset/exceptions', (req, res) => {
    const excPath = path.join(__dirname, 'data', 'exception_register.csv');
    const records = parseCSV(excPath);
    res.json({ records, count: records.length });
  });

  // Get Rules Config
  app.get('/api/rules', (req, res) => {
    const rulesPath = path.join(__dirname, 'data', 'rules_config.json');
    if (fs.existsSync(rulesPath)) {
      try {
        const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
        return res.json(rules);
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }
    res.status(404).json({ error: 'Rules file not found' });
  });

  // Save Rules Config
  app.post('/api/rules', (req, res) => {
    const rulesPath = path.join(__dirname, 'data', 'rules_config.json');
    try {
      const updatedRules = req.body;
      fs.writeFileSync(rulesPath, JSON.stringify(updatedRules, null, 2), 'utf-8');
      res.json({ success: true, message: 'Rules configuration saved successfully' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Execute Validation Pipeline via Python CLI
  app.post('/api/run-validation', (req, res) => {
    const cmd = 'python3 main.py -v';
    exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
      const summaryPath = path.join(__dirname, 'data', 'engine_summary.json');
      let summary = null;
      if (fs.existsSync(summaryPath)) {
        try {
          summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
        } catch (_) {}
      }

      res.json({
        success: !error,
        exitCode: error ? error.code : 0,
        stdout,
        stderr,
        summary,
      });
    });
  });

  // Generate Synthetic Dataset and Validate
  app.post('/api/generate-dataset', (req, res) => {
    const records = Math.min(Math.max(parseInt(req.body.records || '100', 10), 20), 500);
    const cmd = `python3 main.py --generate --records ${records} -v`;
    exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
      const summaryPath = path.join(__dirname, 'data', 'engine_summary.json');
      let summary = null;
      if (fs.existsSync(summaryPath)) {
        try {
          summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
        } catch (_) {}
      }

      res.json({
        success: !error,
        exitCode: error ? error.code : 0,
        stdout,
        stderr,
        summary,
        recordsGenerated: records,
      });
    });
  });

  // Get Available Sample Datasets
  app.get('/api/sample-datasets', (req, res) => {
    const samples = [
      {
        id: 'orders',
        name: 'Enterprise Orders Dataset',
        domain: 'Order / E-Commerce Data',
        filename: 'orders_raw.csv',
        description: '100 rows with 15 injected test anomalies (math fraud, missing emails, invalid SKUs)',
        recordCount: 100,
        path: path.join(__dirname, 'data', 'orders_raw.csv'),
      },
      {
        id: 'students',
        name: 'College / University Student Data',
        domain: 'College / Student Data',
        filename: 'sample_students.csv',
        description: '8 student records with leading zeros (00101), whitespace names, invalid emails & phones',
        recordCount: 8,
        path: path.join(__dirname, 'data', 'sample_students.csv'),
      },
      {
        id: 'products',
        name: 'Product & Inventory Data',
        domain: 'Product Inventory Data',
        filename: 'sample_products.csv',
        description: '8 product rows with currency symbols ($), negative stock (-15), and negative prices',
        recordCount: 8,
        path: path.join(__dirname, 'data', 'sample_products.csv'),
      },
      {
        id: 'employees',
        name: 'Employee / HR Management Data',
        domain: 'Employee / HR Data',
        filename: 'sample_employees.csv',
        description: '7 employee records with mixed date formats, salary currencies, and unformatted names',
        recordCount: 7,
        path: path.join(__dirname, 'data', 'sample_employees.csv'),
      },
      {
        id: 'healthcare',
        name: 'Hospital / Patient Healthcare Data',
        domain: 'Hospital / Healthcare Data',
        filename: 'sample_healthcare.csv',
        description: '6 patient admission records with blood groups, negative ages, and missing IDs',
        recordCount: 6,
        path: path.join(__dirname, 'data', 'sample_healthcare.csv'),
      },
    ];

    res.json(samples);
  });

  // Load a Specific Sample Dataset Content
  app.get('/api/sample-datasets/:id', (req, res) => {
    const id = req.params.id;
    const fileMap: Record<string, string> = {
      orders: path.join(__dirname, 'data', 'orders_raw.csv'),
      students: path.join(__dirname, 'data', 'sample_students.csv'),
      products: path.join(__dirname, 'data', 'sample_products.csv'),
      employees: path.join(__dirname, 'data', 'sample_employees.csv'),
      healthcare: path.join(__dirname, 'data', 'sample_healthcare.csv'),
    };

    const filePath = fileMap[id] || fileMap.orders;
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const records = parseCSV(filePath);
      return res.json({ id, content, records, count: records.length });
    }
    res.status(404).json({ error: 'Sample dataset not found' });
  });

  // Intelligent CSV Dataset Profiling & Recommendations Endpoint
  app.post('/api/profile-dataset', (req, res) => {
    const { csvContent } = req.body;
    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'csvContent string is required' });
    }

    const tempDir = path.join(__dirname, 'data', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempInput = path.join(tempDir, `profile_input_${Date.now()}.csv`);

    try {
      fs.writeFileSync(tempInput, csvContent.trim(), 'utf-8');
      const cmd = `python3 python_engine/universal_cli.py --input "${tempInput}" --action profile`;

      exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
        if (fs.existsSync(tempInput)) try { fs.unlinkSync(tempInput); } catch (_) {}

        if (error) {
          return res.status(500).json({ error: error.message, stderr });
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          res.json(parsed);
        } catch (parseErr: any) {
          res.status(500).json({ error: 'Failed to parse profiler output', stdout, stderr });
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Universal Ingestion, Dynamic Cleaning & Validation Execution Endpoint
  app.post('/api/universal-clean', (req, res) => {
    const { csvContent, enabledRules } = req.body;
    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'csvContent string is required' });
    }

    const tempDir = path.join(__dirname, 'data', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const timeId = Date.now();
    const tempInput = path.join(tempDir, `univ_input_${timeId}.csv`);
    const tempClean = path.join(tempDir, `univ_clean_${timeId}.csv`);
    const tempExceptions = path.join(tempDir, `univ_exc_${timeId}.csv`);
    const tempSummary = path.join(tempDir, `univ_summary_${timeId}.json`);
    const tempRules = path.join(tempDir, `univ_rules_${timeId}.json`);

    try {
      fs.writeFileSync(tempInput, csvContent.trim(), 'utf-8');
      if (enabledRules) {
        fs.writeFileSync(tempRules, JSON.stringify(enabledRules), 'utf-8');
      }

      const rulesArg = enabledRules ? `--rules "${tempRules}"` : '';
      const cmd = `python3 python_engine/universal_cli.py --input "${tempInput}" --action process ${rulesArg} --output-clean "${tempClean}" --output-exceptions "${tempExceptions}" --summary-json "${tempSummary}"`;

      exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
        let summaryData = null;
        if (fs.existsSync(tempSummary)) {
          try {
            summaryData = JSON.parse(fs.readFileSync(tempSummary, 'utf-8'));
          } catch (_) {}
        }

        const cleanedRecords = parseCSV(tempClean);
        const exceptionRecords = parseCSV(tempExceptions);

        // Clean up temp files
        [tempInput, tempClean, tempExceptions, tempSummary, tempRules].forEach(f => {
          if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch (_) {}
        });

        res.json({
          success: !error,
          stdout,
          stderr,
          summary: summaryData?.summary || null,
          profile: summaryData?.profile || null,
          cleanedRecords,
          exceptionRecords,
          error: error ? error.message : null,
        });
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Custom Ingestion & Validation Playground (Maintained for legacy compatibility)
  app.post('/api/validate-custom', (req, res) => {
    const { csvContent } = req.body;
    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'csvContent string is required' });
    }

    const tempDir = path.join(__dirname, 'data', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempInput = path.join(tempDir, `custom_input_${Date.now()}.csv`);
    const tempClean = path.join(tempDir, `custom_clean_${Date.now()}.csv`);
    const tempExceptions = path.join(tempDir, `custom_exc_${Date.now()}.csv`);
    const tempSummary = path.join(tempDir, `custom_summary_${Date.now()}.json`);

    try {
      fs.writeFileSync(tempInput, csvContent.trim(), 'utf-8');
      const cmd = `python3 python_engine/universal_cli.py --input "${tempInput}" --action process --output-clean "${tempClean}" --output-exceptions "${tempExceptions}" --summary-json "${tempSummary}"`;

      exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
        let summaryData = null;
        if (fs.existsSync(tempSummary)) {
          try {
            summaryData = JSON.parse(fs.readFileSync(tempSummary, 'utf-8'));
          } catch (_) {}
        }
        const cleanedRecords = parseCSV(tempClean);
        const exceptionRecords = parseCSV(tempExceptions);

        // Clean up temp files
        [tempInput, tempClean, tempExceptions, tempSummary].forEach(f => {
          if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch (_) {}
        });

        res.json({
          success: !error,
          stdout,
          stderr,
          summary: summaryData?.summary || null,
          profile: summaryData?.profile || null,
          cleanedRecords,
          exceptionRecords,
          error: error ? error.message : null,
        });
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Run Test Suite with structured output parsing
  app.post('/api/run-tests', (req, res) => {
    const cmd = 'python3 -m unittest discover tests/ -v';
    exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
      const fullOutput = (stdout + '\n' + stderr).trim();
      const passed = !error;

      // Parse individual test methods from verbose unittest output
      // Format: "test_name (module.Class) ... ok" or "FAIL" or "ERROR"
      const testLines = fullOutput.split('\n');
      const testCases: Array<{ name: string; suite: string; status: 'ok' | 'fail' | 'error'; errorDetail?: string }> = [];

      testLines.forEach(line => {
        const match = line.match(/^(\w+)\s+\(([^)]+)\)\s+\.\.\.\s+(ok|FAIL|ERROR)/i);
        if (match) {
          testCases.push({
            name: match[1],
            suite: match[2],
            status: match[3].toLowerCase() as any,
          });
        }
      });

      res.json({
        success: passed,
        output: fullOutput,
        exitCode: error ? error.code : 0,
        testCases,
        totalTests: testCases.length,
        passedCount: testCases.filter(t => t.status === 'ok').length,
        failedCount: testCases.filter(t => t.status !== 'ok').length,
      });
    });
  });

  // Get Code Modules for Inspector
  app.get('/api/modules', (req, res) => {
    const modules = [
      {
        id: 'models',
        name: 'models.py',
        path: 'python_engine/models.py',
        role: 'Data Structures & Enums',
        description: 'Dataclasses for FieldRule, BusinessRule, ExceptionRecord, and EngineSummary.',
      },
      {
        id: 'exceptions',
        name: 'exceptions.py',
        path: 'python_engine/exceptions.py',
        role: 'Error Hierarchy',
        description: 'Domain-specific exceptions providing structured metadata and row context.',
      },
      {
        id: 'logger',
        name: 'logger.py',
        path: 'python_engine/logger.py',
        role: 'Structured Logging',
        description: 'Standard library logging with formatting and in-memory buffer handler.',
      },
      {
        id: 'cleaner',
        name: 'cleaner.py',
        path: 'python_engine/cleaner.py',
        role: 'Data Sanitization',
        description: 'Whitespace stripping, casing standardization, symbol sanitization, and date formatting.',
      },
      {
        id: 'validators',
        name: 'validators.py',
        path: 'python_engine/validators.py',
        role: 'Validation Checks',
        description: 'Reusable type checking, regex verification, range checks, and cross-field math rules.',
      },
      {
        id: 'engine',
        name: 'engine.py',
        path: 'python_engine/engine.py',
        role: 'Pipeline Orchestrator',
        description: 'Coordinates schema verification, deduplication, row-by-row cleaning, and quarantine partitioning.',
      },
      {
        id: 'generator',
        name: 'dataset_generator.py',
        path: 'python_engine/dataset_generator.py',
        role: 'Synthetic Test Vector Generator',
        description: 'Generates realistic transactional records with injected real-world anomalies.',
      },
      {
        id: 'cli',
        name: 'cli.py',
        path: 'python_engine/cli.py',
        role: 'CLI Runner',
        description: 'Argparse interface for terminal execution and batch automation.',
      },
      {
        id: 'test_engine',
        name: 'test_engine_integration.py',
        path: 'tests/test_engine_integration.py',
        role: 'Integration Test Suite',
        description: 'End-to-end integration tests verifying zero regressions on synthetic data.',
      },
    ];

    const result = modules.map(m => {
      const fullPath = path.join(__dirname, m.path);
      const code = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '# File not found';
      return { ...m, code };
    });

    res.json(result);
  });

  // Get Data Dictionary Content
  app.get('/api/data-dictionary', (req, res) => {
    const docPath = path.join(__dirname, 'docs', 'data_dictionary.md');
    if (fs.existsSync(docPath)) {
      return res.send(fs.readFileSync(docPath, 'utf-8'));
    }
    res.status(404).send('Data dictionary not found');
  });

  const httpServer = createHttpServer(app);

  // Mount Vite in Dev or Serve Static Dist in Prod
  if (!isProd) {
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, 'vite.config.ts'),
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[DIT Engine Server] Ready at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[DIT Engine Server] Startup failed:', err);
  process.exit(1);
});
