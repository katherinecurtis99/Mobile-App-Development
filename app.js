function loadPlan() {
    try {
        const saved = JSON.parse(localStorage.getItem("plan"));
        if (Array.isArray(saved)) {
            return saved;
        }
    } catch (error) {
        console.log("Saved plan was damaged, starting empty");
    }
    return [];
}

let plan = loadPlan(); 

function savePlan() {
    localStorage.setItem("plan", JSON.stringify(plan));
}


function showScreen(name) {
    const navName = name === "recipe-detail" ? "recipes" : name;

    document.querySelectorAll(".screen").forEach(function (screen) {
        screen.classList.remove("active");
    });

    document.getElementById(name).classList.add("active");

    document.querySelectorAll("nav button").forEach(function (button) {
        button.classList.toggle("current", button.dataset.screen === navName);
    });
    if (name === "list") {
        renderShoppingList();
    }
}

document.querySelectorAll('nav button').forEach(function (button) {
    button.addEventListener('click', function () {
        showScreen(button.dataset.screen);
    });

});

const defaultSettings = {
    budget: 30,
    meals: 5,
    people: 2,
    diet: "none",
    avoid: ""
};

function loadSettings() {
    const saved = localStorage.getItem('settings');
    if (saved) {
        try {
            return { ...defaultSettings, ...JSON.parse(saved) };
        } catch (error) {
            console.error('Error, saved settings are corrupted. Using default settings.');
        }
    }
    return defaultSettings;
}

let settings = loadSettings();

function fillForm() {
    document.getElementById('budget').value = settings.budget;
    document.getElementById('meals').value = settings.meals;
    document.getElementById('people').value = settings.people;
    document.getElementById('diet').value = settings.diet;
    document.getElementById('avoid').value = settings.avoid;
}

function updateHome() {
    const budget = Number(settings.budget);
    const spent = buildShoppingList().reduce(function (sum, item) {
        return sum + item.price;
    }, 0);
    const left = budget - spent;

    document.getElementById("home-budget").textContent = "£" + budget.toFixed(2);
    document.getElementById("home-detail").textContent =
        settings.meals + " dinners · " + settings.people +
        (settings.people === 1 ? " person" : " people");

    const bar = document.getElementById("home-progress");
    bar.max = budget;
    bar.value = Math.min(spent, budget);

    document.getElementById("home-status").textContent =
        "Meals planned: " + plan.length + " of " + settings.meals + " · " +
        (left >= 0 ? "£" + left.toFixed(2) + " left" : "over budget by £" + (-left).toFixed(2));

    showHomeRecipes();
}

function showHomeRecipes() {
    const list = document.getElementById("home-recipes");
    const note = document.getElementById("home-note");
    list.innerHTML = "";

    const perMeal = settings.budget / settings.meals;
    const good = allRecipes
        .filter(function (recipe) {
            return isAllowed(recipe) && recipeCost(recipe) <= perMeal;
        })
        .sort(function (a, b) { return recipeCost(a) - recipeCost(b); });

    if (good.length === 0) {
        note.textContent = allRecipes.length === 0
            ? "Recipes are loading..."
            : "No recipes fit your budget and settings. Try raising your budget in Settings.";
        return;
    }
    note.textContent = "Within £" + perMeal.toFixed(2) + " per dinner. Prices are estimates.";

    const step = Math.floor(good.length / 3);
    new Set([0, step, step * 2]).forEach(function (index) {
        const recipe = good[index];

        const item = document.createElement("li");
        const button = document.createElement("button");
        button.className = "rec-card";

        const text = document.createElement("span");
        text.className = "rec-text";
        const name = document.createElement("span");
        name.className = "rec-name";
        name.textContent = recipe.name;
        const desc = document.createElement("span");
        desc.className = "rec-desc";
        desc.textContent = recipe.category + " · ~£" + recipeCost(recipe).toFixed(2) +
            " for " + settings.people;
        text.appendChild(name);
        text.appendChild(desc);

        const image = document.createElement("img");
        image.src = recipe.image + "/small";
        image.alt = "";
        image.loading = "lazy";

        button.appendChild(text);
        button.appendChild(image);
        button.addEventListener("click", function () { openRecipe(recipe); });

        item.appendChild(button);
        list.appendChild(item);
    });
}

