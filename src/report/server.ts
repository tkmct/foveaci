import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";

interface ServeReportOptions {
  dir: string;
  host: string;
  port: number;
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

function safeResolve(rootDir: string, requestPath: string): string | null {
  const resolved = path.resolve(rootDir, `.${requestPath}`);
  if (resolved === rootDir || resolved.startsWith(`${rootDir}${path.sep}`)) {
    return resolved;
  }
  return null;
}

export async function serveReport(options: ServeReportOptions): Promise<http.Server> {
  const rootDir = path.resolve(options.dir);
  if (!fs.existsSync(rootDir)) {
    throw new Error(`Directory not found: ${rootDir}`);
  }
  if (!fs.statSync(rootDir).isDirectory()) {
    throw new Error(`Not a directory: ${rootDir}`);
  }

  const server = http.createServer((req, res) => {
    const requestUrl = req.url || "/";
    const pathname = decodeURIComponent(requestUrl.split("?")[0] || "/");
    const normalizedPath = pathname === "/" ? "/index.html" : pathname;

    const safePath = safeResolve(rootDir, normalizedPath);
    if (!safePath) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }

    let filePath = safePath;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    res.setHeader("Content-Type", getContentType(filePath));
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      res.statusCode = 500;
      res.end("Internal Server Error");
    });
    stream.pipe(res);
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(options.port, options.host, () => resolve());
    server.once("error", (err) => reject(err));
  });

  return server;
}

