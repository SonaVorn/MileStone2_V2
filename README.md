# Dive and Collect

## About the Project
Dive and Collect is a small game I developed as part of a school assignment during class.

I used open-source assets from the internet, including background music, a diver character, and game backgrounds. The font was sourced from [Google Fonts](https://fonts.google.com/).

## How to Play
The goal of the game is to dive underwater and collect all the pearls while avoiding enemies. Collect all the pearls to win the game without getting caught by the enemies.

## Technologies and Resources
- Game Development: Created as a school assignment.
- Visual Assets: Open-source assets from the internet.
- Background Music: Open-source music.
- Font: Google Fonts.

## Controls
- **Keyboard:** Arrow keys or WASD to swim, any key to start, Enter / Esc on the end screens.
- **Touch / mouse:** press and drag to swim towards your finger, tap to start or play again.

## Project Structure
```
index.html
README.md
assets/
├── audio/    collect, game, gameover, ow, splash, win (.mp3)
├── css/      style.css
├── fonts/    Amarante-Regular.ttf
├── images/   diver, jellyfish, seastar, pearl and background (.gif)
└── js/
    ├── sketch.js      game code
    └── lib/           p5.js, p5.sound.min.js
```

Run it by opening `index.html` through a local server (for example `python3 -m http.server`), because browsers block loading audio and fonts from `file://`.

