# YouTube

Title, description and chapters for the walkthrough video. The thumbnail is [thumbnail.png](thumbnail.png) (`npm run thumbnail`).

The chapter times come from the build (each scene's start in `index.html`). If the narration changes, recompute them before publishing. YouTube needs the first chapter at 0:00, at least three chapters, and each at least 10 seconds long, so the short outro has no chapter of its own.

## Title

DocAI: Free, Open-Source Google Drive for Your Financial Documents

Alternatives:
- Introducing DocAI: Organize Your Invoices, Receipts & Bank Statements with AI (Free & Local)
- I Built a Free, Local, Open-Source Tool to Organize My Finances with AI

## Description

```
DocAI is a free, local, open-source Google Drive for your financial documents: invoices, receipts, bank statements and transactions.

https://doc-vision.com/docai

Point it at a folder (even a Google Drive folder synced to your computer). AI reads every document, pulls out the data (vendor, dates, totals, line items) into one database, and connects it: payments matched to invoices, expenses to bank transactions.

Then connect Claude or any AI assistant over MCP to sort, search and reconcile your documents, or to build mini apps: small tools that run on your data without calling an AI model. Faster, deterministic, cheaper and private.

You choose where the AI runs: on your own computer (a local model, or Ollama), or with a provider you already trust (OpenAI, Claude, Gemini, OpenRouter or Vercel AI Gateway) using your own key.

⭐ GitHub: https://github.com/eliaweiss/doc-ai

📖 Setup walkthrough: https://github.com/eliaweiss/doc-ai/blob/main/docs/setup-wizard.md
🧩 Mini app examples: https://github.com/eliaweiss/doc-ai/blob/main/docs/mini-app-examples.md

Get started (needs Node.js):
npm install
npm start
Then open http://localhost:4310

Chapters
0:00 Introducing DocAI
0:22 Why DocAI?
0:55 How it works
1:22 How I use it
1:40 Connect any AI assistant (MCP)
1:59 Mini apps
2:25 Setting up DocAI
3:07 Your first document
3:24 Mini app examples

#DocAI #OpenSource #PersonalFinance #AI #MCP #Claude #LocalAI
```
