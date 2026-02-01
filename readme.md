# Cookie Logger

Cookie Logger is a small browser extension that records cookies and relevant tab events during a measurement session. It helps observe which cookies a page sets or removes and classifies them into categories (e.g. Analytics, Marketing, Functional).

### About
- This Chromium-based browser extension was developed as part of a Bachelor's thesis.


### Features
- Start/stop a measurement session for a specific URL
- Group and classify observed cookies by category
- Log user clicks and session events (start/end)
- Export the recorded session as a JSON file

### Cookie database
- This extension uses the Open Cookie Database to map cookie names to categories: [Open Cookie Database](https://github.com/jkwakman/Open-Cookie-Database)

### Installation (development / local)
1. Install dependencies:

    ```bash
    npm install
    ```

2. Build the extension (creates `dist/`):

    ```bash
    npm run build
    ```

3. Load as an unpacked extension in your Chromium-based browser:
   - Open `chrome://extensions/` (or `edge://extensions/`, `brave://extensions/`).
   - Enable "Developer mode".
   - Click "Load unpacked" and select the generated `dist/` folder from this project.

After loading, the extension should appear in the toolbar and is ready for local testing.
