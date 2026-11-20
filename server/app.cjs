import("./dist/index.js").catch((error) => {
  console.error("[API STARTUP ERROR]", error);
  process.exit(1);
});
