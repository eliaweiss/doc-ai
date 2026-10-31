# DocAI

Think of DocAI as a free, local, open-source Google Drive optimized for financial documents. It runs on your own computer and keeps your files private. It's built for invoices, receipts, bank statements and transactions.

DocAI uses local AI to extract the data from your documents, organize it in a unified database, and connect the data points into a complete graph of your money flow. 

You can also connect your AI coding assistant over MCP to build custom mini apps and manage your data however your workflow requires.

## Why DocAI?

The reason I built it is because I couldn't agree with the fact that I have no idea what's going on with my money.
I mean, the data is there. I get all the documents. I get all the invoices, all the receipts, all the bank transactions. But each one is a different format, a different source, a different time of the month. Organizing it into Excel is a full-time job, so most of us just drop it.
And hope that we can trust the institution to manage our money.
But what happen when you do need to understand your data? Then you need to dig through emails and accounts and UI that was never optimized for you to do it. And you can waste days only to answer a simple question such as:
- How come I missed paying tax?
- Or did I got paid for this work?
- Or what is this expense that I don't remember making?
But even if you don't need it urgently, you just want to have the ability to:
- ask questions about your financial data
- create a report
- see your status
- understand your spending
It is obvious that in the age of AI, it should be pretty simple to do this. But you still need a repository where you can easily:
- drop all your documents
- have the AI do the initial extraction of the data
- and some basic tool to manage it such as browse, search, and reconcile.
So, this is what DocAI is all about. I built it primarily for myself, but I believe it can help anyone.

Because since I built it, I no longer need to spend days every end of month to understand what's going on with my money. I never lose tracking a payment. I never get surprised when I pay the tax.

## How do I use it
So, how do I use it? I basically connect a Google Drive folder to a local folder and sync them. Then, as I do my things such as buying stuff and getting receipts, I just take a screenshot and save it to Google Drive, or upload a document to the Google Drive if I get a document. The system automatically sync the Google Drive to my local folder and extract the data using AI (You can use local models, but I personally prefer to use OpenRouter), Then I connect the data using an MCP to my cloud code and use the coder to:
- organize my data
- move between folder
- create report
- and build a mini app that help me quickly match between invoices and bank statement transaction
- and connect my incoming money with my tax payment to make sure that I didn't miss a payment and predict my next payment

## How it works

1. **Connect a folder.** Any folder works, including a Google Drive folder synced to your computer.
2. **Data is extracted automatically.** Every document in the folder is recognized (invoice, receipt, bank statement…) and its data is pulled into a structured schema: vendor, date, totals, line items, transactions. DocAI ships with schemas for common documents, and you can create your own.
3. **Work with your data.** Browse & Search in a Drive-like web UI, and match payments to invoices with the built-in reconciliation tool.

## Which AI reads your documents? You choose

DocAI uses an AI model to recognize your documents and pull out their data. When you first open it, a short setup lets you choose where that model runs:

- **On your own computer.** DocAI downloads and runs [Qwen 3.5 9B](https://huggingface.co/Qwen) for you, or uses it through [Ollama](https://ollama.com) if you already have it. Your documents never leave your computer. The trade-off: it's slower and less precise than the big cloud models, and it needs a strong enough machine (16 GB of memory or more, ideally a recent Mac or a PC with a good graphics card).
- **With an AI provider you already trust.** Use your own API key for OpenAI, Claude, Gemini, OpenRouter or Vercel AI Gateway. It's fast and accurate, and your documents are sent only to the provider you choose.

You can switch at any time in **Settings → Processing**.

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

You need [Node.js](https://nodejs.org).

```bash
npm install
npm start
```

Then open http://localhost:4310. The setup asks for the folder with your documents and how the AI should run (see above).

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
