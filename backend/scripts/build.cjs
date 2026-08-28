const ts = require("typescript");

const configPath = ts.findConfigFile(
  "./",
  ts.sys.fileExists,
  "tsconfig.json"
);

if (!configPath) {
  console.error("tsconfig.json not found");
  process.exit(1);
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

if (configFile.error) {
  console.error(
    ts.flattenDiagnosticMessageText(
      configFile.error.messageText,
      "\n"
    )
  );
  process.exit(1);
}

const parsed = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  "./"
);

const program = ts.createProgram(
  parsed.fileNames,
  parsed.options
);

const diagnostics = ts.getPreEmitDiagnostics(program);

if (diagnostics.length > 0) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(
      diagnostics,
      {
        getCurrentDirectory: () => process.cwd(),
        getCanonicalFileName: fileName => fileName,
        getNewLine: () => "\n"
      }
    )
  );

  process.exit(1);
}

const result = program.emit();

if (result.emitSkipped) {
  console.error("TypeScript build failed.");
  process.exit(1);
}

console.log("TypeScript build completed successfully.");
