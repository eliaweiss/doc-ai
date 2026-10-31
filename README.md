# DocAI

Think of DocAI as a free, local, open-source Google Drive optimized for financial documents. It runs on your own computer and keeps your files private. It's built for invoices, receipts, bank statements and transactions.

DocAI uses local AI to extract the data from your documents, organize it in a unified database, and connect the data points into a complete graph of your money flow. 

You can also connect your AI coding assistant over MCP to build custom mini apps and manage your data however your workflow requires.

## Why DocAI?

I built DocAI because I couldn't accept having no idea what was going on with my money.

The data is all there: invoices, receipts, bank transactions. But each one comes in a different format, from a different source, at a different time of the month. Organizing it all in Excel is a full-time job, so most of us give up and hope we can trust the institutions that handle our money.

Then one day you do need to understand your data, and you end up digging through emails, accounts and interfaces that were never built for it. You can waste days answering a simple question like:

- How did I miss a tax payment?
- Did I get paid for this job?
- What is this expense I don't remember making?

And even when nothing is urgent, you want to be able to:

- Ask questions about your financial data
- Create reports
- See where you stand
- Understand your spending

In the age of AI this should be simple. But you still need one place where you can:

- Drop all your documents
- Let AI do the first pass at extracting the data
- Manage it with basic tools: browse, search and reconcile

That's what DocAI is. I built it for myself, but I believe it can help anyone.

Since I started using it, I no longer spend days at the end of every month figuring out where my money went. I never lose track of a payment, and tax time no longer brings surprises.

## How it works

1. **Connect a folder.** Any folder works, including a Google Drive folder synced to your computer.
2. **Data is extracted automatically.** Every document in the folder is recognized (invoice, receipt, bank statement…) and its data is pulled into a structured schema: vendor, date, totals, line items, transactions. DocAI ships with schemas for common documents, and you can create your own.
3. **Work with your data.** Browse & Search in a Drive-like web UI, and match payments to invoices with the built-in reconciliation tool.

## How I use it

I sync a Google Drive folder to a folder on my computer. Whenever I buy something and get a receipt, I take a photo or screenshot and save it to Google Drive; when I get a document, I upload it there too. Google Drive syncs it to my computer, and DocAI extracts the data with AI. (You can use a local model; I prefer OpenRouter.)

Then I connect DocAI to Claude Code over MCP and use it to:

- Organize my data and move documents between folders
- Create reports
- Build a mini app that quickly matches invoices with bank transactions
- Link my income to my tax payments, so I never miss one and can predict the next

## Connect any AI assistant

DocAI is also an MCP server, so I can connect Claude (or another AI assistant) and simply ask it to:

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

Mini apps are a way to stay fully private. Use Claude Code to build a mini app on a few sample documents, then run it on your real documents completely offline, with no data sent to any AI service. 

- Even if privacy isn't your concern, mini apps save tokens on any task you repeat.

## Your folder stays in sync

DocAI's folders are the real folders on your disk, and changes go both ways. Add, move or rename a file in Finder and DocAI follows; create, rename or move a folder or document in DocAI and the files on disk change too. Nothing is ever permanently deleted: when you delete something in DocAI, the files go to a trash folder in DocAI's data directory.

## Which AI reads your documents? You choose

DocAI uses an AI model to recognize your documents and pull out their data. When you first open it, a short setup lets you choose where that model runs:

- **On your own computer.** DocAI downloads and runs [Qwen 3.5 9B](https://huggingface.co/Qwen) for you, or uses it through [Ollama](https://ollama.com) if you already have it. Your documents never leave your computer. The trade-off: it's slower and less precise than the big cloud models, and it needs a strong enough machine (16 GB of memory or more, ideally a recent Mac or a PC with a good graphics card).
- **With an AI provider you already trust.** Use your own API key for OpenAI, Claude, Gemini, OpenRouter or Vercel AI Gateway. It's fast and accurate, and your documents are sent only to the provider you choose.

You can switch at any time in **Settings → Processing**. See [Setting up DocAI](docs/setup-wizard.md) for a step-by-step walkthrough with screenshots.

## Getting started

You need [Node.js](https://nodejs.org).

```bash
npm install
npm start
```

Then open http://localhost:4310. The setup asks for the folder with your documents and how the AI should run; [Setting up DocAI](docs/setup-wizard.md) walks you through it.

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
