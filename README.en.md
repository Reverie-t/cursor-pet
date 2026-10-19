# cursor-pet

[中文](README.md) | **English**

A transparent desktop pet that reacts to your local Cursor Agent's activity. It thinks while you're asking Cursor a question, works while Cursor edits files, and switches pose when a task succeeds or fails.

Currently supports **Windows** only. Requires Node.js to be installed and Cursor to be signed in locally.

## Preview

<p align="center">
  <img src="assets/screenshots/grok-preview.png" width="820" alt="Six poses: idle, thinking, coding, success, sighing, and dragging" />
  <br />
  <sub>Six poses — idle, thinking, coding, success, sighing, and dragging</sub>
</p>

## Getting started

```powershell
git clone https://github.com/Reverie-t/cursor-pet.git
cd cursor-pet
npm install
npm run install-hooks
npm start
```

`npm run install-hooks` writes reporting hooks into your Cursor configuration. If the pet still doesn't react after installation, restart Cursor once.

Once the window is closed, it reopens automatically the next time a local Agent starts working — or run `npm start` again.

## Context menu

- Today's cumulative time spent thinking and working, plus success and failure counts
- The last recorded plan balance; click "Refresh balance" to query Cursor again
- Say something to it — replies are generated locally and don't consume plan credits
- Reset to the bottom-right corner
- Hide
- Quit

## Usage alerts

You'll be reminded once when usage reaches 80%, and again at 95% and 100%; each threshold fires at most once per day. To change the threshold, write this into `logs/pet-settings.json`:

```json
{ "alertPercent": 70 }
```

## License

Released under the [MIT](LICENSE) license. Credit: reverie.
