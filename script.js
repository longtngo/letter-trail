const appEl = document.getElementById("app");
const loaderEl = document.getElementById("loader");
const loaderMessageEl = document.getElementById("loaderMessage");
const ruleTextEl = document.getElementById("ruleText");
const themeSelect = document.getElementById("themeSelect");
const letterCountSelect = document.getElementById("letterCountSelect");
const difficultySelect = document.getElementById("difficultySelect");
const wordInput = document.getElementById("wordInput");
const wordInputWrapEl = document.getElementById("wordInputWrap");
const systemMessageEl = document.getElementById("systemMessage");
const tilesEl = document.getElementById("tiles");
const scoreEl = document.getElementById("score");
const acceptedCountEl = document.getElementById("acceptedCount");
const wrongCountEl = document.getElementById("wrongCount");
const acceptedListEl = document.getElementById("acceptedList");
const wrongListEl = document.getElementById("wrongList");
const solutionsBoxEl = document.getElementById("solutionsBox");
const submitBtn = document.getElementById("submitBtn");
const newGameBtn = document.getElementById("newGameBtn");
const showSolutionsBtn = document.getElementById("showSolutionsBtn");

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const MIN_SOLUTIONS = 1;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_PREFIX = "letterTrailCache:v2:";
const CACHE_MAX_ENTRIES = 300;
const PREFS_KEY = "letterTrailPrefs:v1";
const DEFAULT_THEME_ID = "countries";
const DEFAULT_LETTER_COUNT = 4;
const DEFAULT_DIFFICULTY = "standard";

const DATA_FILES = {
  dictionary: "data/english_65k.txt",
  countries: "data/countries_un_observers.json",
  capitals: "data/capitals_un_observers.json",
};

const THEMES = {
  dictionary: { label: "English Dictionary", prompt: "an English word" },
  pokemon: { label: "Pokemon Names", prompt: "a Pokemon name" },
  countries: { label: "Country Names", prompt: "a country name" },
  capitals: { label: "Capital Cities", prompt: "a capital city name" },
};

const SCRABBLE_POINTS = {
  a: 1,
  b: 3,
  c: 3,
  d: 2,
  e: 1,
  f: 4,
  g: 2,
  h: 4,
  i: 1,
  j: 8,
  k: 5,
  l: 1,
  m: 3,
  n: 1,
  o: 1,
  p: 3,
  q: 10,
  r: 1,
  s: 1,
  t: 1,
  u: 1,
  v: 4,
  w: 4,
  x: 8,
  y: 4,
  z: 10,
};

let targetLetters = [];
let solutions = [];
let solutionSet = new Set();
let acceptedGuesses = [];
let wrongGuesses = [];
let totalScore = 0;
let isBusy = false;
let hasRevealedSolutions = false;

let currentThemeId = themeSelect.value;
let letterCount = Number(letterCountSelect.value);
let difficultyMode = difficultySelect.value;
let activeWords = [];
let activeWordSet = new Set();
let activeMetaByWord = {};
let meaningCache = {};
const themeEntriesMemory = {};
let lastGuessFeedback = "idle";

function syncEntryControls() {
  const shouldDisableEntry = isBusy || hasRevealedSolutions;
  wordInput.disabled = shouldDisableEntry;
  updateTileMatchPreview();

  if (shouldDisableEntry) {
    submitBtn.disabled = true;
    return;
  }

  submitBtn.disabled = !hasAllLettersMatchedInInput();
}

function setGuessFeedback(state) {
  lastGuessFeedback = state;
  wordInputWrapEl.classList.remove("feedback-success", "feedback-error");
  if (state === "success") {
    wordInputWrapEl.classList.add("feedback-success");
  }
  if (state === "error") {
    wordInputWrapEl.classList.add("feedback-error");
  }
}

function clearGuessFeedback() {
  if (lastGuessFeedback !== "idle") {
    setGuessFeedback("idle");
  }
}

function showSystemMessage(message) {
  systemMessageEl.textContent = message;
  systemMessageEl.hidden = false;
}

function clearSystemMessage() {
  systemMessageEl.hidden = true;
  systemMessageEl.textContent = "";
}

function hasAllLettersMatchedInInput() {
  if (!targetLetters.length) {
    return false;
  }
  const typedWord = normalizeForMatch(wordInput.value);
  return (
    getMatchedLetterCount(typedWord, targetLetters) === targetLetters.length
  );
}

