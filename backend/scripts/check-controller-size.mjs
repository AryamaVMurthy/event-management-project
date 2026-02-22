import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const controllersRoot = path.resolve(__dirname, "../controllers");

const parseMax = () => {
  const maxFlag = process.argv.find((arg) => arg.startsWith("--max="));
  if (maxFlag) {
    const parsed = Number(maxFlag.split("=")[1]);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error("Invalid --max value. Use a positive integer.");
    }
    return parsed;
  }

  const maxIndex = process.argv.indexOf("--max");
  if (maxIndex >= 0) {
    const parsed = Number(process.argv[maxIndex + 1]);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error("Invalid --max value. Use a positive integer.");
    }
    return parsed;
  }

  return 240;
};

const listJsFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
};

const countLines = (filePath) => {
  const text = fs.readFileSync(filePath, "utf8");
  if (!text) return 0;
  return text.split(/\r?\n/).length;
};

const main = () => {
  const maxLines = parseMax();
  const jsFiles = listJsFiles(controllersRoot);

  const rows = jsFiles
    .map((filePath) => ({
      filePath,
      relPath: path.relative(path.resolve(__dirname, ".."), filePath),
      lines: countLines(filePath),
    }))
    .sort((a, b) => b.lines - a.lines);

  console.log(`Controller file size report (max: ${maxLines})`);
  for (const row of rows) {
    console.log(`${String(row.lines).padStart(4, " ")}  ${row.relPath}`);
  }

  const oversized = rows.filter((row) => row.lines > maxLines);
  if (oversized.length > 0) {
    console.error("\nOversized controller files detected:");
    for (const row of oversized) {
      console.error(`- ${row.relPath} (${row.lines} lines)`);
    }
    process.exit(1);
  }

  console.log("\nAll controller files are within the configured size limit.");
};

try {
  main();
} catch (err) {
  console.error(`Controller size check failed: ${err.message}`);
  process.exit(1);
}