document.getElementById('settings-form').addEventListener('submit', function (event) {
    event.preventDefault();

    settings = {
        budget: Number(document.getElementById('budget').value),
        meals: Number(document.getElementById('meals').value),
        people: Number(document.getElementById('people').value),
        diet: document.getElementById('diet').value,
        avoid: document.getElementById('avoid').value
    };

    localStorage.setItem("settings", JSON.stringify(settings));
    document.getElementById('save-message').textContent = "Settings saved!";
    updateHome();
    showRecipes();
});

fillForm();


// Prices (estimates) ----------
const PRICES = {
    chicken: 3, beef: 3.5, mince: 2.5, lamb: 4, pork: 3, sausage: 2, bacon: 2,
    ham: 2, chorizo: 2, salmon: 3.5, tuna: 1, prawn: 3, fish: 3, cod: 3.5,
    egg: 0.4, milk: 0.3, butter: 0.5, cheese: 1.2, cream: 0.9, yogurt: 0.6,
    yoghurt: 0.6, rice: 0.5, pasta: 0.6, spaghetti: 0.6, noodle: 0.8, flour: 0.2,
    bread: 0.5, potato: 0.6, onion: 0.2, garlic: 0.2, carrot: 0.2, tomato: 0.5,
    pepper: 0.4, mushroom: 0.9, spinach: 0.8, broccoli: 0.7, cabbage: 0.6,
    pea: 0.4, bean: 0.6, lentil: 0.7, chickpea: 0.6, coconut: 0.9, stock: 0.3,
    sugar: 0.1, lemon: 0.3, lime: 0.3, ginger: 0.3, chilli: 0.2, tofu: 1.5,
    oil: 0.2, honey: 0.4, nut: 1, almond: 1.2, beer: 1.5, wine: 2
};

const DEFAULT_PRICE = 0.7; 

function ingredientPrice(name) {
    const lower = name.toLowerCase();

    if (/^(salt|water|black pepper|sea salt|ice)$/.test(lower)) {
        return 0;
    }

    for (const keyword in PRICES) {
        if (lower.includes(keyword)) {
            return PRICES[keyword];
        }
    }
    return DEFAULT_PRICE;
}

function recipeCost(recipe) {
    let total = 0;
    recipe.ingredients.forEach(function (ingredient) {
        total += ingredientPrice(ingredient.name);
    });
    return total * settings.people / 4;
}


// Recipes --------------------

const API_URL = "https://www.themealdb.com/api/json/v1/1/";
let allRecipes = [];

function tidyRecipe(meal) {
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
        const name = (meal["strIngredient" + i] || "").trim();
        const measure = (meal["strMeasure" + i] || "").trim();
        if (name) {
            ingredients.push({ name: name, measure: measure });
        }
    }

    return {
        id: meal.idMeal,
        name: meal.strMeal,
        category: meal.strCategory,
        image: meal.strMealThumb,
        instructions: meal.strInstructions || "",
        ingredients: ingredients,
    };
}

async function fetchRecipes() {
    const letters = "abcdefghijklmnopqrstuvwxyz".split("");
    
    const requests = letters.map(async function (letter) {
        try {
            const response = await fetch(API_URL + "search.php?f=" + letter);
            const data = await response.json();
            return data.meals || [];
        } catch (error) {
            return [];
        }
    });

    const results = await Promise.all(requests);
    return results.flat().map(tidyRecipe);
}

async function loadRecipes() {
    const message = document.getElementById('recipe-message');

    const saved = localStorage.getItem('recipes');
    if (saved) {
        try {
            allRecipes = JSON.parse(saved);
        } catch (error) {
            allRecipes = [];
        }
    }

    if (allRecipes.length === 0) {
        message.textContent = "Loading recipes...";
        allRecipes = await fetchRecipes();
        if (allRecipes.length > 0) {
            localStorage.setItem('recipes', JSON.stringify(allRecipes));
        }
    }

    if (allRecipes.length === 0) {
        message.textContent = "Recipes unavailable. Please check your internet connection.";
        return;
    }

    message.textContent = "";
    showRecipes();
    updateHome();
}