function updateTileMatchPreview() {
  const typedWord = normalizeForMatch(wordInput.value);
  const matchedCount = getMatchedLetterCount(typedWord, targetLetters);
  const tileEls = tilesEl.querySelectorAll(".tile");
  tileEls.forEach((tileEl, index) => {
    tileEl.classList.toggle("matched", index < matchedCount);
  });
}

function showLoader(message) {
  loaderEl.hidden = false;
  appEl.hidden = true;
  loaderMessageEl.textContent = message;
}

function hideLoader() {
  loaderEl.hidden = true;
  appEl.hidden = false;
}

function readPreferences() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePreferences(themeId, selectedLetterCount, selectedDifficulty) {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        themeId,
        letterCount: selectedLetterCount,
        difficulty: selectedDifficulty,
      }),
    );
  } catch {
    // localStorage unavailable or blocked; skip preference persistence
  }
}

function applyStoredPreferences() {
  const stored = readPreferences();
  const storedTheme = stored?.themeId;
  const storedLetterCount = Number(stored?.letterCount);
  const storedDifficulty = stored?.difficulty;
  const themeId = THEMES[storedTheme] ? storedTheme : DEFAULT_THEME_ID;
  const selectedLetterCount =
    Number.isInteger(storedLetterCount) &&
    storedLetterCount >= 2 &&
    storedLetterCount <= 6
      ? storedLetterCount
      : DEFAULT_LETTER_COUNT;
  const selectedDifficulty =
    storedDifficulty === "easy" || storedDifficulty === "standard"
      ? storedDifficulty
      : DEFAULT_DIFFICULTY;

  themeSelect.value = themeId;
  letterCountSelect.value = String(selectedLetterCount);
  difficultySelect.value = selectedDifficulty;
}

function getCacheStorageKey(cacheKey) {
  return `${CACHE_PREFIX}${cacheKey}`;
}

function readCache(cacheKey) {
  try {
    const raw = localStorage.getItem(getCacheStorageKey(cacheKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      localStorage.removeItem(getCacheStorageKey(cacheKey));
      return null;
    }

    if (typeof parsed.expiresAt !== "number" || Date.now() > parsed.expiresAt) {
      localStorage.removeItem(getCacheStorageKey(cacheKey));
      return null;
    }

    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function pruneCache() {
  try {
    const now = Date.now();
    const cacheEntries = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(CACHE_PREFIX)) {
        continue;
      }

      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }

      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
          localStorage.removeItem(key);
          continue;
        }

        if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= now) {
          localStorage.removeItem(key);
          continue;
        }

        cacheEntries.push({
          key,
          cachedAt:
            typeof parsed.cachedAt === "number"
              ? parsed.cachedAt
              : parsed.expiresAt,
        });
      } catch {
        localStorage.removeItem(key);
      }
    }

    if (cacheEntries.length <= CACHE_MAX_ENTRIES) {
      return;
    }

    cacheEntries.sort((a, b) => a.cachedAt - b.cachedAt);
    const removeCount = cacheEntries.length - CACHE_MAX_ENTRIES;
    for (let i = 0; i < removeCount; i += 1) {
      localStorage.removeItem(cacheEntries[i].key);
    }
  } catch {
    // localStorage unavailable or blocked; skip pruning
  }
}

function writeCache(cacheKey, data) {
  try {
    localStorage.setItem(
      getCacheStorageKey(cacheKey),
      JSON.stringify({
        cachedAt: Date.now(),
        expiresAt: Date.now() + CACHE_TTL_MS,
        data,
      }),
    );
    pruneCache();
  } catch {
    // localStorage quota/unavailable; continue without persistence
  }
}

