import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createCanvas, CanvasError, joinSession } from "@github/copilot-sdk/extension";
import { createDefaultState, mergeState, renderHtml, summarizeState } from "./renderer.mjs";

const servers = new Map();
let session;

function safeDocumentId(value) {
    return String(value || "starter-harness")
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "starter-harness";
}

function statePath(documentId) {
    const root = session?.workspacePath || process.cwd();
    return join(root, ".agent-harness-studio", `${safeDocumentId(documentId)}.json`);
}

async function readState(documentId, repository) {
    const path = statePath(documentId);
    try {
        return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
        if (error?.code !== "ENOENT") throw error;
        const state = createDefaultState(repository);
        await saveState(documentId, state);
        return state;
    }
}

async function saveState(documentId, state) {
    const path = statePath(documentId);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function sendJson(res, status, body) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
}

async function readJson(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    return raw ? JSON.parse(raw) : {};
}

function broadcast(entry, state) {
    const payload = `data: ${JSON.stringify(state)}\n\n`;
    for (const client of entry.clients) client.write(payload);
}

async function startServer(instanceId, documentId, repository) {
    const entry = { server: null, url: null, clients: new Set(), documentId, repository };
    const server = createServer(async (req, res) => {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        try {
            if (req.method === "GET" && url.pathname === "/") {
                const state = await readState(entry.documentId, entry.repository);
                res.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": "no-store",
                    "Content-Security-Policy": "default-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:;",
                });
                res.end(renderHtml(state));
                return;
            }

            if (req.method === "GET" && url.pathname === "/api/state") {
                sendJson(res, 200, await readState(entry.documentId, entry.repository));
                return;
            }

            if (req.method === "POST" && url.pathname === "/api/state") {
                const current = await readState(entry.documentId, entry.repository);
                const next = mergeState(current, await readJson(req));
                await saveState(entry.documentId, next);
                broadcast(entry, next);
                sendJson(res, 200, next);
                return;
            }

            if (req.method === "POST" && url.pathname === "/api/reset") {
                const next = createDefaultState(entry.repository);
                await saveState(entry.documentId, next);
                broadcast(entry, next);
                sendJson(res, 200, next);
                return;
            }

            if (req.method === "GET" && url.pathname === "/events") {
                res.writeHead(200, {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                });
                res.write(": connected\n\n");
                entry.clients.add(res);
                req.on("close", () => entry.clients.delete(res));
                return;
            }

            sendJson(res, 404, { error: "Not found" });
        } catch (error) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
    });

    entry.server = server;
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    entry.url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/`;
    return entry;
}

async function updateStage(ctx) {
    const entry = servers.get(ctx.instanceId);
    if (!entry) throw new CanvasError("instance_not_open", "Open the Agent Harness Studio canvas first.");

    const current = await readState(entry.documentId, entry.repository);
    const stage = current.stages.find((item) => item.id === ctx.input.stageId);
    if (!stage) throw new CanvasError("stage_not_found", `Unknown stage: ${ctx.input.stageId}`);

    const next = mergeState(current, {
        stages: current.stages.map((item) =>
            item.id === ctx.input.stageId
                ? { ...item, status: ctx.input.status, owner: ctx.input.owner ?? item.owner }
                : item,
        ),
    });
    await saveState(entry.documentId, next);
    broadcast(entry, next);
    return summarizeState(next);
}

session = await joinSession({
    canvases: [
        createCanvas({
            id: "agent-harness-studio",
            displayName: "Agent Harness Studio",
            description: "Design, assess, and configure a beautiful gated agent-team workflow for a repository.",
            inputSchema: {
                type: "object",
                properties: {
                    repository: {
                        type: "string",
                        description: "Repository name, for example github/copilot-app.",
                    },
                    documentId: {
                        type: "string",
                        description: "Stable ID for the harness artifact.",
                    },
                },
                additionalProperties: false,
            },
            actions: [
                {
                    name: "summarize_harness",
                    description: "Return the current readiness score, configured gates, and remaining gaps.",
                    handler: async (ctx) => {
                        const entry = servers.get(ctx.instanceId);
                        if (!entry) throw new CanvasError("instance_not_open", "Open the canvas first.");
                        return summarizeState(await readState(entry.documentId, entry.repository));
                    },
                },
                {
                    name: "update_stage",
                    description: "Update one workflow stage after repository configuration changes.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            stageId: { type: "string" },
                            status: { type: "string", enum: ["ready", "partial", "missing"] },
                            owner: { type: "string" },
                        },
                        required: ["stageId", "status"],
                        additionalProperties: false,
                    },
                    handler: updateStage,
                },
                {
                    name: "reset_harness",
                    description: "Reset the current harness to the starter blueprint.",
                    handler: async (ctx) => {
                        const entry = servers.get(ctx.instanceId);
                        if (!entry) throw new CanvasError("instance_not_open", "Open the canvas first.");
                        const next = createDefaultState(entry.repository);
                        await saveState(entry.documentId, next);
                        broadcast(entry, next);
                        return summarizeState(next);
                    },
                },
            ],
            open: async (ctx) => {
                const repository = ctx.input?.repository || "Your next repository";
                const documentId = ctx.input?.documentId || repository;
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(ctx.instanceId, documentId, repository);
                    servers.set(ctx.instanceId, entry);
                }
                return {
                    title: `Agent Harness · ${repository}`,
                    status: "Design your team",
                    url: entry.url,
                };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (!entry) return;
                servers.delete(ctx.instanceId);
                for (const client of entry.clients) client.end();
                await new Promise((resolve) => entry.server.close(resolve));
            },
        }),
    ],
});
