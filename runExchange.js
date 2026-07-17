import "dotenv/config";
import { getLongLivedToken } from "./connect_insta.js";

const SHORT_LIVED_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;

console.log("Token ending:", SHORT_LIVED_TOKEN?.slice(-6));
console.log("Token length:", SHORT_LIVED_TOKEN?.length);

getLongLivedToken(SHORT_LIVED_TOKEN, INSTAGRAM_APP_SECRET)
  .then((data) => {
    console.log("Long-lived token:", data.access_token);
    console.log("Expires in:", data.expires_in);
  })
  .catch((err) => {
    console.error(err.response?.data || err.message);
  });