async function fetchJsonWithCache(cacheKey, url) {
  const cachedData = readCache(cacheKey);
  if (cachedData !== null) {
    return cachedData;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  const data = await response.json();
  writeCache(cacheKey, data);
  return data;
}

function normalizeForMatch(value) {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

function isAlphaWord(word) {
  return /^[a-z]+$/.test(word);
}

function containsInOrder(word, letters) {
  let fromIndex = 0;
  for (const letter of letters) {
    const index = word.indexOf(letter, fromIndex);
    if (index === -1) {
      return false;
    }
    fromIndex = index + 1;
  }
  return true;
}

function getMatchedLetterCount(word, letters) {
  if (!word || !letters.length) {
    return 0;
  }

  let fromIndex = 0;
  let count = 0;
  for (const letter of letters) {
    const index = word.indexOf(letter, fromIndex);
    if (index === -1) {
      break;
    }
    count += 1;
    fromIndex = index + 1;
  }
  return count;
}

function levenshteinDistance(a, b) {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }

  let previousRow = new Array(b.length + 1);
  let currentRow = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) {
    previousRow[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    currentRow[0] = i;
    const aCode = a.charCodeAt(i - 1);

    for (let j = 1; j <= b.length; j += 1) {
      const cost = aCode === b.charCodeAt(j - 1) ? 0 : 1;
      currentRow[j] = Math.min(
        previousRow[j] + 1,
        currentRow[j - 1] + 1,
        previousRow[j - 1] + cost,
      );
    }

    const swap = previousRow;
    previousRow = currentRow;
    currentRow = swap;
  }

  return previousRow[b.length];
}

function fuzzySimilarityPercent(a, b) {
  const maxLength = Math.max(a.length, b.length);
  if (!maxLength) {
    return 100;
  }

  const distance = levenshteinDistance(a, b);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  return Math.max(0, Math.round(similarity));
}

function getClosestSolutionPercent(word) {
  if (!word || !solutions.length) {
    return 0;
  }

  let best = 0;
  for (const solutionWord of solutions) {
    const percent = fuzzySimilarityPercent(word, solutionWord);
    if (percent > best) {
      best = percent;
    }
    if (best === 100) {
      break;
    }
  }
  return best;
}

function titleCaseFromDashText(value) {
  return (value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function setBusyState(value) {
  isBusy = value;
  showSolutionsBtn.disabled = value;
  newGameBtn.disabled = value;
  themeSelect.disabled = value;
  letterCountSelect.disabled = value;
  difficultySelect.disabled = value;
  syncEntryControls();
}

function updateRuleText() {
  const themePrompt = THEMES[currentThemeId]?.prompt || "a valid word";
  const easySuffix =
    difficultyMode === "easy" ? " Easy mode uses consecutive letters." : "";
  ruleTextEl.textContent = `Enter ${themePrompt} that contains all ${letterCount} letters in this exact order.${easySuffix}`;
  wordInput.placeholder =
    currentThemeId === "dictionary"
      ? "Type your guess and press Enter"
      : "Type a name and press Enter";
}

function updateSolutionsButtonLabel() {
  showSolutionsBtn.textContent = `Show All Solutions (${solutions.length})`;
}

function renderTiles() {
  tilesEl.innerHTML = "";
  targetLetters.forEach((letter) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.textContent = letter;
    tilesEl.appendChild(tile);
  });
}

function renderScoreboard() {
  scoreEl.textContent = totalScore;
  acceptedCountEl.textContent = acceptedGuesses.length;
  wrongCountEl.textContent = wrongGuesses.length;
}

function renderAcceptedWords() {
  renderList(
    acceptedListEl,
    acceptedGuesses,
    "No accepted words yet.",
    (item) => `${item.displayWord} (+${item.points}) - ${item.meaning}`,
  );
}

function renderWrongWords() {
  renderList(
    wrongListEl,
    wrongGuesses,
    "No wrong words yet.",
    (item) => `${item.word} - ${item.closestPercent}% matched`,
  );
}

function renderList(listEl, items, emptyText, toText) {
  listEl.innerHTML = "";
  if (!items.length) {
    listEl.innerHTML = `<li>${emptyText}</li>`;
    return;
  }
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = toText(item);
    fragment.appendChild(li);
  });
  listEl.appendChild(fragment);
}

function updateAllLists() {
  renderScoreboard();
  renderAcceptedWords();
  renderWrongWords();
}

function calculateWordScore(word) {
  let sum = 0;
  for (const char of word) {
    sum += SCRABBLE_POINTS[char] || 0;
  }
  return sum + word.length;
}

function parseWordListText(rawText) {
  const unique = new Set();
  const rows = rawText.split(/\r?\n/);

  rows.forEach((line) => {
    const word = normalizeForMatch(line);
    if (word.length < 2 || !isAlphaWord(word)) {
      return;
    }
    unique.add(word);
  });

  return Array.from(unique);
}

