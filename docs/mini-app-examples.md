# Mini app examples

A mini app is a small tool that runs on top of your DocAI data. You describe what you want to Claude (or another AI assistant connected over MCP), it builds the app once, and from then on the app runs on its own: no AI calls, no tokens, the same answer every time.

This page shows three mini apps in daily use, to give you ideas for your own. They're listed under **Apps** in the top menu, next to the built-in ones:

![The Apps page with Monthly Expenses, Folder Suggestions and Bank Reconciliation](images/mini-apps/apps-list.jpg)

## Monthly Expenses

**What it answers:** where did my money go this month?

It gathers every receipt, invoice, Pix and remittance of the month, groups them by category and checks each one against the bank statement.

![Monthly Expenses: total spent, number of expenses, how many are matched to the bank, and spending by category](images/mini-apps/expenses-overview.jpg)

- The four cards at the top show the total spent (and the change from last month), how many expenses there are, how many are matched to a bank transaction, and how many still have no category.
- **By category** shows each category's share of the month and how it changed from the month before.
- Use the arrows next to the month to go back and forward.

Click a category to see its expenses:

![The Lunch category: each receipt with its matching bank transaction](images/mini-apps/expenses-category.jpg)

Each line shows the receipt and, under it, the bank transaction it was matched to. A line marked **Bank only** is a payment that appears on the statement but has no receipt yet. To move an expense to another category, pick one from its dropdown.

## Folder Suggestions

**What it answers:** where should these new documents go?

When documents land in the top folder (for example, files you just dropped in), Folder Suggestions looks at the documents you've already filed. If 23 receipts from the same market are all in one folder, the next receipt from that market belongs there too. Each suggestion comes with a confidence level.

Here, five documents are waiting in the top folder: two market receipts, two lunch payments and a laundry payment:

![Five documents in the top folder, each with a suggested folder and High 100% confidence](images/mini-apps/folders-suggestions.jpg)

Under each suggestion you can see why it was made, for example "23 similar · same name and type". If you disagree, pick another folder from the dropdown.

Click **Move** to file one document:

![One document moved; four left](images/mini-apps/folders-moved-one.jpg)

Or click **Move all 100%** (or **Move all high-confidence**) to file everything you're sure about at once:

![All documents filed; the top folder is empty](images/mini-apps/folders-moved-all.jpg)

The files move on disk too, so your folder (or Google Drive) stays organized the same way.

## Bank Reconciliation

**What it answers:** which bank transactions are explained by a document, and which aren't?

For each month it lists every bank transaction with the receipt, invoice or remittance that explains it.

![Bank Reconciliation: 122 transactions, 75 reconciled, 3 suggested matches, 44 without a document](images/mini-apps/recon-overview.jpg)

- **Reconciled**: the transaction is linked to its document. **Unlink** undoes the link.
- **Suggested match**: DocAI found a document that fits (same amount, same day) but wants you to confirm it.
- **No document**: nothing explains this transaction yet. These are the ones to chase.

Click the **Suggested match** card to review the suggestions:

![Three suggested matches waiting for review](images/mini-apps/recon-suggested.jpg)

Each suggestion shows the document it found and why ("same day"). If it's right, click **Reconcile**:

![One match accepted: reconciled goes from 75 to 76](images/mini-apps/recon-accepted-one.jpg)

After all three are accepted, nothing is left to review and 78 transactions are reconciled:

![All suggestions accepted](images/mini-apps/recon-accepted-all.jpg)

The transaction now shows as reconciled, with the amount of the document it's linked to:

![A reconciled transaction with its linked document](images/mini-apps/recon-reconciled-row.jpg)

## Build your own

These apps were built by asking Claude, with DocAI connected over MCP (see [Connecting Claude](../README.md#connecting-claude)). Describe the report or workflow you want, for example "a page that shows my VAT for each quarter" or "a list of invoices that are past due". Claude builds the app on your data, and you can ask for changes the same way. The [mini apps reference](mini-apps.md) has the technical details.
