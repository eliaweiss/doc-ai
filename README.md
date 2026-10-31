# DocAI

Think of DocAI as Google Drive for your financial documents, except it runs on your own computer, keeps your files private and is open source. It's built for invoices, receipts, bank statements and transactions.

## How it works

1. **Connect a folder.** Any folder works, including a Google Drive folder synced to your computer.
2. **Data is extracted automatically.** Every document in the folder is recognized (invoice, receipt, bank statement…) and its data is pulled into a structured schema: vendor, date, totals, line items, transactions. DocAI ships with schemas for common documents, and you can create your own.
3. **Work with your data.** Browse & Search in a Drive-like web UI, and match payments to invoices with the built-in reconciliation tool.

## Even better: connect an AI assistant

DocAI is also an MCP server, so you can connect Claude (or another AI assistant) and simply ask it to:

- Sort your documents
- Arrange them in folders
- Search them ("how much did I spend on software in March?")
- Reconcile payments with invoices
- Build custom mini apps

## Mini apps: no AI needed to run them

A mini app is a custom tool built on top of your data, such as a monthly expense report, a VAT summary or a vendor dashboard. The AI helps you *build* it once; after that, it runs on its own without calling an AI model. That makes mini apps:

- **Faster**: no waiting for a model to answer
- **Deterministic**: the same input always gives the same result
- **Cheaper**: no tokens spent each time you run them
- **Private**: no data is sent to the cloud

Mini apps are a way to stay fully private. Use Claude Code to build a mini app on a few sample documents, then run it on your real documents completely offline, with no data sent to any AI service. Even if privacy isn't your concern, mini apps save tokens on any task you repeat.

## Your folder stays in sync

DocAI's folders are the real folders on your disk, and changes go both ways. Add, move or rename a file in Finder and DocAI follows; create, rename or move a folder or document in DocAI and the files on disk change too. Nothing is ever permanently deleted: when you delete something in DocAI, the files go to a trash folder in DocAI's data directory.

## Getting started

You need [Node.js](https://nodejs.org) and an API key for the AI model ([Vercel AI Gateway](https://vercel.com/ai-gateway)), or a local model through [Ollama](https://ollama.com).

```bash
npm install
cp .env.example .env   # set the folder to watch and your API key
npm start
```

Then open http://localhost:4310. You can change the folder, the AI model and the key at any time under **Settings → Processing**.

Everything runs on your computer. DocAI is only reachable from your own machine and has no login.

## Connecting Claude

**Claude Code:** install the DocAI plugin, which connects Claude to DocAI and teaches it how to use it:

```
/plugin marketplace add eliaweiss/doc-ai
/plugin install doc-ai@doc-ai
```

**Claude Desktop** and other AI apps: add DocAI as an MCP server at `http://localhost:4310/mcp`. For Claude Desktop:

```json
{
  "mcpServers": {
    "doc-ai": { "command": "npx", "args": ["-y", "mcp-remote", "http://localhost:4310/mcp"] }
  }
}
```

Then just ask, for example: "which invoices from last quarter are still unpaid?", "move all 2024 invoices from Acme into a folder called Acme" or "build me a mini app that shows monthly spending by vendor".
