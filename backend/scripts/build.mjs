import ts from "typescript";

const configPath = ts.findConfigFile(
  "./",
  ts.sys.fileExists,
  "tsconfig.json"
);

if (!configPath) {
  throw new Error("tsconfig.json not found");
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

if (configFile.error) {
  const message = ts.flattenDiagnosticMessageText(
    configFile.error.messageText,
    "\n"
  );
  throw new Error(message);
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
  process.exit(1);
}

console.log("TypeScript build completed successfully.");