const MEAT_WORDS = /chicken|beef|pork|bacon|\bham\b|sausage|mince|fish|prawn|salmon|tuna|anchov|chorizo|turkey|duck|steak|shrimp|crab|mussel|\bcod\b/i;
const ANIMAL_WORDS = /milk|cheese|butter|cream|egg|yogh?urt|honey|ghee|parmesan|mayo/i;
const HALAL_NO_WORDS = /pork|bacon|\bham\b|gammon|chorizo|lard|prosciutto|pancetta|sausage|wine|beer|rum|brandy|sherry|vodka|whisky|cider|sake/i;

const ALLERGY_GROUPS = {
    nuts: "nut|almond|cashew|walnut|pecan|pistachio|hazelnut",
    dairy: "milk|cheese|butter|cream|yogh?urt|ghee",
    gluten: "flour|bread|pasta|spaghetti|noodle|wheat|couscous|barley",
    eggs: "egg",
    shellfish: "prawn|shrimp|crab|lobster|mussel|clam",
    fish: "fish|salmon|tuna|\\bcod\\b|anchov",
    soy: "soy|tofu"
};

function isAllowed(recipe) {
    const text = recipe.ingredients.map(function (i) { return i.name; }).join(" | ");

    if (settings.diet === "vegetarian" || settings.diet === "vegan") {
        const meatCategories = ["Beef", "Chicken", "Lamb", "Pork", "Seafood", "Goat"];
        if (meatCategories.includes(recipe.category) || MEAT_WORDS.test(text)) {
            return false;
        }
    }

    if (settings.diet === "vegan" && recipe.category !== "Vegan" && ANIMAL_WORDS.test(text)) {
        return false;
    }

    if (settings.diet === "halal" && (recipe.category === "Pork" || HALAL_NO_WORDS.test(text))) {
        return false;   
    }

    const avoidList = settings.avoid
        .split(",").map(function (item) { return item.trim().toLowerCase(); }).filter(function (word) { return word !== ""; });

    for (const word of avoidList) {
        const pattern = ALLERGY_GROUPS[word] || ALLERGY_GROUPS[word + "s"] || word.replace(/s$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(pattern, "i").test(text)) {
            return false;
        }

    }

    return true;
}





function showRecipes() {
    const term = document.getElementById('recipe-search').value.trim().toLowerCase();
    const list = document.getElementById('recipe-list');
    list.innerHTML = "";
    const perMeal = settings.budget / settings.meals;

    const matches = allRecipes
        .filter(function (recipe) {
            return isAllowed(recipe) && recipe.name.toLowerCase().includes(term);
        })
        .sort(function (a, b) {
            return recipeCost(a) - recipeCost(b);
        })
        .slice(0, 30);

    if (matches.length === 0) {
        list.textContent = "No recipes found.";
        return;
    }

    matches.forEach(function (recipe) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.className = "card";

        const image = document.createElement('img');
        image.src = recipe.image + "/small";
        image.alt = "";
        image.loading = "lazy";

        const cost = recipeCost(recipe);
        const text = document.createElement("span");
        text.textContent = recipe.name + " · ~£" + cost.toFixed(2) + " · " +
            (cost <= perMeal ? "Within budget" : "Over budget") +
            (plan.includes(recipe.id) ? "  ✔ In plan" : "");

        button.addEventListener("click", function () {
            openRecipe(recipe);
        });

        button.appendChild(image);
        button.appendChild(text);
        item.appendChild(button);
        list.appendChild(item);
    });
}

document.getElementById('recipe-search').addEventListener('input', showRecipes);

loadRecipes();



let currentRecipe = null;