function dedupeEntries(entries) {
  const byWord = {};

  entries.forEach((entry) => {
    if (!entry || !entry.word) {
      return;
    }
    const word = entry.word;
    if (!byWord[word]) {
      byWord[word] = {
        word,
        display: entry.display || word,
        meaning: entry.meaning || "",
      };
      return;
    }

    if (!byWord[word].meaning && entry.meaning) {
      byWord[word].meaning = entry.meaning;
    }
  });

  return Object.values(byWord).sort((a, b) => a.word.localeCompare(b.word));
}

function sanitizeDictionaryWords(words) {
  if (!Array.isArray(words)) {
    return [];
  }

  const unique = new Set();
  words.forEach((value) => {
    const word = normalizeForMatch(value);
    if (word.length < 2 || !isAlphaWord(word)) {
      return;
    }
    unique.add(word);
  });
  return Array.from(unique);
}

function getDictionaryRemoteAcceptedWords() {
  return sanitizeDictionaryWords(
    readCache("theme:dictionary:remoteAcceptedWords"),
  );
}

function cacheDictionaryRemoteAcceptedWord(word) {
  const normalizedWord = normalizeForMatch(word);
  if (!normalizedWord || !isAlphaWord(normalizedWord)) {
    return;
  }

  const remoteWords = getDictionaryRemoteAcceptedWords();
  if (remoteWords.includes(normalizedWord)) {
    return;
  }

  remoteWords.push(normalizedWord);
  writeCache("theme:dictionary:remoteAcceptedWords", remoteWords);
}

async function loadDictionaryEntries() {
  let cachedWords = sanitizeDictionaryWords(
    readCache("theme:dictionary:baseWords"),
  );

  if (!cachedWords.length) {
    const response = await fetch(DATA_FILES.dictionary);
    if (!response.ok) {
      throw new Error("Dictionary dataset download failed.");
    }
    const rawText = await response.text();
    cachedWords = parseWordListText(rawText);
    writeCache("theme:dictionary:baseWords", cachedWords);
  }

  const allWords = Array.from(
    new Set([...cachedWords, ...getDictionaryRemoteAcceptedWords()]),
  );
  return allWords.map((word) => ({ word, display: word, meaning: "" }));
}

async function loadPokemonEntries() {
  const cachedEntries = readCache("theme:pokemon:entries");
  if (Array.isArray(cachedEntries) && cachedEntries.length) {
    return cachedEntries;
  }

  const data = await fetchJsonWithCache(
    "theme:pokemon:raw",
    "https://pokeapi.co/api/v2/pokemon?limit=2000",
  );

  const entries = dedupeEntries(
    (data.results || [])
      .map((item) => {
        const display = titleCaseFromDashText(item.name || "");
        const word = normalizeForMatch(item.name || "");
        if (word.length < 2) {
          return null;
        }
        return {
          word,
          display,
          meaning: "Pokemon name.",
        };
      })
      .filter(Boolean),
  );

  writeCache("theme:pokemon:entries", entries);
  return entries;
}

async function loadGeoEntries(kind) {
  const cacheKey =
    kind === "countries" ? "theme:countries:entries" : "theme:capitals:entries";
  const cachedEntries = readCache(cacheKey);
  if (Array.isArray(cachedEntries) && cachedEntries.length) {
    return cachedEntries;
  }

  const sourceFile =
    kind === "countries" ? DATA_FILES.countries : DATA_FILES.capitals;
  const rawEntries = await fetchJsonWithCache(`theme:${kind}:raw`, sourceFile);
  const defaultMeaning =
    kind === "countries" ? "Country name." : "Capital city.";
  const entries = dedupeEntries(
    (Array.isArray(rawEntries) ? rawEntries : [])
      .map((entry) => {
        const word = normalizeForMatch(entry?.word || entry?.display || "");
        if (word.length < 2) {
          return null;
        }

        const display = (entry?.display || word).trim() || word;
        const meaning = (entry?.meaning || defaultMeaning).trim();

        return { word, display, meaning };
      })
      .filter(Boolean),
  );

  writeCache(cacheKey, entries);
  return entries;
}

