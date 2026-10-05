import { execFileSync } from "node:child_process"; import { createHash } from "node:crypto"; import { readFileSync, writeFileSync } from "node:fs";
const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n").filter((x) => x && !["HASH-MANIFEST.txt", "COMMIT.txt"].includes(x));
writeFileSync("HASH-MANIFEST.txt", files.map((f) => createHash("sha256").update(readFileSync(f)).digest("hex") + "  " + f).join("\n") + "\n");
writeFileSync("COMMIT.txt", execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }));
