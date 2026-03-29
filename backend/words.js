// words.js — word bank with categories and hints

const wordBank = [
  // Animals
  { word: "Elephant", category: "Animals", hint: "A very large land animal known for its memory and long nose" },
  { word: "Penguin", category: "Animals", hint: "A flightless bird that lives in cold climates and swims" },
  { word: "Chameleon", category: "Animals", hint: "A reptile famous for changing its appearance" },
  { word: "Dolphin", category: "Animals", hint: "An intelligent marine mammal known for playfulness" },
  { word: "Kangaroo", category: "Animals", hint: "An Australian animal that carries its young in a pouch" },
  { word: "Flamingo", category: "Animals", hint: "A pink bird that stands on one leg near water" },
  { word: "Porcupine", category: "Animals", hint: "A rodent covered in sharp defensive spines" },
  { word: "Cheetah", category: "Animals", hint: "The fastest land animal on Earth" },

  // Food
  { word: "Sushi", category: "Food", hint: "A Japanese dish often involving raw fish and rice" },
  { word: "Pizza", category: "Food", hint: "A round baked dish with toppings on dough, from Italy" },
  { word: "Avocado", category: "Food", hint: "A green creamy fruit used in popular spreads and dips" },
  { word: "Croissant", category: "Food", hint: "A buttery flaky crescent-shaped pastry from France" },
  { word: "Ramen", category: "Food", hint: "A Japanese noodle soup with various toppings" },
  { word: "Taco", category: "Food", hint: "A folded tortilla with various fillings, popular in Mexico" },
  { word: "Cheesecake", category: "Food", hint: "A creamy dessert made with soft cheese on a crumbly base" },
  { word: "Pineapple", category: "Food", hint: "A tropical fruit with a spiky exterior and sweet interior" },

  // Places
  { word: "Volcano", category: "Places", hint: "A geological formation that can erupt with lava and ash" },
  { word: "Glacier", category: "Places", hint: "A massive slow-moving body of ice found in cold regions" },
  { word: "Rainforest", category: "Places", hint: "A dense tropical forest with very high rainfall" },
  { word: "Desert", category: "Places", hint: "A dry barren region with extreme temperatures" },
  { word: "Lighthouse", category: "Places", hint: "A tall structure with a bright light to guide ships" },
  { word: "Oasis", category: "Places", hint: "A fertile spot in a desert with water and vegetation" },

  // Objects
  { word: "Telescope", category: "Objects", hint: "An instrument used to observe distant objects in space" },
  { word: "Compass", category: "Objects", hint: "A navigation tool that always points to magnetic north" },
  { word: "Hourglass", category: "Objects", hint: "A timing device using sand flowing between two chambers" },
  { word: "Parachute", category: "Objects", hint: "A device used to slow descent from an aircraft" },
  { word: "Microscope", category: "Objects", hint: "A tool that magnifies tiny objects invisible to the naked eye" },
  { word: "Boomerang", category: "Objects", hint: "A curved throwing tool that returns to the thrower" },
  { word: "Metronome", category: "Objects", hint: "A device musicians use to keep a steady beat" },
  { word: "Periscope", category: "Objects", hint: "An optical device used to see above or around obstacles" },

  // Activities
  { word: "Surfing", category: "Activities", hint: "Riding ocean waves while standing on a board" },
  { word: "Archery", category: "Activities", hint: "A sport involving shooting arrows at a target" },
  { word: "Skydiving", category: "Activities", hint: "Jumping from an aircraft and freefalling before deploying a chute" },
  { word: "Pottery", category: "Activities", hint: "Shaping wet clay into objects, often on a spinning wheel" },
  { word: "Rock Climbing", category: "Activities", hint: "Ascending natural or artificial rock faces using hands and feet" },
  { word: "Meditation", category: "Activities", hint: "A mental practice of focused attention and calm breathing" },
  { word: "Fencing", category: "Activities", hint: "A sport involving combat with slender swords" },

  // Myths & Legends
  { word: "Vampire", category: "Myths & Legends", hint: "A creature of folklore that drinks blood and fears sunlight" },
  { word: "Mermaid", category: "Myths & Legends", hint: "A mythical being with a human upper body and fish tail" },
  { word: "Dragon", category: "Myths & Legends", hint: "A legendary fire-breathing winged reptile" },
  { word: "Werewolf", category: "Myths & Legends", hint: "A person who transforms into a wolf under a full moon" },
  { word: "Phoenix", category: "Myths & Legends", hint: "A mythical bird that is reborn from its own ashes" },
  { word: "Unicorn", category: "Myths & Legends", hint: "A legendary horse-like creature with a single spiral horn" },
];

function getRandomWord() {
  return wordBank[Math.floor(Math.random() * wordBank.length)];
}

module.exports = { wordBank, getRandomWord };