async function loadEntriesForTheme(themeId) {
  if (themeEntriesMemory[themeId]) {
    return themeEntriesMemory[themeId];
  }

  const loaders = {
    dictionary: loadDictionaryEntries,
    pokemon: loadPokemonEntries,
    countries: () => loadGeoEntries("countries"),
    capitals: () => loadGeoEntries("capitals"),
  };
  const loader = loaders[themeId];
  const entries = loader ? await loader() : [];

  themeEntriesMemory[themeId] = entries;
  return entries;
}

function setActiveEntries(entries) {
  activeMetaByWord = {};
  activeWords = entries
    .filter((entry) => entry && entry.word && entry.word.length >= 2)
    .map((entry) => {
      activeMetaByWord[entry.word] = {
        display: entry.display || entry.word,
        meaning: entry.meaning || "",
      };
      return entry.word;
    })
    .sort((a, b) => a.localeCompare(b));
  activeWordSet = new Set(activeWords);
}

function addActiveEntry(entry) {
  const word = normalizeForMatch(entry?.word || "");
  if (!word || word.length < 2 || !isAlphaWord(word)) {
    return;
  }

  if (!activeWordSet.has(word)) {
    activeWordSet.add(word);
    activeWords.push(word);
    activeWords.sort((a, b) => a.localeCompare(b));
  }

  const currentMeta = activeMetaByWord[word] || {};
  activeMetaByWord[word] = {
    display: entry?.display || currentMeta.display || word,
    meaning: entry?.meaning || currentMeta.meaning || "",
  };
}

function getDisplayWord(word) {
  return activeMetaByWord[word]?.display || word;
}

function getMeaningCacheKey(word) {
  return `${currentThemeId}:${word}`;
}

