# DultaWifi.com ✈️

A Chrome extension that recreates the in-flight Wi-Fi experience, faithfully, on the ground. Welcome aboard Dulta, with Fast, Free Wi-Fi presented by Tee-Mobile.

Flip it on from the toolbar and open any website. Just like on a plane, every page sends you to the Wi-Fi portal first. Log in to SkyMyles (it might not work the first time). Sit on the **Connecting** screen while a sponsor video plays (it buffers). Then you're connected, and **Start Browsing** takes you to the page you were trying to open.

After that, your browser behaves like the Wi-Fi at 35,000 feet. The first five minutes put you through every headache once (perfect, then slow, then an outage, then your session expires), because nobody plays along with a joke for an hour. After you log back in, things space out:

- **It works great at first.** The first 30 seconds to 2 minutes are flawless. Some later stretches are too, for 10–20 minutes at a time, long enough to forget about it.
- **Satellite lag.** The rest of the time, every click and every request picks up a little delay.
- **Rough patches.** Sometimes it barely recovers before the next problem hits.
- **Slow spells.** Links take seconds to respond. Images paint in line by line or go from blurry to sharp, and a few never load. Videos buffer on the site's own player. The occasional request just dies.
- **Outages.** Pages turn into Chrome's "This site can’t be reached" (ERR_CONNECTION_TIMED_OUT) or the dinosaur "No internet" page. Yes, you can play the dinosaur game. Open pages stop loading and chat apps go to "Reconnecting…". Everything comes back by itself, eventually.
- **Expired session.** Pages show Chrome's "Connect to Wi-Fi" screen. Click Connect, log in again, and watch the video again.

Nothing is announced and there's no pattern. It just happens, like the real thing.

## Making it stop

It's a gag, not a punishment.

- Click the toolbar icon and flip the switch off.
- Press **⌥⇧L** (Option+Shift+L) on any tab.
- Wait. It turns itself off **60 minutes** after you log in.
- Restart Chrome, or remove the extension.

Everything happens inside Chrome. It never touches your Mac's network settings or any other app, and it never touches a real airline's Wi-Fi portal.

## Install

1. Download or clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this folder.
4. Click the puzzle-piece icon and pin **DultaWifi.com**, then click it and flip the switch on.
5. Open any website.

Once you're logged in, the popup also has buttons to trigger a slow spell, an outage or an expired session on demand, which is handy for demos. You can also go straight to `dultawifi.com`.

## How it works

| File | What it does |
| --- | --- |
| `rules.json` | Sends `dultawifi.com` to the portal page. While you're not logged in, `background.js` sends every other site there too. |
| `portal.*`, `flight.js` | The portal: home, SkyMyles login, Connecting + sponsor video, connected. Generates a plausible flight. |
| `background.js` | Runs the flight: picks when things go wrong, blocks requests during outages, the kill switch |
| `chrome-pages.js` | Look-alikes of Chrome's error and "Connect to Wi-Fi" pages, plus the runner game. Swapped in so the address bar keeps the real URL. |
| `content.js` / `content.css` | Slow clicks and form submits, slow-loading images |
| `inpage.js` | Delays `fetch` / XHR in the page and drops WebSockets during outages |
| `popup.*` | On/off switch, status, manual triggers |

The timings are at the top of `background.js`.

## Legal stuff (tl;dr: it's a joke, please don't sue me)

- **This is a parody made for fun.** Dulta, Dulta Sync, SkyMyles and Tee-Mobile are made-up names. The project is not affiliated with, endorsed by, sponsored by, or connected to Delta Air Lines, Inc., T-Mobile US, Inc., Deutsche Telekom AG, Google LLC, or anyone else.
- Delta, SkyMiles and Delta Sync are trademarks of Delta Air Lines, Inc. T-Mobile is a trademark of Deutsche Telekom AG. Chrome is a trademark of Google LLC. Real names appear only to identify what is being parodied.
- **No official assets are included.** No logos, images, fonts, audio or code from any of those companies. Everything is drawn with CSS/SVG or written from scratch. The Chrome screens are look-alikes, not copies of Chromium code.
- **It doesn't collect anything.** The SkyMyles "login" accepts any number (or none) and has no password field. Nothing you type is saved or sent anywhere; the extension has no server.
- **Don't misuse it.** Only install it on your own browser, or with the owner's OK. Don't use it to trick anyone into handing over information, and don't publish it to an extension store under real brand names.
- **No warranty.** Provided as-is under the MIT License. If it makes your internet bad, that's the feature. Uninstall it.
- If you represent one of the companies above and want something changed or taken down, open an issue and it will be. And then take a deep breath, go have a cup of coffee, and contemplate how you sat through rush hour traffic to be where you are.

## License

MIT. See [LICENSE](LICENSE).
