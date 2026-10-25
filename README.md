<div align="center">

  # Space Base Simulator (Powered By Goop Corp)

  An immersive retro-futuristic space outpost management simulator and multiplayer commodity trading terminal. Balance life-support reserves, trade goods across orbital markets, decrypt mysterious alien dialects, and command your colony through critical crisis events to survive the 30-day deep space simulation.

</div>

## Team

[Olivia Stewart](https://github.com/OliStew), [Gracen Shepherd](https://github.com/Gracen-Shepherd), [Logan Hebert](https://github.com/Logan-Hebert), [Ameerah Thompson](https://github.com/ameerah8530), [James Sigler](https://github.com/melloon)

## About

<div align="center"> 

  ![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
  ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
  ![Cloudflare](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
  ![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
  ![DeepSpace](https://img.shields.io/badge/DeepSpace_SDK-000000?style=for-the-badge&logo=spacex&logoColor=white)

</div>

### What did you build? What problem does it solve?

Space colony management games often isolate players from realistic economic friction and dynamic narrative consequences. **Life in Space** bridges real-time resource survival with collaborative multiplayer commerce inside an authentic GoopCorp CRT terminal operating system.

As station commander, you must:
- **Balance Vital Life-Support Systems**: Oxygen and biomass continuously deplete. When both reserves remain healthy (above 50 units), station base health steadily regenerates (+1% every 5 seconds). If base hull integrity collapses to 0%, the colony is defeated.
- **Survive a 30-Day Deep Space Cycle**: Real-time 120-second day cycles simulate 24-hour planetary clock days (morning, afternoon, evening, and night). Reaching Day 30 unlocks the Mission Victory state with options to reset or continue exploring in endless sandbox mode.
- **Navigate Orbital Commodity Markets**: Trade metal, ammunition, biomass, and oxygen across dynamic markets governed by Cloudflare Workers Durable Objects. Deliveries face simulated orbital transit delays, price slippage, and escrow holds.
- **Command Emergency Crisis Scenarios**: Deep space events force commanders into rapid choices under a 15-second cooldown, impacting critical station health and supplies.
- **Decode Extraterrestrial Dialects**: An interactive linguistic mini-game allows operators to decrypt alien signals encountered in deep space.
- **Fight Rival Commanders**: Spend ammunition to attack other commanders, who have 30 seconds to answer with their own ammo or take heavy health damage.

### External Tools, APIs & Attribution

- **DeepSpace Platform & SDK**: Real-time edge deployment, multiplayer state arbitration via Cloudflare Workers Durable Objects, and user authentication.
- **ElevenLabs Voice API**: Synthesizes real-time text-to-speech audio reports for incoming crisis alerts and colony status updates.
- **Claude Haiku 5.5**: Used for AI assistant C.O.R.A.'s text based responses and simulation narrative writing. Accessed through DeepSpace's API.
- **Boilerplate & Template Attribution**: Core scaffolding originated from the DeepSpace full-stack starter template.
- **AI Generated / Assisted Code**: We used Claude, Gemini, and Junie to assist with development. AI was used throughout the project to help with implementation.

## Music used.

-- **Youtube music**: https://cdn.discordapp.com/attachments/1470843325207810076/1563731438413549739/Ambient_Space_Music_-_Nibiru.mp3?ex=6adf5aa3&is=6ade0923&hm=224a54ca440cccb0e22ec43493da7008dcbb6adc7c7af66c60c9da4cd7958e96& 

## Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed (Node 22 LTS or newer recommended) along with `npm`:

```sh
# Verify your Node.js and npm versions
node -v # >= 22.15.0
npm -v  # >= 11.6.0
```

## Build from source

Follow these steps to clone the repository and run the application locally:

```sh
# Clone the project
git clone https://github.com/OliStew/Space-Training.git && cd Space-Training

# Install dependencies
npm install

# Start the local development server (Vite + Miniflare)
npx deepspace dev start
```

Once running, navigate to `http://localhost:5173` in your browser.

## Extras

### Helpful Commands

```sh
# Run unit test suite (Day/Time system, end states, health regen, trade book, combat)
npm run test:unit

# Run TypeScript type verification
npm run type-check

# Deploy to Cloudflare Workers via DeepSpace
npx deepspace deploy
```

### In-Game Terminal Features
- **Visual & CRT Customization**: Toggle scanlines, CRT screen flicker, and 4 phosphor themes (Green Phosphor, Amber Classic, Cyan Vector, and Monochrome) in the Settings page.
- **Testing & Developer Controls**: Fast-forward days, simulate Day 30 victory, or test critical failure states directly in the Settings menu.
