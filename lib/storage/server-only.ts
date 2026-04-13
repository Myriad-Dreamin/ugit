if (typeof window !== "undefined") {
  throw new Error("SQLite storage modules can only run on the server.");
}
