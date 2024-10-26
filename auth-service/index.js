// find-my-lawyer-be
// client app ===> auth-service ===> lawyers-service
//            <===             |===> user-service

// auth-service
// connect sql db: lawyers, users, offices, images
// connect redis db: is_online, auth_token
// start http server

// endpoints
// POST /signup
// POST /login

var http = require("http");
const sql = require("mssql");
const path = require("path");
const redis = require(`redis`);
const crypto = require("crypto");

let redisClient;
const redisConfig = {
  url: "redis://default:sLng34NmlGQ4gUliM3xPf6rW1jv2m3Mk@redis-11637.c305.ap-south-1-1.ec2.redns.redis-cloud.com:11637/0",
};
const connect_redis_db = async () => {
  try {
    console.log(`redis DB connecting`);
    redisClient = await redis
      .createClient(redisConfig)
      .on("error", (err) => console.error("Redis Client Error", err))
      .connect();
    console.log(`redis DB connected`);
  } catch (error) {
    console.error(`redis DB connecting error`, error);
    process.exit(1);
  }
};

const sqlConfig = {
  user: `root`,
  password: `manav`,
  database: `find_my_lawyer_db`,
  server: "127.0.0.1",
  port: 3306,
  // pool: {
  //   max: 10,
  //   min: 0,
  //   idleTimeoutMillis: 30000,
  // },
  // options: {
  //   //   encrypt: true,
  //   //   trustServerCertificate: false
  // },
};
const connect_sql_db = async () => {
  try {
    console.log(`SQL DB connecting`);
    await sql.connect(sqlConfig);
    console.log(`SQL DB connected`);
  } catch (err) {
    console.error(`SQL DB connecting error`, err);
    process.exit(1);
  }
};

const start_http_server = async () => {
  await connect_redis_db();
  await connect_sql_db();

  console.log("auth-service http server starting at http://127.0.0.1:3001/");
  http
    .createServer(async function (req, res) {
      // INCOMING req = headers, method, path, query, body, requestId
      // OUTGOING res = status_code, response_headers, body { message, data }
      // console.error if status_code >= 400

      // REQ ID GEN
      const requestId = generateRequestId();
      console.log(`\nNew incoming HTTP request`, req.url, requestId);
      const path = getPath(req.url);

      // INVALID AUTH
      if (
        request_needs_auth(path) &&
        invalid_auth_request(req.headers["auth"])
      ) {
        console.error(`invalid auth`);
        res.writeHead(401, RESPONSE_HEADERS);
        res.write(JSON.stringify({ message: "invalid auth" }));
        res.end();
        return;
      }

      // SIGNUP
      if (path === "/signup" && req.method === "POST") {
        // req body = { name, phone }
        // check if any user with phone exists
        // YES: 400: account already with phone
        // NO: check if phone is verified
        // YES: INSERT into users/lawyers
        // NO: 400: please verify phone first
        try {
          // REQ BODY
          let reqBodyString = "";
          console.log(`parsing HTTP request body`);
          req.on("readable", function () {
            const chunk = req.read();
            if (chunk !== null) {
              reqBodyString += chunk;
            }
          });
          req.on("end", function () {
            console.log(`parsed HTTP request body`);
            const reqBody = JSON.parse(reqBodyString);

            // REQ VALIDATION
            if (!reqBody.name) {
              console.error(`no name in signup req body`);
              res.writeHead(400, RESPONSE_HEADERS);
              res.write(JSON.stringify({ message: "no name provided" }));
              res.end();
              return;
            }
            if (not_valid_phone(reqBody.phone)) {
              console.error(`not valid phone in signup req body`);
              res.writeHead(400, RESPONSE_HEADERS);
              res.write(
                JSON.stringify({ message: "not valid phone provided" }),
              );
              res.end();
              return;
            }

            if (!["user", "lawyer"].includes(reqBody.type)) {
              console.error(`not valid type in signup req body`);
              res.writeHead(400, RESPONSE_HEADERS);
              res.write(
                JSON.stringify({
                  message: "not valid type provided: user or lawyer",
                }),
              );
              res.end();
              return;
            }

            // DB PHONE VALIDATION
            let result;
            if (reqBody.type === "user") {
              // sql.query(
              //   `SELECT phone, phone_verified FROM users WHERE phone = ${reqBody.phone};`,
              // );
            }
            if (reqBody.type === "lawyer") {
              // sql.query(
              //   `SELECT phone, phone_verified FROM lawyers WHERE phone = ${reqBody.phone};`,
              // );
            }
          });
        } catch (error) {
          console.error(`error while signing up`, error);
          res.writeHead(500, RESPONSE_HEADERS);
          res.write(JSON.stringify({ message: "something went wrong" }));
        }
      }
      // LOGIN
      else if (path === "/login" && req.method === "POST") {
        // req body = { phone, otp }
        // check if any user with phone exists
        // YES: check if otp is correct (from redis db)
        // if otp is correct: 200, login success, { id, name, phone, auth_token }
        // else 400: otp is not correct
        // NO: 400: user not exist, please signup
        // YES: INSERT into users/lawyers
        // NO: 400: please verify phone first
      }

      // 404
      else {
        console.error(`path not found`, path);
        res.writeHead(404, RESPONSE_HEADERS);
        res.write(JSON.stringify({ message: "path not found" }));
      }

      res.end();
    })
    .listen(3001, () => {
      console.log(
        "auth-service http server running at http://127.0.0.1:3001/\n",
      );
    });
};

start_http_server().catch((err) => {
  console.error(`Failed to start auth-service http server`, err);
  process.exit(1);
});

// shutdown
// disconnect sql db: lawyers, users, offices, images
// disconnect redis db: is_online, auth_token

process.on("beforeExit", async () => {
  if (redisClient) {
    console.log(`redis DB dis-connecting`);
    await redisClient.disconnect();
    console.log(`redis DB dis-connected`);
  }
});

// utils
function not_valid_phone(phone) {
  return false;
}

const request_needs_auth = (path) => {
  return path !== "/signup" && path !== "/login";
};

const invalid_auth_request = (auth_token) => {
  // todo
  // verify if auth token is valid
  return false;
};

const getPath = (url) => {
  // todo
  // /hello#?a=b&c=d
  // /hello
  return url;
};

function generateRequestId() {
  // Generate a random 16-byte buffer
  const randomBytes = crypto.randomBytes(16);
  // Create a hash object
  const hash = crypto.createHash("sha256");
  // Update the hash with the random bytes
  hash.update(randomBytes);
  // Get the resulting hash in hexadecimal format
  const randomHash = hash.digest("hex");
  return randomHash;
}

// consts
const RESPONSE_HEADERS = {
  "Content-Type": "application/json",
};