function openRecipe(recipe) {
    currentRecipe = recipe;

    document.getElementById("detail-title").textContent = recipe.name;
    document.getElementById("detail-image").src = recipe.image + "/medium";
    document.getElementById("plan-message").textContent = "";


    const ingredientList = document.getElementById("detail-ingredients");
    ingredientList.innerHTML = "";
    recipe.ingredients.forEach(function (ingredient) {
        const item = document.createElement("li");
        item.textContent = ingredient.measure + " " + ingredient.name;
        ingredientList.appendChild(item);
    });


    const method = document.getElementById("detail-method");
    method.innerHTML = "";
    recipe.instructions.split(/\r?\n/).forEach(function (line) {
        if (line.trim() !== "") {
            const paragraph = document.createElement("p");
            paragraph.textContent = line;
            method.appendChild(paragraph);
        }
    });

    updatePlanButton();
    showScreen("recipe-detail");
    window.scrollTo(0, 0);
}

function updatePlanButton() {
    const inPlan = plan.includes(currentRecipe.id);
    document.getElementById("plan-button").textContent =
        inPlan ? "Remove from plan" : "Add to plan & shopping list";
}

document.getElementById("plan-button").addEventListener("click", function () {
    const index = plan.indexOf(currentRecipe.id);
    let message;

    if (index === -1) {
        plan.push(currentRecipe.id);
        message = "Added to your plan";
    } else {
        plan.splice(index, 1);
        message = "Removed from your plan";
    }

    savePlan();
    updatePlanButton();
    updateHome();
    document.getElementById("plan-message").textContent = message;
});

document.getElementById("back-button").addEventListener("click", function () {
    showScreen("recipes");
    showRecipes();
});


// Shopping list ----------

function loadChecked() {
    try {
        const saved = JSON.parse(localStorage.getItem("checked"));
        if (saved && typeof saved === "object") {
            return saved;
        }
    } catch (error) {
        console.log("Saved ticks were damaged, starting empty");
    }
    return {};
}

let checked = loadChecked();

function buildShoppingList() {
    const items = new Map();

    plan.forEach(function (id) {
        const recipe = allRecipes.find(function (r) { return r.id === id; });
        if (!recipe) {
            return;
        }
        recipe.ingredients.forEach(function (ingredient) {
            const key = ingredient.name.toLowerCase();
            const item = items.get(key) || { name: ingredient.name, measures: [], price: 0 };
            if (ingredient.measure) {
                item.measures.push(ingredient.measure);
            }
            item.price += ingredientPrice(ingredient.name) * settings.people / 4;
            items.set(key, item);
        });
    });

    return Array.from(items.values());
}

function renderShoppingList() {
    const items = buildShoppingList();
    const list = document.getElementById("shopping-items");
    const summary = document.getElementById("shopping-summary");
    const totalText = document.getElementById("shopping-total");
    const clearButton = document.getElementById("clear-plan");

    list.innerHTML = "";

    if (items.length === 0) {
        summary.textContent = "No meals planned yet. Add recipes from the Recipes tab.";
        totalText.textContent = "";
        clearButton.hidden = true;
        return;
    }

    summary.textContent = "Prices are estimates for " + settings.people + " people.";
    clearButton.hidden = false;

    let total = 0;
    items.forEach(function (item) {
        total += item.price;

        const li = document.createElement("li");
        const label = document.createElement("label");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = Boolean(checked[item.name]);
        box.addEventListener("change", function () {
            checked[item.name] = box.checked;
            localStorage.setItem("checked", JSON.stringify(checked));
        });

        label.appendChild(box);
        label.appendChild(document.createTextNode(
            item.measures.join(" + ") + " " + item.name + " (~£" + item.price.toFixed(2) + ")"
        ));
        li.appendChild(label);
        list.appendChild(li);
    });

    const budget = Number(settings.budget);
    totalText.textContent = "Estimated total: £" + total.toFixed(2) + " of £" + budget.toFixed(2) + " budget.";
    if (total > budget) {
        totalText.textContent += " Over budget by £" + (total - budget).toFixed(2) + ". Try removing a meal.";
    }
    totalText.className = total > budget ? "over" : "";
}

document.getElementById("clear-plan").addEventListener("click", function () {
    plan = [];
    checked = {};
    savePlan();
    localStorage.setItem("checked", JSON.stringify(checked));
    renderShoppingList();
    updateHome();
    showRecipes();
});

showScreen('home');

// PWA: register the service worker (pattern from Lab 2) ----------
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js")
        .then(function () { console.log("Service worker registered"); })
        .catch(function (error) { console.log("Service worker failed", error); });
}