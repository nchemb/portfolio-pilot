# Portfolio Copilot - End-to-End Testing Guide

## Prerequisites

Before testing, ensure you have:

1. ✅ Ran database migrations: `npx prisma migrate dev`
2. ✅ Set `OPENAI_API_KEY` in `.env.local`
3. ✅ (Optional) Set `OPENAI_MODEL` in `.env.local` (defaults to `gpt-4o-mini`)
4. ✅ Connected at least one brokerage account with holdings
5. ✅ Synced holdings data (run "Refresh" on dashboard)

## Test Checklist

### 1. Basic Setup Test

**Steps:**
1. Start dev server: `npm run dev`
2. Navigate to `/dashboard`
3. Verify the "Portfolio Copilot" card appears at the bottom of the Overview tab

**Expected:**
- Card renders with title "Portfolio Copilot"
- Chat interface is visible with message area, input field, and send button
- "Monthly contribution" setting row is visible at the top

---

### 2. Set Default Monthly Contribution

**Steps:**
1. In the Portfolio Copilot card, enter `500` in the monthly contribution input
2. Click "Save"

**Expected:**
- Button shows "Saving..." briefly
- Input is replaced with "Monthly contribution: $500" and a "Change" button
- No errors appear

**Verify API:**
```bash
# Check that preference was saved in database
npx prisma studio
# Navigate to Profile table and verify monthlyContributionCents = 50000
```

---

### 3. Ask Question Without Dollar Amount (Using Default)

**Steps:**
1. With default contribution set to $500, type: "What should I buy this month?"
2. Click "Send"

**Expected:**
- Message appears in chat as user message (blue/primary background)
- Loading indicator shows "Thinking..."
- Assistant response appears with:
  - Specific buy recommendations by asset class
  - Dollar amounts for each purchase
  - Ticker symbols to buy
  - Explanation grounded in your actual portfolio
- "Facts used" collapsible section appears below assistant message

**Verify Facts Used:**
- Click "Facts used" dropdown
- Verify it shows:
  - As of date
  - Total portfolio value (matches your dashboard)
  - Current allocation percentages
  - Top holdings with values
  - Rebalance suggestions with specific amounts and tickers

---

### 4. Ask Question With Explicit Dollar Amount

**Steps:**
1. Type: "What should I buy with $1000 to get closer to target?"
2. Click "Send"

**Expected:**
- Assistant uses $1000 (not the saved default of $500)
- Response includes specific purchases totaling ~$1000
- Facts used shows rebalance suggestions for $1000 contribution

---

### 5. Ask General Portfolio Question (No Rebalance)

**Steps:**
1. Type: "What are my biggest positions?"
2. Click "Send"

**Expected:**
- Assistant lists your top 3-5 holdings with actual values
- No rebalance plan is computed (faster response)
- Facts used shows portfolio summary but no rebalance suggestions

---

### 6. Test Quick Prompts

**Steps:**
1. Refresh the page to clear chat
2. Click any quick prompt button (e.g., "Why is my cash allocation so high?")

**Expected:**
- Prompt is sent automatically as a user message
- Assistant responds appropriately based on your actual allocation

---

### 7. Ask About Cash Allocation

**Steps:**
1. Type: "Why is cash so high?"
2. Click "Send"

**Expected:**
- Assistant analyzes your current allocation
- Cites specific percentages from "Facts used"
- Explains whether this is appropriate given your profile/target

---

### 8. Test Without Default Contribution Set

**Steps:**
1. Clear your monthly contribution (click "Change", leave blank, and save 0)
2. Type: "What should I buy to rebalance?"
3. Click "Send"

**Expected:**
- Assistant politely asks: "How much are you planning to contribute?"
- Or provides guidance on how to think about contribution amounts

---

### 9. Test Error Handling - Missing OpenAI Key

**Steps:**
1. Stop dev server
2. Comment out `OPENAI_API_KEY` in `.env.local`
3. Restart dev server
4. Try to send a message

**Expected:**
- Error message appears in chat: "OPENAI_API_KEY is not configured. Please set the environment variable."
- No crash occurs
- Interface remains functional

---

### 10. Test Multi-Turn Conversation

**Steps:**
1. Restore `OPENAI_API_KEY`
2. Send: "What should I buy with $500?"
3. Wait for response
4. Send follow-up: "What if I have $1000 instead?"

**Expected:**
- Both messages appear in chat history
- Second response adjusts recommendations for $1000
- Context is preserved between messages

---

### 11. Verify Data Accuracy

**Steps:**
1. Note your actual portfolio total value from the dashboard
2. Ask: "What is my total portfolio value?"
3. Check the assistant's response and "Facts used"

**Expected:**
- Assistant cites the correct value (matches dashboard)
- Facts used shows the exact same totalValue
- Numbers are formatted consistently (e.g., "$12,345")

---

### 12. Test Long Chat Session

**Steps:**
1. Send 5-10 messages in a row with different questions
2. Scroll through the message history

**Expected:**
- All messages are preserved
- Auto-scroll to bottom works on new messages
- Interface remains responsive
- No memory leaks or performance issues

---

## Troubleshooting

### "OPENAI_API_KEY is not configured"
- Verify `.env.local` contains `OPENAI_API_KEY=sk-...`
- Restart dev server after adding the key
- Check for typos in the variable name

### Assistant gives generic answers
- Check "Facts used" to see what data was provided
- Refresh brokerage sync if holdings are stale
- Verify portfolio summary is working: inspect `/api/chat` network request in browser DevTools

### Rebalance not working
- Set a default monthly contribution or specify dollar amount in message
- Check that target allocation is configured in your profile (Settings tab)
- Verify rebalancer is working by checking console logs

### TypeScript errors
- Run `npm install` to ensure OpenAI SDK is installed
- Run `npx prisma generate` to regenerate Prisma client
- Check for type errors: `npx tsc --noEmit`

---

## API Testing (Optional)

Test the API directly with curl:

### Test Chat API

```bash
# Get your auth token from browser DevTools (Application > Cookies > __session)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "What should I buy with $500?"
      }
    ]
  }'
```

### Test Preferences API

```bash
# Save preference
curl -X POST http://localhost:3000/api/preferences \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{"monthlyContributionDollars": 500}'

# Get preference
curl http://localhost:3000/api/preferences \
  -H "Cookie: __session=YOUR_SESSION_TOKEN"
```

---

## Success Criteria

The implementation is successful if:

- ✅ Chat widget renders on dashboard without errors
- ✅ Users can set and save default monthly contribution
- ✅ Assistant responds with grounded, accurate portfolio data
- ✅ Rebalance recommendations work with explicit amounts
- ✅ Rebalance recommendations work with saved default
- ✅ "Facts used" section provides transparency
- ✅ Error handling works gracefully (missing API key, network errors)
- ✅ Multi-turn conversations are supported
- ✅ No hallucinated numbers (all data comes from engine outputs)

---

## Notes

- The chat state is client-side only (not persisted to database)
- Refreshing the page clears the chat history
- Each message includes portfolio snapshot and optionally rebalance plan
- The system prompt ensures the model never invents financial numbers
