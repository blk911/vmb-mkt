const { getMarkets } = require("../src/lib/markets");

const zones = getMarkets();

console.log("Loaded beauty zones:");
console.table(zones);