async function getMeaning(word) {
  const cacheKey = getMeaningCacheKey(word);
  if (meaningCache[cacheKey]) {
    return meaningCache[cacheKey];
  }

  const localMeaning = activeMetaByWord[word]?.meaning;
  if (localMeaning) {
    meaningCache[cacheKey] = localMeaning;
    return localMeaning;
  }

  if (currentThemeId !== "dictionary") {
    meaningCache[cacheKey] = "Meaning unavailable.";
    return meaningCache[cacheKey];
  }

  let meaning = "";
  try {
    const data = await fetchJsonWithCache(
      `dictionaryapi:meaning:${word}`,
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        word,
      )}`,
    );
    meaning = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition || "";
  } catch {
    meaning = "";
  }

  meaningCache[cacheKey] = meaning || "Meaning unavailable.";
  return meaningCache[cacheKey];
}

function fetchSolutionsForLetters(letters) {
  const found = [];
  for (const word of activeWords) {
    if (containsInOrder(word, letters)) {
      found.push(word);
    }
  }
  return found;
}

function chooseLettersFromWord(word, count) {
  if (count >= word.length) {
    return word.split("").slice(0, count);
  }

  const positions = new Set();
  while (positions.size < count) {
    positions.add(Math.floor(Math.random() * word.length));
  }

  return Array.from(positions)
    .sort((a, b) => a - b)
    .map((index) => word[index]);
}

function chooseConsecutiveLettersFromWord(word, count) {
  if (count >= word.length) {
    return word.split("").slice(0, count);
  }

  const startIndex = Math.floor(Math.random() * (word.length - count + 1));
  return word.slice(startIndex, startIndex + count).split("");
}

function getMaxSolutionsTarget() {
  if (currentThemeId === "dictionary") {
    if (letterCount === 2) {
      return 900;
    }
    if (letterCount === 3) {
      return 500;
    }
    return 350;
  }
  return 300;
}

function isThemeWord(word) {
  return activeWordSet.has(word);
}

async function validateDictionaryWordRemotely(word) {
  const cacheKey = `dictionary:validation:${word}`;
  const cached = readCache(cacheKey);
  if (typeof cached === "boolean") {
    return cached;
  }

  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    );
    if (response.status === 404) {
      writeCache(cacheKey, false);
      return false;
    }
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const isValid = Array.isArray(data) && data.length > 0;
    writeCache(cacheKey, isValid);
    return isValid;
  } catch {
    return null;
  }
}

function addDictionaryFallbackWord(word) {
  const entry = { word, display: word, meaning: "" };
  cacheDictionaryRemoteAcceptedWord(word);
  addActiveEntry(entry);

  if (Array.isArray(themeEntriesMemory.dictionary)) {
    const exists = themeEntriesMemory.dictionary.some(
      (item) => item.word === word,
    );
    if (!exists) {
      themeEntriesMemory.dictionary.push(entry);
      themeEntriesMemory.dictionary.sort((a, b) =>
        a.word.localeCompare(b.word),
      );
    }
  }
}

function rejectGuess(inputWord, dedupeKey) {
  const closestPercent = getClosestSolutionPercent(dedupeKey);
  if (!wrongGuesses.some((item) => item.key === dedupeKey)) {
    wrongGuesses.push({
      key: dedupeKey,
      word: inputWord,
      closestPercent,
    });
  }
  renderWrongWords();
  renderScoreboard();
  setGuessFeedback("error");
  wordInput.focus();
  wordInput.select();
}

async function generateRound() {
  setBusyState(true);
  clearSystemMessage();

  const eligibleWords = activeWords.filter(
    (word) => word.length >= letterCount,
  );
  if (!eligibleWords.length) {
    setBusyState(false);
    showSystemMessage(
      "No words available for this letter count. Try a smaller letter count.",
    );
    return;
  }

  const MAX_ATTEMPTS = 420;
  const maxSolutionsTarget = getMaxSolutionsTarget();
  let fallback = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const seedWord =
      eligibleWords[Math.floor(Math.random() * eligibleWords.length)];
    const letters =
      difficultyMode === "easy"
        ? chooseConsecutiveLettersFromWord(seedWord, letterCount)
        : chooseLettersFromWord(seedWord, letterCount);
    const roundSolutions = fetchSolutionsForLetters(letters);

    if (roundSolutions.length < MIN_SOLUTIONS) {
      continue;
    }

    if (!fallback || roundSolutions.length < fallback.solutions.length) {
      fallback = { letters, solutions: roundSolutions };
    }

    if (roundSolutions.length <= maxSolutionsTarget) {
      targetLetters = letters;
      solutions = roundSolutions;
      solutionSet = new Set(roundSolutions);
      updateSolutionsButtonLabel();
      renderTiles();
      setBusyState(false);
      wordInput.focus();
      return;
    }
  }

  if (fallback) {
    targetLetters = fallback.letters;
    solutions = fallback.solutions;
    solutionSet = new Set(fallback.solutions);
    updateSolutionsButtonLabel();
    renderTiles();
    setBusyState(false);
    wordInput.focus();
    return;
  }

  setBusyState(false);
  showSystemMessage("Could not generate a round right now. Try New Game.");
}

async function startNewGame() {
  currentThemeId = themeSelect.value;
  if (!THEMES[currentThemeId]) {
    currentThemeId = DEFAULT_THEME_ID;
    themeSelect.value = DEFAULT_THEME_ID;
  }

  letterCount = Number(letterCountSelect.value);
  if (!Number.isInteger(letterCount) || letterCount < 2 || letterCount > 6) {
    letterCount = DEFAULT_LETTER_COUNT;
    letterCountSelect.value = String(DEFAULT_LETTER_COUNT);
  }

  difficultyMode = difficultySelect.value;
  if (difficultyMode !== "easy" && difficultyMode !== "standard") {
    difficultyMode = DEFAULT_DIFFICULTY;
    difficultySelect.value = DEFAULT_DIFFICULTY;
  }

  writePreferences(currentThemeId, letterCount, difficultyMode);

  targetLetters = [];
  solutions = [];
  solutionSet = new Set();
  acceptedGuesses = [];
  wrongGuesses = [];
  totalScore = 0;
  meaningCache = {};
  hasRevealedSolutions = false;
  wordInput.value = "";
  clearGuessFeedback();
  clearSystemMessage();

  updateRuleText();
  showSolutionsBtn.hidden = false;
  solutionsBoxEl.textContent = "";
  updateSolutionsButtonLabel();
  updateAllLists();
  renderTiles();
  setBusyState(true);

  try {
    const entries = await loadEntriesForTheme(currentThemeId);
    setActiveEntries(entries);
    await generateRound();
  } catch {
    setBusyState(false);
    showSystemMessage(
      `Error loading ${THEMES[currentThemeId].label}. Please check your internet and try again.`,
    );
  }
}

async function submitGuess() {
  if (isBusy || !targetLetters.length) {
    return;
  }
  clearSystemMessage();

  if (!hasAllLettersMatchedInInput()) {
    setGuessFeedback("error");
    return;
  }

  const rawInput = wordInput.value.trim();
  const word = normalizeForMatch(rawInput);
  if (!word) {
    return;
  }

  if (!isAlphaWord(word)) {
    rejectGuess(rawInput, word || rawInput.toLowerCase());
    return;
  }

  if (acceptedGuesses.some((item) => item.word === word)) {
    rejectGuess(rawInput || getDisplayWord(word), word);
    return;
  }

  if (!containsInOrder(word, targetLetters)) {
    rejectGuess(rawInput || getDisplayWord(word), word);
    return;
  }

  if (!isThemeWord(word)) {
    if (currentThemeId === "dictionary") {
      const isValidRemote = await validateDictionaryWordRemotely(word);
      if (isValidRemote === true) {
        addDictionaryFallbackWord(word);
      } else if (isValidRemote === false) {
        rejectGuess(rawInput || getDisplayWord(word), word);
        return;
      } else {
        setGuessFeedback("error");
        showSystemMessage(
          "Could not validate this English word right now. Check your internet and try again.",
        );
        wordInput.focus();
        wordInput.select();
        return;
      }
    } else {
      rejectGuess(rawInput || getDisplayWord(word), word);
      return;
    }
  }

  if (!solutionSet.has(word)) {
    solutionSet.add(word);
    solutions.push(word);
    solutions.sort((a, b) => a.localeCompare(b));
    updateSolutionsButtonLabel();
  }

  const points = calculateWordScore(word);
  const meaning = await getMeaning(word);
  const displayWord = getDisplayWord(word);

  acceptedGuesses.push({ word, displayWord, points, meaning });
  totalScore += points;

  setGuessFeedback("success");
  wordInput.value = "";
  wordInput.focus();
  syncEntryControls();
  updateAllLists();
}

async function showAllSolutions() {
  if (!solutions.length) {
    return;
  }

  hasRevealedSolutions = true;
  clearGuessFeedback();
  syncEntryControls();
  showSolutionsBtn.hidden = true;
  setBusyState(true);

  const workers = [];
  const queue = [...solutions];
  const concurrency = currentThemeId === "dictionary" ? 8 : 16;
  const workerCount = Math.min(concurrency, queue.length);

  for (let i = 0; i < workerCount; i += 1) {
    workers.push(
      (async () => {
        while (queue.length) {
          const word = queue.pop();
          await getMeaning(word);
        }
      })(),
    );
  }

  await Promise.all(workers);

  solutionsBoxEl.innerHTML = "";
  const list = document.createElement("ul");
  const fragment = document.createDocumentFragment();

  solutions.forEach((word) => {
    const li = document.createElement("li");

    const wordSpan = document.createElement("span");
    wordSpan.className = "solution-word";
    wordSpan.textContent = getDisplayWord(word);

    const meaningSpan = document.createElement("span");
    meaningSpan.className = "solution-meaning";
    meaningSpan.textContent = ` - ${
      meaningCache[getMeaningCacheKey(word)] || "Meaning unavailable."
    }`;

    li.appendChild(wordSpan);
    li.appendChild(meaningSpan);
    fragment.appendChild(li);
  });

  list.appendChild(fragment);
  solutionsBoxEl.appendChild(list);
  setBusyState(false);
}

wordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    if (!submitBtn.disabled) {
      submitGuess();
    }
  }
});

wordInput.addEventListener("input", () => {
  clearGuessFeedback();
  syncEntryControls();
});

submitBtn.addEventListener("click", submitGuess);
showSolutionsBtn.addEventListener("click", showAllSolutions);
newGameBtn.addEventListener("click", startNewGame);
themeSelect.addEventListener("change", () => {
  startNewGame();
});
letterCountSelect.addEventListener("change", () => {
  startNewGame();
});
difficultySelect.addEventListener("change", () => {
  startNewGame();
});

async function initializeGame() {
  let initError = "";
  applyStoredPreferences();
  const initialThemeLabel = THEMES[themeSelect.value]?.label || "theme data";
  showLoader(`Loading ${initialThemeLabel}...`);

  try {
    await startNewGame();
  } catch {
    initError = "Error loading game data. Please refresh and try again.";
  } finally {
    hideLoader();
  }

  if (initError) {
    showSystemMessage(initError);
  }
}

initializeGame();
