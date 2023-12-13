import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import "dotenv/config";

// varialbles
const app = express();
const port = 3000;
let currentUserId = 1;
let users;

// db setup
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "countries",
  password: process.env.DB_PASS,
  port: 5432,
});
db.connect();

// middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// helper functions
async function checkVisisted() {
  const result = await db.query(
    "SELECT country_code FROM visited_countries vc \
  JOIN users on users.id = vc.user_id \
  JOIN countries on countries.id = vc.country_id \
  WHERE user_id = $1",
    [currentUserId]
  );
  let countries = result.rows.map((country) => country.country_code);

  return countries;
}

async function getUsers() {
  const result = await db.query("SELECT * FROM users ORDER BY id ASC");
  return result.rows;
}

// endpoints
app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  users = await getUsers();

  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: users[currentUserId - 1].color,
  });
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];

  try {
    const result = await db.query(
      "SELECT countries.id FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    const countryId = result.rows[0].id;
    try {
      await db.query(
        "INSERT INTO visited_countries (user_id, country_id) VALUES ($1, $2)",
        [currentUserId, countryId]
      );
      res.redirect("/");
    } catch (err) {
      console.error(err.message);
      const countries = await checkVisisted(currentUserId);
      users = await getUsers();

      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        error: `${input} already added. Try again.`,
        color: users[currentUserId - 1].color,
      });
    }
  } catch (err) {
    console.error(err.message);
    const countries = await checkVisisted(currentUserId);
    users = await getUsers();

    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      error: `${input} does not exist. Try again.`,
      color: users[currentUserId - 1].color,
    });
  }
});

app.post("/user", async (req, res) => {
  currentUserId = parseInt(req.body.user);

  if (req.body.add) res.render("new.ejs");
  else res.redirect("/");
});

app.post("/new", async (req, res) => {
  let newUserId = await db.query(
    "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING id",
    [req.body.name, req.body.color]
  );
  currentUserId = newUserId.rows[0].id;

  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
