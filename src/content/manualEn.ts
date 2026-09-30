import type { Manual } from './manualTypes'

/** English edition. Mirrors manualZh section-for-section (same ids, so the TOC matches). */
export const manualEn: Manual = {
  title: 'User Manual',
  subtitle: 'Get going in 5 minutes. The AI and API-key sections assume zero technical background.',
  chapters: [
    {
      id: 'start',
      title: '1. Getting started',
      sections: [
        {
          id: 'what',
          title: '1.1 What this is for',
          blocks: [
            {
              t: 'p',
              text: 'In short: it keeps "a pile of things I need to remember" organised so you can search it, chart it, and let AI fill it in for you. Customer lists, inventory, property listings, expenses, to-dos — anything made of many records, each with several pieces of information.',
            },
            {
              t: 'p',
              text: 'The difference from Excel: you don\'t have to design the table up front or type row by row. Just tell the AI in plain language — "I want to track customers, with name, phone and deal value" — and it sets up the table, imports any data you already have, and answers questions like "which city closed the most deals this month?".',
            },
            {
              t: 'note',
              kind: 'info',
              title: 'Free, permanently',
              text: 'This product is free forever, never expires, and has no record limits. Your data stays on your own device by default (the browser\'s local database) and we cannot see it. If you want multi-device sync you can optionally turn on your own cloud storage.',
            },
          ],
        },
        {
          id: 'quickstart',
          title: '1.2 Five-minute quick start',
          blocks: [
            {
              t: 'steps',
              items: [
                {
                  title: 'Create an account',
                  text: 'Open the home page, click Sign up, and pick a username and password. Remember the username — it is the only way to log in, and it cannot be recovered, by design, so nobody can impersonate you to read your data.',
                },
                {
                  title: 'Create a library',
                  text: 'After logging in, click New library on the left and give it a name such as "Customers". A library is one table.',
                },
                {
                  title: 'Say what you want to track',
                  text: 'Click Template and pick a ready-made one (customers, property, inventory, expenses), or start from a blank one and add your own fields.',
                },
                {
                  title: 'Start entering data',
                  text: 'Click New to add records one at a time, or Import to bring in an existing spreadsheet all at once.',
                },
                {
                  title: 'Let AI do the work',
                  text: 'Click the AI Assistant button in the corner and just ask, e.g. "group these 8 customers by city".',
                },
              ],
            },
            {
              t: 'note',
              kind: 'tip',
              title: 'Not ready to set up AI?',
              text: 'That\'s fine. AI is optional. Everything works without it — building libraries, entering data, searching, import and export. Come back to it once you\'re comfortable.',
            },
          ],
        },
      ],
    },
    {
      id: 'concepts',
      title: '2. Key terms',
      sections: [
        {
          id: 'glossary',
          title: '2.1 Library / field / item',
          blocks: [
            {
              t: 'table',
              head: ['Term', 'Analogy', 'What it actually is'],
              rows: [
                ['Library', 'an Excel worksheet', 'A set of related records, e.g. "Customers" or "Inventory"'],
                ['Field', 'the header row', 'One piece of information per record, e.g. "Name" or "Deal value"'],
                ['Item', 'one row of the table', 'One actual record, e.g. "Beijing Huasheng, contact Zhang Wei"'],
                ['Sub-library', 'another sheet in the workbook', 'A child library under a parent library, for finer grouping'],
                ['Category', 'a label on a filing cabinet', 'Groups libraries by purpose; the sidebar folds them by category'],
              ],
            },
          ],
        },
        {
          id: 'fieldtypes',
          title: '2.2 Field types',
          blocks: [
            { t: 'p', text: 'Picking the right type matters — it decides what you can sort, filter and chart later:' },
            {
              t: 'table',
              head: ['Type', 'Looks like', 'Good for', 'Sortable / chartable'],
              rows: [
                ['Text', 'single-line input', 'names, IDs, addresses', 'sortable, not summable'],
                ['Long text', 'large text box', 'notes, descriptions, contract terms', 'excluded from sorting'],
                ['Number', 'numbers only', 'amounts, quantities, areas', 'sortable, summable, chartable'],
                ['Date', 'calendar picker', 'deal date, due date, birthday', 'sortable, filterable by range'],
                ['Choice', 'pick from a list', 'city, status, priority', 'filterable, groupable'],
                ['Checkbox', 'a single box', 'closed the deal? VIP?', 'filterable, completion rate'],
                ['Rating', 'one to five stars', 'satisfaction, priority', 'sortable, average-able'],
              ],
            },
            {
              t: 'note',
              kind: 'warn',
              title: 'Amounts must be Numbers',
              text: 'Store money as a Number. As Text it cannot be summed or charted, and sorting treats it as a string — so "100" can end up before "9".',
            },
          ],
        },
      ],
    },
    {
      id: 'build',
      title: '3. Building libraries',
      sections: [
        {
          id: 'template',
          title: '3.1 Starting from a template',
          blocks: [
            {
              t: 'p',
              text: 'Click Template at the top right of the library page to open the template centre, which has ready-made structures for customers, property, inventory, expenses and to-dos.',
            },
            {
              t: 'note',
              kind: 'info',
              title: '"Include sample data"',
              text: 'Each template has a checkbox controlling whether a few example records are added so you can see how it works. Handy when learning; just delete them afterwards. Skip it if you know what you\'re doing.',
            },
            {
              t: 'p',
              text: 'A template\'s field types may not suit you exactly. Click the Template button afterwards to adjust them — change Notes from long text to text, add or remove cities from the Choice field, and so on.',
            },
          ],
        },
        {
          id: 'editfield',
          title: '3.2 Editing fields',
          blocks: [
            { t: 'p', text: 'In the Template dialog each field row has four controls:' },
            {
              t: 'ul',
              items: [
                'Name: the label you see. Renaming is always safe and never affects existing data.',
                'Type: decides what can be sorted and charted. Changing it after data exists may not convert old values — be careful.',
                'Required: when on, saving is blocked until that field is filled in.',
                'Visible: when off, the field is hidden from the entry form and the table.',
              ],
            },
            {
              t: 'note',
              kind: 'warn',
              title: 'Hiding is not deleting',
              text: 'Turning Visible off only hides the field; every record still holds its value and you can switch it back on. Actually deleting a field (the bin icon) removes the data too, with no undo. Take a snapshot under Settings first.',
            },
          ],
        },
        {
          id: 'subcat',
          title: '3.3 Sub-libraries and categories',
          blocks: [
            {
              t: 'p',
              text: 'To subdivide a library, use its "⋯" menu and choose New sub-library. Sub-libraries appear indented under the parent.',
            },
            {
              t: 'p',
              text: 'The sidebar gets long once you have many libraries. Give each one a category ("⋯" → Change category) and the sidebar folds them into groups. Category names are up to you — "Sales", "Operations", "Personal".',
            },
            { t: 'p', text: 'The same menu has Move up / Move down to reorder the sidebar manually.' },
          ],
        },
      ],
    },
    {
      id: 'data',
      title: '4. Entering and exporting',
      sections: [
        {
          id: 'add',
          title: '4.1 Adding records',
          blocks: [
            {
              t: 'ul',
              items: [
                'One at a time: click New, fill in, press Save. Enter does not submit by accident — use the button.',
                'Pin: tap the pin on the left of a card or table row. Pinned records always sort to the top, handy for the few you\'re actively working on.',
                'Edit: tap the pencil. Saving only overwrites the fields you changed — hidden field values are never lost.',
              ],
            },
          ],
        },
        {
          id: 'import',
          title: '4.2 Importing from Excel (the fast way)',
          blocks: [
            {
              t: 'steps',
              items: [
                {
                  title: 'Prepare a spreadsheet or CSV',
                  text: 'The first row must be field names (a header). Each row after that is one record. Column order doesn\'t matter — you\'ll map them in the next step.',
                },
                { title: 'Click Import in the toolbar', text: 'Accepts .xlsx, .xls and .csv, up to 10MB per file.' },
                {
                  title: 'Match your columns to fields',
                  text: 'The import window lists every header in your file; choose which field each one maps to. Headers identical to field names are matched automatically — just check them.',
                },
                { title: 'Confirm', text: 'Progress is shown at the bottom. Large files take a while; do not close the page midway.' },
              ],
            },
            {
              t: 'note',
              kind: 'tip',
              title: 'A column with no matching field?',
              text: 'Just pick Ignore — it won\'t error. But if you want to keep that data, create the matching field first in Template. Hidden fields can be mapped too.',
            },
            {
              t: 'note',
              kind: 'info',
              title: 'Import appends, it does not replace',
              text: 'Records are added after your existing ones; nothing is cleared. Importing the same file twice therefore creates duplicates.',
            },
          ],
        },
        {
          id: 'export',
          title: '4.3 Exporting',
          blocks: [
            {
              t: 'p',
              text: 'Click Export in the toolbar to save as CSV or Excel. The export includes all fields, not just the currently visible ones, and opens directly in Excel. The CSV is written with a BOM so Chinese text is not garbled.',
            },
            {
              t: 'note',
              kind: 'tip',
              text: 'Use .xlsx if you want to keep working in Excel; .csv is more portable for other systems.',
            },
          ],
        },
      ],
    },
    {
      id: 'daily',
      title: '5. Everyday use',
      sections: [
        {
          id: 'search',
          title: '5.1 Search, filter, sort',
          blocks: [
            {
              t: 'ul',
              items: [
                'Search box: finds records containing the keyword across all fields, updating as you type.',
                'Filter field + value: exact match on one field, e.g. City = Beijing.',
                'Sort: choose a field for the order, then toggle Ascending / Descending.',
                'Clear: resets all three at once.',
              ],
            },
            {
              t: 'note',
              kind: 'info',
              title: 'Global search',
              text: 'Press Ctrl/⌘ + K on any page (or use the search box in the header) to search across every library. Ideal when you can\'t remember where a record lives.',
            },
          ],
        },
        {
          id: 'phone',
          title: '5.2 On a phone',
          blocks: [
            { t: 'p', text: 'Open the same address on your phone and the layout switches to cards automatically. You can also install it as an app:' },
            {
              t: 'ul',
              items: [
                'Android: download the installer from the home page, or use the browser menu "Add to Home screen".',
                'iPhone: open in Safari → Share button → "Add to Home Screen".',
              ],
            },
            {
              t: 'note',
              kind: 'tip',
              title: 'Why cards instead of a table on phones?',
              text: 'A wide table needs sideways dragging and is awkward with a thumb. Cards stack each record vertically so every field is visible, and edit and delete are one tap away.',
            },
          ],
        },
      ],
    },
    {
      id: 'safety',
      title: '6. Backups and deletion',
      sections: [
        {
          id: 'trash',
          title: '6.1 Trash',
          blocks: [
            {
              t: 'p',
              text: 'Deleting a library, field or item does not destroy it — it goes to the Trash first. Restore items from Tools → Trash in the sidebar.',
            },
            {
              t: 'note',
              kind: 'warn',
              title: 'Emptied after 30 days',
              text: 'Anything in the Trash for more than 30 days is permanently deleted and cannot be recovered. Restore anything you want to keep.',
            },
            { t: 'note', kind: 'warn', title: 'Permanent delete is final', text: 'There is no second chance once you choose it.' },
          ],
        },
        {
          id: 'backup',
          title: '6.2 Snapshots and backups (important)',
          blocks: [
            {
              t: 'p',
              text: 'Under Settings → Data backup you can take a snapshot at any time — effectively a photograph of all your data. If you delete something or break a template, you can restore back to that moment.',
            },
            {
              t: 'ul',
              items: [
                'Restoring a snapshot overwrites everything and reloads the page.',
                '"Export backup file" saves all your data to a file you keep locally. Do this regularly.',
                'When moving to a new phone or computer, importing an exported backup is the most reliable route.',
              ],
            },
            {
              t: 'note',
              kind: 'tip',
              title: 'Make it a habit',
              text: 'Take a snapshot before anything risky — deleting a field, restructuring a template, a bulk import. Three seconds now can save hours later.',
            },
          ],
        },
      ],
    },
    {
      id: 'ai',
      title: '7. The AI assistant',
      sections: [
        {
          id: 'aiwhere',
          title: '7.1 Opening it',
          blocks: [
            {
              t: 'p',
              text: 'There is an AI Assistant button in the corner on every page. You can also press Ctrl/⌘ + J.',
            },
            {
              t: 'p',
              text: 'It docks to the right (rising from the bottom on a phone) and pushes the content area left — so you can read the answer while still clicking through your table and other libraries, with neither getting in the other\'s way.',
            },
            {
              t: 'ul',
              items: [
                'Need the space back: click the collapse arrow in the panel header to shrink it to a thin strip; tap again to restore.',
                'Done for now: click ✕ to close. Tasks already running keep going in the background and you get a notification when they finish.',
              ],
            },
          ],
        },
        {
          id: 'aican',
          title: '7.2 What it can do',
          blocks: [
            {
              t: 'table',
              head: ['You say', 'It does'],
              rows: [
                ['"Count customers per city"', 'Computes it, and can chart it directly'],
                ['"Group these 20 records by status"', 'Reads your data and analyses it'],
                ['"Add a customer: Zhang San, 5000"', 'Writes to the database (after confirming with you)'],
                ['"Import this file" + attach a spreadsheet', 'Parses the file and creates records in bulk'],
                ['"Which customers have I not contacted in 30 days?"', 'Filters by the date field and lists them'],
              ],
            },
            {
              t: 'note',
              kind: 'info',
              title: 'It can see your data',
              text: 'With AI on, your question includes the structure and some content of the relevant libraries, sent to the model provider. That is what lets it understand your data. With AI off, nothing is ever sent anywhere.',
            },
            {
              t: 'note',
              kind: 'tip',
              title: 'Good questions get good answers',
              text: 'Say which library, which field, and what definition you want. "How many closed deals in Beijing versus Shanghai?" beats "give me a summary".',
            },
          ],
        },
        {
          id: 'aichart',
          title: '7.3 Charts',
          blocks: [
            {
              t: 'p',
              text: 'Charts follow a consistent set of rules: colours adapt to the current theme so they stay legible in light and dark mode, bar chart axes start at zero so they cannot mislead, too many categories switch the chart to horizontal bars, and pie charts are capped at 6 slices.',
            },
            { t: 'p', text: 'Any chart can be downloaded as a PNG image.' },
          ],
        },
      ],
    },
    {
      id: 'apikey',
      title: '8. AI and API keys (complete walkthrough)',
      sections: [
        {
          id: 'aifirst',
          title: '8.1 Try "platform provided" first — you may not need anything else',
          blocks: [
            { t: 'p', text: 'For most people this is where the chapter ends.' },
            {
              t: 'p',
              text: 'Go to Settings → AI configuration, choose "Platform provided (no setup)", and leave everything blank. It just works. This uses a shared quota operated by the service owner, subject to rate limits, and requires you to register nothing.',
            },
            {
              t: 'note',
              kind: 'info',
              title: 'When do you actually need your own key?',
              text: 'If you use it heavily, want a stronger model, or would rather spend your own existing credit. If not, stick with platform provided.',
            },
          ],
        },
        {
          id: 'keywhat',
          title: '8.2 First, what an API key actually is',
          blocks: [
            { t: 'p', text: 'Think of it as the key to your front door.' },
            {
              t: 'ul',
              items: [
                'AI companies (DeepSeek, Alibaba, Zhipu and others) expose their models over an interface your app can call.',
                'To use that interface you must prove you are you and that you have paid. That credential is the API key — a long string starting with sk-.',
                'Pasting it into this app means handing it your key. It uses the key on your behalf and the cost comes out of your AI account balance.',
              ],
            },
            {
              t: 'note',
              kind: 'warn',
              title: 'An API key is a password',
              text: 'Anyone holding your key can spend your money. So: don\'t screenshot it into group chats, don\'t commit it to a public repository, don\'t lend it out. If you think it leaked, delete it at the provider and create a new one.',
            },
          ],
        },
        {
          id: 'keyflow',
          title: '8.3 The general procedure: six steps',
          blocks: [
            { t: 'p', text: 'Whichever provider you choose, the steps are the same. Section 8.4 lists the addresses.' },
            {
              t: 'steps',
              items: [
                {
                  title: 'Open the provider\'s developer console',
                  text: 'Look for "Open platform", "Developer platform" or "Console" — not the consumer chat site. They often live on the same domain under different links.',
                },
                {
                  title: 'Register or sign in',
                  text: 'Chinese providers generally use a phone number with an SMS code, or a WeChat scan. Usually no credit card needed.',
                },
                {
                  title: 'Check balance or claim free credit',
                  text: 'Most give new accounts a free allowance, enough for thousands of questions. Confirm it on the Usage or Balance page.',
                },
                {
                  title: 'Create an API key',
                  text: 'On the API Keys page click Create. You will usually be asked to name it, so you can tell them apart later (e.g. "phone", "laptop").',
                },
                {
                  title: 'Copy it immediately',
                  text: 'This is the crucial step: the key is usually shown exactly once, and cannot be viewed again after the dialog closes. Copy it to a password manager or a temporary note.',
                },
                { title: 'Paste it into this app and test', text: 'See 8.5.' },
              ],
            },
            {
              t: 'note',
              kind: 'tip',
              title: 'Pasted it wrong?',
              text: 'Watch for stray spaces or a trailing newline. Clear the field and paste again rather than "fixing" it — a single extra space causes a 401.',
            },
          ],
        },
        {
          id: 'keytable',
          title: '8.4 Provider quick reference',
          blocks: [
            {
              t: 'p',
              text: 'All of these are reachable from mainland China without a proxy. Prices and free allowances change, so treat the provider\'s site as the source of truth.',
            },
            {
              t: 'table',
              head: ['Provider', 'Console', 'Base URL', 'Common model name', 'New users'],
              rows: [
                ['DeepSeek', 'platform.deepseek.com', 'https://api.deepseek.com', 'deepseek-chat', 'Free credit, direct access in China'],
                ['Qwen (Alibaba)', 'bailian.console.aliyun.com', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen-plus / qwen-flash', 'Large free token grant'],
                ['Zhipu GLM', 'open.bigmodel.cn', 'https://open.bigmodel.cn/api/paas/v4', 'glm-4-flash etc.', 'Free tokens on signup'],
                ['Kimi', 'platform.moonshot.cn', 'https://api.moonshot.cn', 'moonshot-v1-8k etc.', 'Direct access in China'],
                ['OpenAI', 'platform.openai.com', 'https://api.openai.com', 'gpt-4o-mini etc.', 'Overseas payment method required'],
              ],
            },
            {
              t: 'note',
              kind: 'info',
              title: 'Where do I find the model name?',
              text: 'Don\'t guess. Go to the provider\'s model list or documentation and copy a name that matches your account\'s access. A wrong name errors immediately, and similarly named models differ a lot in capability.',
            },
            {
              t: 'note',
              kind: 'warn',
              title: 'OpenAI needs overseas payment',
              text: 'OpenAI\'s API requires a card most people in mainland China cannot get. If that applies to you, use one of the first four.',
            },
          ],
        },
        {
          id: 'keyfill',
          title: '8.5 Filling in the three fields',
          blocks: [
            { t: 'p', text: 'In Settings → AI configuration choose "Bring your own API key" and fill in three boxes. Using DeepSeek as the example:' },
            {
              t: 'table',
              head: ['Field', 'What to enter', 'DeepSeek example'],
              rows: [
                ['Base URL', 'The API root, with no trailing slash', 'https://api.deepseek.com'],
                ['API key', 'The sk- string you copied in step 8.3', 'sk-xxxxxxxxxxxxxxxx'],
                ['Model name', 'Copy the exact name from the provider docs', 'deepseek-chat'],
              ],
            },
            { t: 'p', text: 'Then press Test connection. Once it reports success, open the AI assistant from the corner button and start asking.' },
            {
              t: 'note',
              kind: 'tip',
              title: 'Test before you rely on it',
              text: 'Press Test connection first to confirm all three fields are right. A failed test tells you exactly which step is wrong.',
            },
          ],
        },
        {
          id: 'keyerr',
          title: '8.6 Troubleshooting table',
          blocks: [
            {
              t: 'table',
              head: ['What you see', 'Cause', 'What to do'],
              rows: [
                ['401 / unauthorised', 'Key wrong or expired, or pasted with whitespace', 'Clear and re-paste; if it fails, delete and recreate it at the provider'],
                ['402 / insufficient balance', 'Out of credit', 'Top up, or switch to a model still covered by free credit'],
                ['429 / too many requests', 'Too many questions in a short time', 'Wait a minute; or use a cheaper, faster model'],
                ['Model not found', 'Model name is wrong, or your account lacks access', 'Copy the exact name from the provider docs'],
                ['Connection failed / timeout', 'Network blocked, or the base URL is wrong', 'Check the URL is complete; check proxy settings'],
                ['Works but feels slow', 'Picked a heavyweight model', 'Switch to a flash / mini model — noticeably faster'],
              ],
            },
            {
              t: 'note',
              kind: 'tip',
              title: 'Still stuck?',
              text: 'Copy the full error text from Test connection and search it in the provider\'s official documentation. Most problems are documented there.',
            },
          ],
        },
        {
          id: 'keysafe',
          title: '8.7 Cost and safety',
          blocks: [
            {
              t: 'ul',
              items: [
                'Pay as you go: usually billed on input plus output tokens. See the provider\'s pricing page.',
                'Saving money: everyday classification, counting and simple entry work fine on a lightweight model (flash / mini). Reserve the big models for genuinely hard tasks.',
                'This app never sends your key to a third party — it is stored only on your device and used solely against the base URL you entered.',
                'Set spending limits on the provider side to avoid surprises.',
              ],
            },
            {
              t: 'note',
              kind: 'warn',
              title: 'Deleting it here is not enough',
              text: 'If you stop using AI, clear the key from the settings — and remember to delete the key at the provider too, so it isn\'t left lying around.',
            },
          ],
        },
      ],
    },
    {
      id: 'sync',
      title: '9. Multiple devices and sync',
      sections: [
        {
          id: 'storagemode',
          title: '9.1 Two storage modes',
          blocks: [
            {
              t: 'table',
              head: ['Mode', 'Where data lives', 'Who it suits'],
              rows: [
                ['Local (default)', 'The browser database on your own device', 'Single device; simplest and safest'],
                ['Cloud', 'A cloud database you set up yourself', 'Anyone who needs phone and laptop in sync'],
              ],
            },
            { t: 'p', text: 'Neither mode stores your data with us. Export a backup before switching modes, just in case.' },
          ],
        },
        {
          id: 'cloudsetup',
          title: '9.2 The real barrier to cloud mode (read this first)',
          blocks: [
            {
              t: 'note',
              kind: 'warn',
              title: 'This step does have a learning curve',
              text: 'Cloud mode needs you to sign up for a cloud database, create a table, then paste in a URL and a key. That assumes some technical comfort. If you have none, strongly consider staying on local mode and moving data with an exported backup — or use the device-to-device transfer below.',
            },
            {
              t: 'p',
              text: 'The settings page already contains the exact table-creation statement you need; copy it into your cloud provider\'s console and run it. If it errors, send the error to that provider\'s support or community — someone usually answers within minutes.',
            },
          ],
        },
        {
          id: 'p2p',
          title: '9.3 Device-to-device transfer (recommended for most people)',
          blocks: [
            { t: 'p', text: 'To move data to another device without setting up a cloud database, use Data sync → Local network transfer:' },
            {
              t: 'steps',
              items: [
                { title: 'Put both devices on the same Wi-Fi', text: 'The same router is enough; no internet needed.' },
                { title: 'On the old device, open it and choose Send', text: 'It will show a pairing code or QR code.' },
                { title: 'On the new device, choose Receive and enter the code', text: '' },
                { title: 'Confirm and start', text: 'Progress is shown during the transfer.' },
              ],
            },
            {
              t: 'note',
              kind: 'tip',
              text: 'The easiest multi-device route by far: no third-party account, just a few taps between two devices.',
            },
          ],
        },
      ],
    },
    {
      id: 'privacy',
      title: '10. Privacy and security',
      sections: [
        {
          id: 'privacy',
          title: '10.1 Who your data belongs to',
          blocks: [
            {
              t: 'ul',
              items: [
                'Default (local): everything stays in your own browser database. Clearing browser data deletes it too, so export backups regularly.',
                'Cloud mode: data lives in a database you set up; only you hold the key.',
                'We, the operator, never store your business data.',
                'The one exception: if you turn on AI and ask something, the relevant content is sent to that model provider — that is what makes the answer possible.',
              ],
            },
          ],
        },
        {
          id: 'account',
          title: '10.2 Account safety',
          blocks: [
            {
              t: 'ul',
              items: [
                'Usernames cannot be recovered. This is deliberate: it stops anyone resetting a password to reach your data.',
                'On a shared device, click Sign out when you are done rather than just closing the browser.',
                'Do not tick "remember me" on a public computer.',
                'Export a backup regularly from Settings → Data backup, especially before switching devices or clearing your browser.',
              ],
            },
          ],
        },
        {
          id: 'faq',
          title: '10.3 FAQ',
          blocks: [
            {
              t: 'table',
              head: ['Problem', 'What to do'],
              rows: [
                ['New phone, no data', 'Old device: Settings → Export backup. New device: Import backup. Or use the local network transfer.'],
                ['AI says "not configured"', 'Go to Settings → AI configuration, choose platform provided or enter your own key, then Test connection'],
                ['A checkbox column shows true', 'Fixed in the current version (now shows Yes / No). Refresh if you still see it.'],
                ['Deleted the wrong thing', 'Go to Trash immediately — after 30 days it is cleared for good'],
                ['UI is broken, buttons unresponsive', 'Hard refresh with Ctrl/⌘ + Shift + R; if that fails clear site data and log in again (export a backup first)'],
                ['AI spins forever', 'Press Stop generating, or switch to a lighter model'],
                ['I need it for a team', 'This is a personal tool with no collaboration. Each person keeps their own libraries, or share one dataset via cloud mode'],
              ],
            },
          ],
        },
      ],
    },
  ],
}
